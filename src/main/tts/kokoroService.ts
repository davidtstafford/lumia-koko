/**
 * Kokoro TTS Service
 *
 * Runs entirely offline using the Kokoro-82M ONNX model via kokoro-js.
 * The model (~170 MB for q8) is downloaded once from Hugging Face on first
 * launch and cached in the Electron userData directory.  After that the app
 * works with no internet connection.
 *
 * Audio is generated as a 32-bit float PCM array at 24 kHz and returned as a
 * base64-encoded 16-bit PCM WAV buffer so the renderer (and OBS overlay) can
 * play it with a plain <audio> element.
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { DatabaseService } from '../database/service';

// ── WAV helpers ──────────────────────────────────────────────────────────────

/**
 * Convert a Float32Array of normalised PCM samples (–1..1) to a 16-bit PCM
 * WAV Buffer. Kokoro outputs mono audio at 24 000 Hz.
 */
function float32ToWav(samples: Float32Array, sampleRate = 24000): Buffer {
  const numSamples = samples.length;
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const bufferSize = 44 + dataSize;

  const buffer = Buffer.alloc(bufferSize);
  let offset = 0;

  const write = (fn: string, v: number, sz: number) => {
    (buffer as any)[fn](v, offset, true);
    offset += sz;
  };

  // RIFF header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(36 + dataSize, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;

  // fmt chunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;          // chunk size
  buffer.writeUInt16LE(1, offset); offset += 2;           // PCM
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

  // data chunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  for (let i = 0; i < numSamples; i++) {
    // Clamp and convert float32 → int16
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s * 32767), offset);
    offset += 2;
  }

  return buffer;
}

// ── Service ──────────────────────────────────────────────────────────────────

type KokoroTTSInstance = {
  generate: (text: string, opts: { voice: string; speed?: number }) => Promise<{ audio: Float32Array; sampling_rate: number }>;
  list_voices: () => string[];
  _validate_voice: (voiceId: string) => string;
};

let ttsInstance: KokoroTTSInstance | null = null;
let loadingPromise: Promise<KokoroTTSInstance> | null = null;
let loadError: string | null = null;

/**
 * Load (or return a cached) Kokoro TTS instance.
 * Sets the HuggingFace cache directory to the Electron userData folder so
 * all model files stay inside the app's data directory.
 */
