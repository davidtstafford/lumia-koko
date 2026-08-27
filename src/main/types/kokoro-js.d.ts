/**
 * Type declarations for kokoro-js.
 * The package is ESM-only and loaded at runtime via new Function()
 * to avoid CommonJS/ESM conflicts and webpack bundling.
 */
declare module 'kokoro-js' {
  export class KokoroTTS {
    static from_pretrained(
      modelId: string,
      options?: {
        dtype?: string;
        device?: string;
        progress_callback?: (progress: any) => void;
      }
    ): Promise<KokoroTTS>;

    generate(
      text: string,
      options: { voice: string; speed?: number }
    ): Promise<{ audio: Float32Array; sampling_rate: number }>;

    list_voices(): string[];
  }
}
