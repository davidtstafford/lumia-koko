import { randomUUID } from 'crypto';
import { getDatabase } from './connection';

export interface Setting {
  key: string;
  value: string;
  updated_at?: string;
}

export interface Viewer {
  id: string;             // our generated UUID
  lumia_id?: string;      // Lumia's own viewer ID (if provided)
  username: string;       // handle from Lumia
  display_name: string;   // display name from Lumia (may differ from username)
  is_moderator: boolean;
  message_count: number;
  first_seen_at?: string;
  last_seen_at?: string;
  created_at: string;
}

export interface ChatMessage {
  id?: number;
  viewer_id: string;
  username: string;
  display_name?: string;
  message: string;
  timestamp: string;
  platform?: string;
  was_read_by_tts?: boolean;
}

export class DatabaseService {
  // ── Settings ────────────────────────────────────────────────────────────────
  static getSetting(key: string): string | null {
    const row = getDatabase().prepare('SELECT value FROM settings WHERE key = ?').get(key) as Setting | undefined;
    return row?.value ?? null;
  }

  static setSetting(key: string, value: string): void {
    getDatabase().prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
      .run(key, value);
  }

  static getAllSettings(): Setting[] {
    return getDatabase().prepare('SELECT * FROM settings').all() as Setting[];
  }

  // ── Viewers ─────────────────────────────────────────────────────────────────

  /**
   * Find or create a viewer.
   * Lookup order: lumia_id (most reliable) → lowercase username → create new.
   * On repeat encounters the username, display_name and last_seen_at are updated.
   * If lumia_id was previously unknown it is backfilled on the existing row.
   */
  static findOrCreateViewer(lumiaId: string | null, username: string, displayName: string): string {
    const db = getDatabase();
    const label = (displayName || username).trim() || username;
    const userLower = username.toLowerCase();

    // 1. Try Lumia's own ID
    if (lumiaId) {
      const row = db.prepare('SELECT id FROM viewers WHERE lumia_id = ?').get(lumiaId) as { id: string } | undefined;
      if (row) {
        db.prepare(
          'UPDATE viewers SET username = ?, display_name = ?, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(username, label, row.id);
        return row.id;
      }
    }

    // 2. Try username
    const byUser = db.prepare('SELECT id FROM viewers WHERE LOWER(username) = ?').get(userLower) as { id: string } | undefined;
    if (byUser) {
      db.prepare(
        'UPDATE viewers SET display_name = ?, last_seen_at = CURRENT_TIMESTAMP, lumia_id = COALESCE(lumia_id, ?) WHERE id = ?'
      ).run(label, lumiaId ?? null, byUser.id);
      return byUser.id;
    }

    // 3. Create new
    const viewerId = randomUUID();
    db.prepare('INSERT INTO viewers (id, lumia_id, username, display_name) VALUES (?, ?, ?, ?)')
      .run(viewerId, lumiaId ?? null, username, label);
    return viewerId;
  }

  static getViewerById(id: string): Viewer | null {
    const row = getDatabase().prepare('SELECT * FROM viewers WHERE id = ?').get(id) as any | undefined;
    if (!row) return null;
    return { ...row, is_moderator: row.is_moderator === 1 || row.is_moderator === true };
  }

  static getViewerByUsername(username: string): Viewer | null {
    const lower = username.toLowerCase();
    // Match on username first, then fall back to display_name — covers cases where
    // the same person has different usernames across platforms (Lumia merges them,
    // but the stored username reflects the last platform seen).
    const row = getDatabase().prepare(
      'SELECT * FROM viewers WHERE LOWER(username) = ? OR LOWER(display_name) = ? LIMIT 1'
    ).get(lower, lower) as any | undefined;
    if (!row) return null;
    return { ...row, is_moderator: row.is_moderator === 1 || row.is_moderator === true };
  }

  static getAllViewers(): Viewer[] {
    return (getDatabase().prepare(
      'SELECT * FROM viewers ORDER BY last_seen_at DESC'
    ).all() as any[]).map(r => ({ ...r, is_moderator: r.is_moderator === 1 || r.is_moderator === true }));
  }

  static incrementViewerMessageCount(viewerId: string): void {
    getDatabase().prepare(
      'UPDATE viewers SET message_count = message_count + 1 WHERE id = ?'
    ).run(viewerId);
  }

  static updateViewerModStatus(viewerId: string, isMod: boolean): void {
    getDatabase().prepare('UPDATE viewers SET is_moderator = ? WHERE id = ?').run(isMod ? 1 : 0, viewerId);
  }

  // ── Chat Messages ───────────────────────────────────────────────────────────
  static insertChatMessages(messages: ChatMessage[]): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO chat_messages (viewer_id, username, display_name, message, timestamp, platform, was_read_by_tts)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    db.transaction((msgs: ChatMessage[]) => {
      for (const m of msgs) {
        stmt.run(m.viewer_id, m.username, m.display_name ?? m.username, m.message, m.timestamp, m.platform ?? null, m.was_read_by_tts ? 1 : 0);
      }
    })(messages);
  }

  static getChatHistory(limit = 100, offset = 0): ChatMessage[] {
    return getDatabase().prepare(
      'SELECT * FROM chat_messages ORDER BY timestamp DESC LIMIT ? OFFSET ?'
    ).all(limit, offset) as ChatMessage[];
  }

  static searchChatHistory(term: string, limit = 50): ChatMessage[] {
    const q = `%${term.toLowerCase()}%`;
    return getDatabase().prepare(`
      SELECT * FROM chat_messages
      WHERE LOWER(message) LIKE ? OR LOWER(username) LIKE ? OR LOWER(display_name) LIKE ?
      ORDER BY timestamp DESC LIMIT ?
    `).all(q, q, q, limit) as ChatMessage[];
  }

  static clearChatHistory(): void {
    getDatabase().prepare('DELETE FROM chat_messages').run();
  }
}
