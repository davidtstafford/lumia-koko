import { getDatabase } from './connection';

export interface KokoroVoice {
  voice_id: string;
  name: string;
  language_code: string;
  language_name: string;
  gender?: string;
  is_custom: boolean;
  is_available: boolean;
  description?: string;
}

export class VoiceService {
  static getAllVoices(): KokoroVoice[] {
    return getDatabase().prepare(`
      SELECT voice_id, name, language_code, language_name, gender,
             is_custom, is_available, description
      FROM tts_voices
      WHERE is_available = 1
      ORDER BY language_name, gender, name
    `).all() as KokoroVoice[];
  }

  static getVoiceById(voiceId: string): KokoroVoice | null {
    const row = getDatabase().prepare(`
      SELECT voice_id, name, language_code, language_name, gender,
             is_custom, is_available, description
      FROM tts_voices WHERE LOWER(voice_id) = ?
    `).get(voiceId.toLowerCase()) as KokoroVoice | undefined;
    return row ?? null;
  }

  static isVoiceAvailable(voiceId: string): boolean {
    const row = getDatabase().prepare(`
      SELECT is_available FROM tts_voices WHERE LOWER(voice_id) = ?
    `).get(voiceId.toLowerCase()) as { is_available: number } | undefined;
    return row?.is_available === 1;
  }

  static searchVoices(query: string): KokoroVoice[] {
    const term = `%${query.toLowerCase()}%`;
    const exact = query.toLowerCase();
    return getDatabase().prepare(`
      SELECT voice_id, name, language_code, language_name, gender,
             is_custom, is_available, description
      FROM tts_voices
      WHERE is_available = 1
        AND (LOWER(voice_id) LIKE ? OR LOWER(name) LIKE ? OR LOWER(language_name) LIKE ?)
      ORDER BY
        CASE WHEN LOWER(voice_id) = ? THEN 1
             WHEN LOWER(name) = ? THEN 2
             ELSE 3 END,
        name
      LIMIT 50
    `).all(term, term, term, exact, exact) as KokoroVoice[];
  }

  static addCustomVoice(voice: Omit<KokoroVoice, 'is_custom' | 'is_available'>): void {
    getDatabase().prepare(`
      INSERT OR REPLACE INTO tts_voices
        (voice_id, name, language_code, language_name, gender, is_custom, is_available, description)
      VALUES (?, ?, ?, ?, ?, 1, 1, ?)
    `).run(
      voice.voice_id,
      voice.name,
      voice.language_code,
      voice.language_name,
      voice.gender ?? null,
      voice.description ?? null
    );
  }

  static removeCustomVoice(voiceId: string): void {
    getDatabase().prepare(`
      DELETE FROM tts_voices WHERE LOWER(voice_id) = ? AND is_custom = 1
    `).run(voiceId.toLowerCase());
  }

  static getCustomVoices(): KokoroVoice[] {
    return getDatabase().prepare(`
      SELECT voice_id, name, language_code, language_name, gender,
             is_custom, is_available, description
      FROM tts_voices WHERE is_custom = 1
      ORDER BY name
    `).all() as KokoroVoice[];
  }

  static getViewerVoicePreference(viewerId: string): { voice_id: string; speed: number; volume: number } | null {
    return getDatabase().prepare(`
      SELECT voice_id, speed, COALESCE(volume, 100) as volume
      FROM viewer_voice_preferences WHERE viewer_id = ?
    `).get(viewerId) as { voice_id: string; speed: number; volume: number } | undefined ?? null;
  }

  static setViewerVoicePreference(viewerId: string, voiceId: string, speed = 1.0, volume = 100): void {
    getDatabase().prepare(`
      INSERT INTO viewer_voice_preferences (viewer_id, voice_id, speed, volume, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(viewer_id) DO UPDATE SET
        voice_id = excluded.voice_id,
        speed = excluded.speed,
        volume = excluded.volume,
        updated_at = CURRENT_TIMESTAMP
    `).run(viewerId, voiceId, speed, volume);
  }

  static clearViewerVoicePreference(viewerId: string): void {
    getDatabase().prepare('DELETE FROM viewer_voice_preferences WHERE viewer_id = ?').run(viewerId);
  }

  static getAllViewerVoicePreferences(): any[] {
    return getDatabase().prepare(`
      SELECT vvp.viewer_id, vvp.voice_id, vvp.speed, COALESCE(vvp.volume, 100) as volume,
             v.username, v.display_name,
             tv.name as voice_name, tv.language_name, tv.gender
      FROM viewer_voice_preferences vvp
      LEFT JOIN viewers v ON vvp.viewer_id = v.id
      LEFT JOIN tts_voices tv ON LOWER(vvp.voice_id) = LOWER(tv.voice_id)
      ORDER BY v.username
    `).all();
  }
}
