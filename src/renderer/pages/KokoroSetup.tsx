import React, { useState, useEffect } from 'react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="card" style={{ marginBottom: 20 }}>
    <h3 style={{ marginBottom: 12 }}>{title}</h3>
    {children}
  </div>
);

const Step: React.FC<{ n: number; children: React.ReactNode }> = ({ n, children }) => (
  <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
    <div style={{
      minWidth: 28, height: 28, borderRadius: '50%',
      background: '#9147ff', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0
    }}>{n}</div>
    <div style={{ paddingTop: 4, fontSize: 14, lineHeight: 1.6 }}>{children}</div>
  </div>
);

const Code: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code style={{
    background: '#1a1a1a', border: '1px solid #404040',
    borderRadius: 4, padding: '1px 6px', fontFamily: 'monospace', fontSize: 13
  }}>{children}</code>
);

const KokoroSetup: React.FC = () => {
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelId, setModelId] = useState('onnx-community/Kokoro-82M-v1.0-ONNX');
  const [modelDtype, setModelDtype] = useState('q8');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
    const poll = setInterval(async () => {
      setModelLoaded(await window.api.invoke('tts:isModelLoaded'));
    }, 3000);
    return () => clearInterval(poll);
  }, []);

  const loadSettings = async () => {
    const id    = await window.api.invoke('db:getSetting', 'kokoro_model_id');
    const dtype = await window.api.invoke('db:getSetting', 'kokoro_model_dtype');
    if (id)    setModelId(id);
    if (dtype) setModelDtype(dtype);
    setModelLoaded(await window.api.invoke('tts:isModelLoaded'));
  };

  const saveModelSettings = async () => {
    setSaving(true);
    await window.api.invoke('db:setSetting', 'kokoro_model_id', modelId);
    await window.api.invoke('db:setSetting', 'kokoro_model_dtype', modelDtype);
    alert('Model settings saved. Restart the app to apply changes.');
    setSaving(false);
  };

  return (
    <div className="page">
      <h2>Kokoro Setup Guide</h2>

      <div className="card" style={{ background: '#1a1a2e', border: '1px solid #9147ff', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 32 }}>🎤</div>
          <div>
            <strong style={{ fontSize: 16 }}>Lumia Koko uses Kokoro AI — 100% offline TTS</strong>
            <p style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>
              No API keys. No cloud accounts. No monthly bills.<br />
              The Kokoro model runs entirely on your CPU and works without an internet connection
              once the model files have been downloaded once.
            </p>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: modelLoaded ? '#00ff00' : '#ffaa00', margin: '0 auto 6px' }} />
            <span style={{ fontSize: 12, color: '#aaa' }}>{modelLoaded ? 'Model ready' : 'Loading…'}</span>
          </div>
        </div>
      </div>

      {/* ── What is Kokoro ─────────────────────────────────────────────────── */}
      <Section title="What is Kokoro?">
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}>
          <strong>Kokoro</strong> is an open-weight text-to-speech model with 82 million parameters,
          created by <a href="https://github.com/hexgrad/kokoro" target="_blank" rel="noreferrer"
            style={{ color: '#9147ff' }}>hexgrad</a> and published under the Apache 2.0 licence.
          Despite its small size, it produces high-quality, natural-sounding speech.
        </p>
        <ul style={{ fontSize: 14, lineHeight: 1.8, paddingLeft: 20 }}>
          <li>✅ Completely <strong>offline</strong> after the first download</li>
          <li>✅ <strong>No API keys</strong> or cloud accounts required</li>
          <li>✅ Multiple voices — American English, British English, and more</li>
          <li>✅ Speed control per viewer</li>
          <li>✅ Apache 2.0 licence — free for personal and commercial use</li>
          <li>✅ Low latency on CPU — typically under 2 seconds for a short message</li>
        </ul>
      </Section>

      {/* ── First launch ───────────────────────────────────────────────────── */}
      <Section title="First Launch — Model Download">
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
          The first time Lumia Koko generates speech, it automatically downloads
          the Kokoro ONNX model (~170 MB for the default <Code>q8</Code> quantisation)
          from <strong>Hugging Face</strong>.
          After that, everything runs locally with no internet required.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 12, color: '#ffaa00' }}>
          ⚠️ Make sure you have an internet connection the first time you open the app and use TTS.
          Once the model is downloaded it is cached permanently in the app data folder.
        </p>
        <div style={{ background: '#1a1a1a', borderRadius: 6, padding: '12px 16px', fontSize: 13, fontFamily: 'monospace', color: '#aaa' }}>
          Cache location (macOS): <span style={{ color: '#9147ff' }}>~/Library/Application Support/lumia-koko/hf-models/</span><br />
          Cache location (Windows): <span style={{ color: '#9147ff' }}>%APPDATA%\lumia-koko\hf-models\</span>
        </div>

        <div style={{ marginTop: 15 }}>
          <strong style={{ fontSize: 14 }}>Model status:</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: modelLoaded ? '#00ff00' : '#ffaa00' }} />
            <span style={{ fontSize: 14, color: '#aaa' }}>
              {modelLoaded
                ? '✅ Kokoro model is loaded and ready'
                : '⏳ Model loading or awaiting first synthesis request…'}
            </span>
          </div>
        </div>
      </Section>

      {/* ── Voices ────────────────────────────────────────────────────────── */}
      <Section title="Available Voices">
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
          Lumia Koko ships with all 28 built-in Kokoro voices.
          Viewers set their preferred voice in Lumia chat with:
        </p>
        <div style={{ background: '#1a1a1a', borderRadius: 6, padding: '10px 16px', fontFamily: 'monospace', fontSize: 13, marginBottom: 12 }}>
          ~setvoice &lt;voice_id&gt;  &nbsp;— e.g. &nbsp;<span style={{ color: '#9147ff' }}>~setvoice af_heart</span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1a1a1a' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Voice ID</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Name</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Language</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Gender</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['af_heart',    'Heart',    'American English', '♀️', '❤️ Recommended'],
              ['af_bella',    'Bella',    'American English', '♀️', '🔥 Expressive'],
              ['af_nicole',   'Nicole',   'American English', '♀️', '🎧 Headphone style'],
              ['af_sarah',    'Sarah',    'American English', '♀️', ''],
              ['af_sky',      'Sky',      'American English', '♀️', ''],
              ['af_alloy',    'Alloy',    'American English', '♀️', ''],
              ['af_aoede',    'Aoede',    'American English', '♀️', ''],
              ['af_jessica',  'Jessica',  'American English', '♀️', ''],
              ['af_kore',     'Kore',     'American English', '♀️', ''],
              ['af_nova',     'Nova',     'American English', '♀️', ''],
              ['af_river',    'River',    'American English', '♀️', ''],
              ['am_michael',  'Michael',  'American English', '♂️', ''],
              ['am_puck',     'Puck',     'American English', '♂️', ''],
              ['am_fenrir',   'Fenrir',   'American English', '♂️', ''],
              ['am_adam',     'Adam',     'American English', '♂️', ''],
              ['am_echo',     'Echo',     'American English', '♂️', ''],
              ['am_eric',     'Eric',     'American English', '♂️', ''],
              ['am_liam',     'Liam',     'American English', '♂️', ''],
              ['am_onyx',     'Onyx',     'American English', '♂️', ''],
              ['am_puck',     'Puck',     'American English', '♂️', ''],
              ['am_santa',    'Santa',    'American English', '♂️', '🎅'],
              ['bf_emma',     'Emma',     'British English',  '♀️', ''],
              ['bf_alice',    'Alice',    'British English',  '♀️', ''],
              ['bf_isabella', 'Isabella', 'British English',  '♀️', ''],
              ['bf_lily',     'Lily',     'British English',  '♀️', ''],
              ['bm_george',   'George',   'British English',  '♂️', ''],
              ['bm_fable',    'Fable',    'British English',  '♂️', ''],
              ['bm_daniel',   'Daniel',   'British English',  '♂️', ''],
              ['bm_lewis',    'Lewis',    'British English',  '♂️', ''],
            ].map(([id, name, lang, g, note], i) => (
              <tr key={id + i} style={{ background: i % 2 === 0 ? '#252525' : '#1e1e1e' }}>
                <td style={{ padding: '6px 12px', fontFamily: 'monospace', color: '#9147ff' }}>{id}</td>
                <td style={{ padding: '6px 12px' }}>{name}</td>
                <td style={{ padding: '6px 12px', color: '#888' }}>{lang}</td>
                <td style={{ padding: '6px 12px' }}>{g} {note}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ fontSize: 13, color: '#888', marginTop: 12 }}>
          Browse and manage voices in the <strong>Voices</strong> tab. Custom voice IDs can be added there.
        </p>
      </Section>

      {/* ── Twitch commands ───────────────────────────────────────────────── */}
      <Section title="Twitch Chat Commands">
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
          Viewers interact with Lumia Koko using the <Code>~</Code> prefix:
        </p>
        {[
          ['~setvoice &lt;voice_id&gt;',    'Set your TTS voice',                                     'Viewer',    '~setvoice af_heart'],
          ['~voices [search]',               'List available voices (optional search term)',             'Viewer',    '~voices british'],
          ['~setvoicespeed &lt;0.25–4.0&gt;', 'Adjust your TTS speed',                                 'Viewer',    '~setvoicespeed 1.2'],
          ['~hello',                          'Say hi and get a usage tip',                             'Viewer',    '~hello'],
          ['~mutevoice &lt;user&gt; [mins]',  'Mute a viewer\'s TTS (permanent if no minutes given)',   'Moderator', '~mutevoice spammer 10'],
          ['~unmutevoice &lt;user&gt;',       'Unmute a viewer',                                        'Moderator', '~unmutevoice spammer'],
          ['~cooldownvoice &lt;user&gt; [s]', 'Add a per-message cooldown (seconds)',                   'Moderator', '~cooldownvoice chatty 30'],
          ['~uncooldownvoice &lt;user&gt;',   'Remove cooldown',                                        'Moderator', '~uncooldownvoice chatty'],
          ['~mutetts',                        'Pause TTS globally',                                     'Moderator', '~mutetts'],
          ['~unmutetts',                      'Resume TTS globally',                                    'Moderator', '~unmutetts'],
          ['~clearqueue',                     'Clear the TTS queue immediately',                        'Moderator', '~clearqueue'],
        ].map(([cmd, desc, level, ex]) => (
          <div key={cmd} style={{ borderBottom: '1px solid #333', padding: '8px 0', fontSize: 13 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <code style={{ color: '#9147ff', fontFamily: 'monospace', fontSize: 13, minWidth: 220 }}
                dangerouslySetInnerHTML={{ __html: cmd }} />
              <span style={{ color: '#ccc', flex: 1 }}>{desc}</span>
              <span style={{ color: level === 'Moderator' ? '#ff9900' : '#00aaff', fontSize: 12, minWidth: 70 }}>{level}</span>
            </div>
            <div style={{ color: '#666', fontSize: 12, marginTop: 2, paddingLeft: 4 }}>Example: <code>{ex}</code></div>
          </div>
        ))}
      </Section>

      {/* ── Discord commands ──────────────────────────────────────────────── */}
      <Section title="Discord Bot Commands">
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
          The Discord bot helps your community browse and discover Kokoro voices
          before going live. Configure it on the <strong>Discord Bot</strong> page.
        </p>
        {[
          ['/findvoice',              'Browse all voices with language/gender filters + pagination'],
          ['/searchvoice &lt;query&gt;', 'Quick search by voice name or ID'],
          ['/randomvoice',            'Get a random voice suggestion'],
          ['/listlanguages',          'Show all available languages'],
          ['/commands',               'Show Lumia chat command reference'],
          ['/help',                   'Show this help summary'],
        ].map(([cmd, desc]) => (
          <div key={cmd} style={{ display: 'flex', gap: 12, borderBottom: '1px solid #333', padding: '7px 0', fontSize: 13 }}>
            <code style={{ color: '#9147ff', fontFamily: 'monospace', fontSize: 13, minWidth: 200 }}
              dangerouslySetInnerHTML={{ __html: cmd }} />
            <span style={{ color: '#ccc' }}>{desc}</span>
          </div>
        ))}
      </Section>

      {/* ── Advanced: model settings ──────────────────────────────────────── */}
      <Section title="Advanced — Model Settings">
        <p style={{ fontSize: 13, color: '#aaa', marginBottom: 12 }}>
          Changing these settings requires restarting Lumia Koko to take effect.
          Only change them if you know what you are doing.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 15 }}>
          <div>
            <label style={{ fontSize: 13, display: 'block', marginBottom: 5 }}>Model ID (Hugging Face)</label>
            <input type="text" value={modelId} onChange={e => setModelId(e.target.value)} style={{ width: '100%' }} />
            <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Default: onnx-community/Kokoro-82M-v1.0-ONNX</p>
          </div>
          <div>
            <label style={{ fontSize: 13, display: 'block', marginBottom: 5 }}>Quantisation (dtype)</label>
            <select value={modelDtype} onChange={e => setModelDtype(e.target.value)} style={{ width: '100%' }}>
              <option value="q4">q4 — smallest (~85 MB), lower quality</option>
              <option value="q8">q8 — recommended (~170 MB), good quality</option>
              <option value="fp16">fp16 — larger, better quality</option>
              <option value="fp32">fp32 — largest, best quality (slow on CPU)</option>
            </select>
            <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              q8 is the best balance of size and quality for most streamers.
            </p>
          </div>
        </div>

        <button className="primary" onClick={saveModelSettings} disabled={saving}>
          {saving ? '⏳ Saving…' : '💾 Save Model Settings'}
        </button>
      </Section>

      {/* ── Getting custom voices ─────────────────────────────────────────── */}
      <Section title="Getting Custom Voices">

        {/* Option 1 — Voice blending */}
        <h4 style={{ fontSize: 14, marginBottom: 8 }}>Option 1 — Voice blending (no download needed)</h4>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}>
          Kokoro supports blending two existing voices by combining their IDs with a colon-weight syntax.
          The weights must add up to 1.0:
        </p>
        <div style={{ background: '#1a1a1a', borderRadius: 6, padding: '10px 16px', fontFamily: 'monospace', fontSize: 13, marginBottom: 8 }}>
          <span style={{ color: '#9147ff' }}>af_heart:0.6+af_bella:0.4</span>
          <span style={{ color: '#666', marginLeft: 16 }}>60% Heart, 40% Bella</span>
        </div>
        <p style={{ fontSize: 13, color: '#aaa', marginBottom: 20 }}>
          Register the blend string as the voice ID on the Voices page. Viewers can set it as their voice.
        </p>

        {/* Option 2 — Community (Discord) */}
        <h4 style={{ fontSize: 14, marginBottom: 8 }}>Option 2 — Community-shared voices</h4>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}>
          There is no public library of drop-in voice files for the ONNX version Kokoro uses.
          The broader community shares <Code>.pt</Code> (PyTorch) files for the Python library,
          which are a different format and not compatible with this app.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}>
          The best place to find community-made <Code>.bin</Code> voice files is the official
          Kokoro Discord server, where people occasionally share compatible voice packs:
        </p>
        <div style={{ background: '#1a1a1a', borderRadius: 6, padding: '10px 16px', fontFamily: 'monospace', fontSize: 13, marginBottom: 12 }}>
          <a href="https://discord.gg/QuGxSWBfQy" target="_blank" rel="noreferrer" style={{ color: '#9147ff' }}>
            discord.gg/QuGxSWBfQy
          </a>
          <span style={{ color: '#666', marginLeft: 16 }}>official Kokoro Discord</span>
        </div>
        <p style={{ fontSize: 13, color: '#aaa', marginBottom: 8 }}>
          If you do find a <Code>.bin</Code> file, place it in:
        </p>
        <div style={{ background: '#1a1a1a', borderRadius: 5, padding: '8px 12px', marginBottom: 12, fontFamily: 'monospace', fontSize: 12 }}>
          <span style={{ color: '#888' }}>macOS packaged: </span>
          <span style={{ color: '#9147ff' }}>Contents/Resources/app.asar.unpacked/node_modules/kokoro-js/voices/</span><br />
          <span style={{ color: '#888' }}>Dev mode: </span>
          <span style={{ color: '#9147ff' }}>node_modules/kokoro-js/voices/</span><br />
          <span style={{ color: '#888' }}>Windows: </span>
          <span style={{ color: '#9147ff' }}>resources\app.asar.unpacked\node_modules\kokoro-js\voices\</span>
        </div>
        <p style={{ fontSize: 13, color: '#aaa' }}>
          Then register it on the <strong>Voices</strong> page using the filename without <Code>.bin</Code> as the voice ID.
          Custom voices are marked with ⭐ in the list.
        </p>
      </Section>

      {/* ── OBS setup ─────────────────────────────────────────────────────── */}
      <Section title="OBS Browser Source Setup">
        <Step n={1}>
          In Lumia Koko, go to <strong>TTS → Main</strong> and click <strong>Start Server</strong> in the
          OBS Browser Source section.
        </Step>
        <Step n={2}>
          Copy the URL shown (default: <Code>http://localhost:8765/tts-overlay</Code>).
        </Step>
        <Step n={3}>
          In OBS, add a <strong>Browser Source</strong> and paste the URL.
          Set the size to match your canvas (e.g. 1920×1080).
        </Step>
        <Step n={4}>
          Optionally enable <strong>"Mute in-app when OBS is active"</strong> to avoid
          hearing the TTS twice (once in the app, once through OBS).
        </Step>
        <Step n={5}>
          The overlay will show the viewer name and message while audio plays,
          then fade out when complete.
        </Step>
      </Section>

      {/* ── Troubleshooting ───────────────────────────────────────────────── */}
      <Section title="Troubleshooting">
        {[
          ['No audio on first use', 'The Kokoro model is still downloading. Wait until the status shows "Model ready" (green dot in the top bar). Large messages may take a few seconds on first use as the model warms up.'],
          ['Audio is very slow', 'Try switching to the q4 or q8 dtype in Advanced settings and restart. Also ensure no other CPU-heavy processes are running.'],
          ['Voice not found error', 'Make sure you are using an exact Kokoro voice ID (e.g. af_heart, not "heart"). Check the Voices page for the correct IDs.'],
          ['Model download fails', 'Check your internet connection. The model is hosted on Hugging Face (huggingface.co). If Hugging Face is blocked on your network, you can manually download the model files and place them in the cache folder shown in the "First Launch" section.'],
          ['Discord commands not appearing', 'Guild commands appear instantly; global commands can take up to 1 hour to propagate. Use a Guild ID in the Discord Bot settings for immediate registration.'],
        ].map(([q, a]) => (
          <div key={q} style={{ marginBottom: 14 }}>
            <strong style={{ fontSize: 14 }}>{q}</strong>
            <p style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>{a}</p>
          </div>
        ))}
      </Section>
    </div>
  );
};

export default KokoroSetup;
