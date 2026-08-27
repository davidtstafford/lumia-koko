import { getDatabase } from './connection';
import { SCHEMA_SQL, SCHEMA_VERSION, BUILTIN_VOICES } from './schema';

export function initializeDatabase(): void {
  const db = getDatabase();

  const versionTable = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'
  `).get();

  let currentVersion = 0;
  if (versionTable) {
    const versionRow = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as { version: number };
    currentVersion = versionRow?.version || 0;
  }

  if (currentVersion < SCHEMA_VERSION) {
    console.log(`Migrating database from version ${currentVersion} to ${SCHEMA_VERSION}`);

    if (currentVersion === 1) {
      // v1 used username-as-id on the viewers table with no platform concept.
      // v2 introduces UUIDs, viewer_platforms (composite PK) and stores
      // restrictions/voice-prefs at the logical viewer level.
      // Drop old viewer-related tables so the new schema can be created cleanly.
      // Settings, voices, commands and pronunciations are preserved.
      console.log('Dropping v1 viewer tables for schema rebuild...');
      db.exec(`
        DROP TABLE IF EXISTS command_usage;
        DROP TABLE IF EXISTS viewer_tts_restrictions;
        DROP TABLE IF EXISTS viewer_voice_preferences;
        DROP TABLE IF EXISTS chat_messages;
        DROP TABLE IF EXISTS viewers;
      `);
    }

    if (currentVersion === 2) {
      // v2 introduced viewer_platforms (composite PK per platform).
      // v3 simplifies back to a single viewers table with lumia_id + username.
      // Lumia WS always reports platform:"lumia", so per-platform tracking is moot.
      console.log('Dropping v2 viewer_platforms for v3 schema rebuild...');
      db.exec(`
        DROP TABLE IF EXISTS command_usage;
        DROP TABLE IF EXISTS viewer_tts_restrictions;
        DROP TABLE IF EXISTS viewer_voice_preferences;
        DROP TABLE IF EXISTS chat_messages;
        DROP TABLE IF EXISTS viewer_platforms;
        DROP TABLE IF EXISTS viewers;
      `);
    }

    db.exec(SCHEMA_SQL);
    db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
    console.log('Database migration completed');
  } else {
    console.log(`Database is up to date (version ${currentVersion})`);
  }

  insertDefaultSettings();
  insertDefaultCommands();
  seedBuiltinVoices();
}

function insertDefaultSettings(): void {
  const db = getDatabase();

  const defaults = [
    { key: 'lumia_connected',          value: 'false' },
    { key: 'lumia_api_key',            value: '' },
    { key: 'tts_enabled',              value: 'true' },
    { key: 'tts_default_voice',        value: 'af_heart' },
    { key: 'tts_default_volume',       value: '1.0' },
    { key: 'tts_default_speed',        value: '1.0' },
    { key: 'obs_browser_source_enabled', value: 'false' },
    { key: 'obs_browser_source_port',  value: '8080' },
    { key: 'tts_mute_in_app',          value: 'false' },
    { key: 'auto_connect',             value: 'true' },
    { key: 'tts_access_restricted',    value: 'false' },
    { key: 'tts_access_moderators',    value: 'false' },
    { key: 'tts_filter_commands',      value: 'true' },
    { key: 'tts_filter_urls',          value: 'true' },
    { key: 'tts_filter_bots',          value: 'true' },
    { key: 'tts_announce_username',    value: 'true' },
    { key: 'tts_username_style',       value: 'says' },
    { key: 'tts_bot_list',             value: 'Nightbot,StreamElements,Streamlabs,Moobot,Fossabot,Wizebot' },
    { key: 'tts_min_length',           value: '1' },
    { key: 'tts_max_length',           value: '500' },
    { key: 'tts_blocked_word_replacement', value: '[censored]' },
    { key: 'kokoro_model_id',          value: 'onnx-community/Kokoro-82M-v1.0-ONNX' },
    { key: 'kokoro_model_dtype',       value: 'q8' },
    { key: 'kokoro_model_loaded',      value: 'false' },
    { key: 'discord_token',            value: '' },
    { key: 'discord_client_id',        value: '' },
    { key: 'discord_guild_id',         value: '' },
    { key: 'discord_enabled',          value: 'false' },
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const s of defaults) stmt.run(s.key, s.value);
}

function insertDefaultCommands(): void {
  const db = getDatabase();

  const commands = [
    { name: 'setvoice',        description: 'Set your Kokoro TTS voice (e.g. ~setvoice af_heart)',        level: 'viewer',    enabled: 1 },
    { name: 'voices',          description: 'List available Kokoro voices',                                level: 'viewer',    enabled: 1 },
    { name: 'setvoicespeed',   description: 'Set your TTS speed (e.g. ~setvoicespeed 1.5)',               level: 'viewer',    enabled: 1 },
    { name: 'setvolume',       description: 'Set your TTS volume 0–100% of master (e.g. ~setvolume 75)', level: 'viewer',    enabled: 1 },
    { name: 'randomvoice',     description: 'Assign yourself a random TTS voice',                         level: 'viewer',    enabled: 1 },
    { name: 'myvoice',         description: 'Show your current TTS voice, speed and volume settings',     level: 'viewer',    enabled: 1 },
    { name: 'resetvoice',      description: 'Reset voice, speed and volume back to stream defaults',      level: 'viewer',    enabled: 1 },
    { name: 'help',            description: 'List all commands or get help on one (~help setvoice)',      level: 'viewer',    enabled: 1 },
    { name: 'skip',            description: 'Skip the currently-playing TTS message (Moderator only)',    level: 'moderator', enabled: 1 },
    { name: 'mutevoice',       description: "Mute a viewer's TTS (Moderator only)",                      level: 'moderator', enabled: 1 },
    { name: 'unmutevoice',     description: "Unmute a viewer's TTS (Moderator only)",                    level: 'moderator', enabled: 1 },
    { name: 'cooldownvoice',   description: 'Set TTS cooldown for a viewer (Moderator only)',             level: 'moderator', enabled: 1 },
    { name: 'uncooldownvoice', description: 'Remove TTS cooldown for a viewer (Moderator only)',          level: 'moderator', enabled: 1 },
    { name: 'clearqueue',      description: 'Clear the TTS queue (Moderator only)',                       level: 'moderator', enabled: 1 },
    { name: 'mutetts',         description: 'Pause TTS globally (Moderator only)',                        level: 'moderator', enabled: 1 },
    { name: 'unmutetts',       description: 'Resume TTS globally (Moderator only)',                       level: 'moderator', enabled: 1 },
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO chat_commands (command_name, description, permission_level, enabled)
    VALUES (?, ?, ?, ?)
  `);
  for (const cmd of commands) stmt.run(cmd.name, cmd.description, cmd.level, cmd.enabled);

  const defaultPronunciations = [
    { pattern: 'lol',  replacement: 'laughing out loud' },
    { pattern: 'lmao', replacement: 'el mow'            },
    { pattern: 'omg',  replacement: 'oh my god'         },
    { pattern: 'gg',   replacement: 'good game'         },
    { pattern: 'brb',  replacement: 'be right back'     },
    { pattern: 'afk',  replacement: 'away from keyboard'},
    { pattern: 'irl',  replacement: 'in real life'      },
    { pattern: 'ngl',  replacement: 'not gonna lie'     },
    { pattern: 'tbh',  replacement: 'to be honest'      },
    { pattern: 'smh',  replacement: 'shaking my head'   },
    { pattern: 'imo',  replacement: 'in my opinion'     },
    { pattern: 'idk',  replacement: "I don't know"      },
  ];
  const pronStmt = db.prepare(
    'INSERT OR IGNORE INTO tts_pronunciations (pattern, replacement, is_regex, match_case, enabled) VALUES (?, ?, 0, 0, 1)'
  );
  for (const p of defaultPronunciations) pronStmt.run(p.pattern, p.replacement);
}

function seedBuiltinVoices(): void {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO tts_voices
      (voice_id, name, language_code, language_name, gender, is_custom, is_available, description)
    VALUES (?, ?, ?, ?, ?, 0, 1, ?)
  `);

  for (const v of BUILTIN_VOICES) {
    stmt.run(v.voice_id, v.name, v.language_code, v.language_name, v.gender, v.description);
  }

  const validIds = BUILTIN_VOICES.map(v => `'${v.voice_id}'`).join(',');
  db.exec(`DELETE FROM tts_voices WHERE is_custom = 0 AND voice_id NOT IN (${validIds})`);
}