async function getKokoro(): Promise<KokoroTTSInstance> {
  if (ttsInstance) return ttsInstance;
  if (loadingPromise) return loadingPromise;

  loadError = null;
  loadingPromise = (async () => {
    const modelId   = DatabaseService.getSetting('kokoro_model_id')   ?? 'onnx-community/Kokoro-82M-v1.0-ONNX';
    const modelDtype = DatabaseService.getSetting('kokoro_model_dtype') ?? 'q8';
    const cacheDir  = path.join(app.getPath('userData'), 'hf-models');

    // Pre-create the cache directory. @huggingface/transformers JS does NOT read
    // HF_HOME — it defaults to <package_root>/.cache/ inside the app bundle,
    // which is read-only in a packaged Electron app on Windows (→ ENOTDIR).
    // We must set env.cacheDir directly on the module object before loading kokoro-js.
    fs.mkdirSync(cacheDir, { recursive: true });

    console.log('[Kokoro] Loading model:', modelId, 'dtype:', modelDtype);
    console.log('[Kokoro] Cache dir:', cacheDir);

    // Use new Function to create a true runtime dynamic import. TypeScript's
    // CommonJS compilation would otherwise downgrade import() to require(),
    // stripping the webpackIgnore magic comment. new Function is opaque to
    // both tsc and webpack, so the ESM module is loaded natively by Node.js.
    const dynamicImport = new Function('m', 'return import(m)');

    // Set cacheDir on the @huggingface/transformers env object BEFORE loading
    // kokoro-js. Both share the same hoisted ESM module instance, so this
    // overrides the broken default before KokoroTTS.from_pretrained() runs.
    const { env: hfEnv } = await dynamicImport('@huggingface/transformers') as { env: any };
    hfEnv.cacheDir = cacheDir;

    const { KokoroTTS } = await dynamicImport('kokoro-js') as { KokoroTTS: any };

    const instance = await KokoroTTS.from_pretrained(modelId, {
      dtype: modelDtype as any,
      device: 'cpu'
    });

    DatabaseService.setSetting('kokoro_model_loaded', 'true');
    console.log('[Kokoro] Model loaded');

    ttsInstance = instance as unknown as KokoroTTSInstance;

    // Patch _validate_voice to accept non-English voices bundled with kokoro-js.
    // kokoro-js v1.x hard-codes only the 28 English voice IDs. All Kokoro voices
    // follow the naming pattern {lang}{gender}_{name} (e.g. "zf_xiaobei").
    // Patching here avoids any filesystem or require.resolve calls that would
    // fail inside the webpack-bundled main process.
    //
    // IMPORTANT: we check the regex FIRST so we never call the original function
    // for valid non-English IDs — the original fires console.error + console.table
    // before throwing, which would produce noisy "Voice not found" terminal spam.
    const origValidate = (instance as any)._validate_voice.bind(instance);
    (instance as any)._validate_voice = function(voiceId: string): string {
      // Any valid Kokoro voice ID (e.g. "zm_yunxi", "jf_alpha", "af_heart")
      // matches this pattern. Return the language-prefix char directly.
      const hit = (voiceId as string).match(/^([a-z])[mf]_\w+$/);
      if (hit) return hit[1];
      // Truly invalid format — let the original throw its helpful message.
      return origValidate(voiceId);
    };
    console.log('[Kokoro] Multilingual voice validation patched');

    // Pre-warm the ONNX runtime JIT so the first real message plays instantly.
    // Always use af_heart — it is guaranteed to be in the downloaded model.
    try {
      console.log('[Kokoro] Pre-warming ONNX runtime...');
      await instance.generate('.', { voice: 'af_heart', speed: 1.0 });
      console.log('[Kokoro] Pre-warm complete');
    } catch {
      // Non-fatal — pre-warm failure does not prevent TTS from working
    }

    return ttsInstance;
  })();

  loadingPromise.catch(err => {
    loadError = err instanceof Error ? err.message : String(err);
    loadingPromise = null; // allow retry
  });

  return loadingPromise;
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface SynthesisResult {
  success: boolean;
  audioData?: string;  // base64-encoded WAV
  error?: string;
}

/**
 * Synthesise text with the given Kokoro voice ID.
 * Returns a base64-encoded WAV string on success.
 */
export async function synthesize(
  text: string,
  voiceId: string,
  options: { speed?: number } = {}
): Promise<SynthesisResult> {
  try {
    const kokoro = await getKokoro();
    const speed = Math.max(0.25, Math.min(4.0, options.speed ?? 1.0));

    let audio;
    try {
      audio = await kokoro.generate(text.trim(), { voice: voiceId, speed });
    } catch (voiceErr) {
      const voiceErrMsg = voiceErr instanceof Error ? voiceErr.message : String(voiceErr);
      if (voiceErrMsg.toLowerCase().includes('not found') && voiceId !== 'af_heart') {
        console.warn(`[Kokoro] Voice "${voiceId}" not available (model not downloaded?), falling back to af_heart`);
        audio = await kokoro.generate(text.trim(), { voice: 'af_heart', speed });
      } else {
        throw voiceErr;
      }
    }

    const wavBuffer = float32ToWav(audio.audio, audio.sampling_rate ?? 24000);
    const audioData = wavBuffer.toString('base64');

    return { success: true, audioData };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Kokoro] Synthesis error:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Returns true if the Kokoro model is already loaded in memory.
 */
export function isModelLoaded(): boolean {
  return ttsInstance !== null;
}

export function getModelError(): string | null {
  return loadError;
}

/**
 * Trigger model loading in the background (e.g. at app startup).
 * Errors are swallowed — the UI will surface them when synthesis is attempted.
 */
export function preloadModel(): void {
  getKokoro().catch(err => {
    console.error('[Kokoro] Background preload failed:', err);
    DatabaseService.setSetting('kokoro_model_loaded', 'false');
  });
}

/**
 * Unload the model and free memory (mainly useful for testing).
 */
export function unloadModel(): void {
  ttsInstance = null;
  loadingPromise = null;
  DatabaseService.setSetting('kokoro_model_loaded', 'false');
}
