export const SCHEMA_VERSION = 3;

export const SCHEMA_SQL = `
-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Viewers: one row per person as seen via Lumia Stream.
-- lumia_id is Lumia's own viewer UUID (sent in WS events when available).
-- username is the primary lookup key; display_name may differ on platforms where
-- the shown name is not the same as the unique handle (e.g. TikTok).
-- Linking merges two viewer rows into one (same person, different usernames).
CREATE TABLE IF NOT EXISTS viewers (
  id TEXT PRIMARY KEY,              -- our generated UUID
  lumia_id TEXT UNIQUE,             -- Lumia's own viewer ID (if provided)
  username TEXT NOT NULL,           -- unique handle from Lumia
  display_name TEXT NOT NULL,       -- display name from Lumia (may differ from username)
  is_moderator INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  first_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_viewers_username ON viewers(LOWER(username));

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  viewer_id TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  message TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  platform TEXT,
  was_read_by_tts INTEGER DEFAULT 0,
  FOREIGN KEY (viewer_id) REFERENCES viewers(id)
);

CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_chat_viewer ON chat_messages(viewer_id);

-- Kokoro TTS voices
CREATE TABLE IF NOT EXISTS tts_voices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voice_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  language_code TEXT NOT NULL,
  language_name TEXT NOT NULL,
  gender TEXT,
  is_custom BOOLEAN DEFAULT 0,
  is_available BOOLEAN DEFAULT 1,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_voices_language ON tts_voices(language_name);
CREATE INDEX IF NOT EXISTS idx_voices_gender ON tts_voices(gender);

-- Viewer voice preferences
CREATE TABLE IF NOT EXISTS viewer_voice_preferences (
  viewer_id TEXT PRIMARY KEY,
  voice_id TEXT NOT NULL,
  speed REAL DEFAULT 1.0,
  volume INTEGER DEFAULT 100,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (viewer_id) REFERENCES viewers(id)
);

-- Viewer TTS restrictions
CREATE TABLE IF NOT EXISTS viewer_tts_restrictions (
  viewer_id TEXT PRIMARY KEY,
  is_muted BOOLEAN DEFAULT 0,
  mute_period_mins INTEGER,
  muted_at TEXT,
  mute_expires_at TEXT,
  has_cooldown BOOLEAN DEFAULT 0,
  cooldown_gap_seconds INTEGER,
  cooldown_period_mins INTEGER,
  cooldown_set_at TEXT,
  cooldown_expires_at TEXT,
  last_tts_at TEXT,
  tts_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (viewer_id) REFERENCES viewers(id)
);

-- Pronunciation dictionary
CREATE TABLE IF NOT EXISTS tts_pronunciations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern TEXT NOT NULL UNIQUE,
  replacement TEXT NOT NULL,
  is_regex BOOLEAN DEFAULT 0,
  match_case BOOLEAN DEFAULT 0,
  enabled BOOLEAN DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pronunciations_enabled ON tts_pronunciations(enabled);

-- Chat commands table
CREATE TABLE IF NOT EXISTS chat_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command_name TEXT NOT NULL UNIQUE,
  command_prefix TEXT DEFAULT '~',
  description TEXT,
  enabled BOOLEAN DEFAULT 1,
  permission_level TEXT DEFAULT 'viewer',
  rate_limit_seconds INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Command usage table
CREATE TABLE IF NOT EXISTS command_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command_name TEXT NOT NULL,
  viewer_id TEXT NOT NULL,
  username TEXT NOT NULL,
  success BOOLEAN DEFAULT 1,
  error_message TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (viewer_id) REFERENCES viewers(id)
);

CREATE INDEX IF NOT EXISTS idx_usage_command ON command_usage(command_name);
CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON command_usage(timestamp DESC);

-- Discord settings table
CREATE TABLE IF NOT EXISTS discord_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

export const BUILTIN_VOICES = [
  // American English — Female
  { voice_id: 'af_heart',    name: 'Heart',    language_code: 'en-US', language_name: 'American English', gender: 'female', description: 'Warm, expressive — highly recommended ❤️' },
  { voice_id: 'af_alloy',    name: 'Alloy',    language_code: 'en-US', language_name: 'American English', gender: 'female', description: 'Clear and neutral' },
  { voice_id: 'af_aoede',    name: 'Aoede',    language_code: 'en-US', language_name: 'American English', gender: 'female', description: '' },
  { voice_id: 'af_bella',    name: 'Bella',    language_code: 'en-US', language_name: 'American English', gender: 'female', description: 'High quality, expressive 🔥' },
  { voice_id: 'af_jessica',  name: 'Jessica',  language_code: 'en-US', language_name: 'American English', gender: 'female', description: '' },
  { voice_id: 'af_kore',     name: 'Kore',     language_code: 'en-US', language_name: 'American English', gender: 'female', description: '' },
  { voice_id: 'af_nicole',   name: 'Nicole',   language_code: 'en-US', language_name: 'American English', gender: 'female', description: 'Headphone-style delivery 🎧' },
  { voice_id: 'af_nova',     name: 'Nova',     language_code: 'en-US', language_name: 'American English', gender: 'female', description: '' },
  { voice_id: 'af_river',    name: 'River',    language_code: 'en-US', language_name: 'American English', gender: 'female', description: '' },
  { voice_id: 'af_sarah',    name: 'Sarah',    language_code: 'en-US', language_name: 'American English', gender: 'female', description: '' },
  { voice_id: 'af_sky',      name: 'Sky',      language_code: 'en-US', language_name: 'American English', gender: 'female', description: '' },
  // American English — Male
  { voice_id: 'am_adam',     name: 'Adam',     language_code: 'en-US', language_name: 'American English', gender: 'male', description: '' },
  { voice_id: 'am_echo',     name: 'Echo',     language_code: 'en-US', language_name: 'American English', gender: 'male', description: '' },
  { voice_id: 'am_eric',     name: 'Eric',     language_code: 'en-US', language_name: 'American English', gender: 'male', description: '' },
  { voice_id: 'am_fenrir',   name: 'Fenrir',   language_code: 'en-US', language_name: 'American English', gender: 'male', description: '' },
  { voice_id: 'am_liam',     name: 'Liam',     language_code: 'en-US', language_name: 'American English', gender: 'male', description: '' },
  { voice_id: 'am_michael',  name: 'Michael',  language_code: 'en-US', language_name: 'American English', gender: 'male', description: '' },
  { voice_id: 'am_onyx',     name: 'Onyx',     language_code: 'en-US', language_name: 'American English', gender: 'male', description: '' },
  { voice_id: 'am_puck',     name: 'Puck',     language_code: 'en-US', language_name: 'American English', gender: 'male', description: '' },
  { voice_id: 'am_santa',    name: 'Santa',    language_code: 'en-US', language_name: 'American English', gender: 'male', description: '🎅' },
  // British English — Female
  { voice_id: 'bf_alice',    name: 'Alice',    language_code: 'en-GB', language_name: 'British English', gender: 'female', description: '' },
  { voice_id: 'bf_emma',     name: 'Emma',     language_code: 'en-GB', language_name: 'British English', gender: 'female', description: '' },
  { voice_id: 'bf_isabella', name: 'Isabella', language_code: 'en-GB', language_name: 'British English', gender: 'female', description: '' },
  { voice_id: 'bf_lily',     name: 'Lily',     language_code: 'en-GB', language_name: 'British English', gender: 'female', description: '' },
  // British English — Male
  { voice_id: 'bm_daniel',   name: 'Daniel',   language_code: 'en-GB', language_name: 'British English', gender: 'male', description: '' },
  { voice_id: 'bm_fable',    name: 'Fable',    language_code: 'en-GB', language_name: 'British English', gender: 'male', description: '' },
  { voice_id: 'bm_george',   name: 'George',   language_code: 'en-GB', language_name: 'British English', gender: 'male', description: '' },
  { voice_id: 'bm_lewis',    name: 'Lewis',    language_code: 'en-GB', language_name: 'British English', gender: 'male', description: '' },
  // Italian
  { voice_id: 'if_sara',     name: 'Sara',     language_code: 'it-IT', language_name: 'Italian',         gender: 'female', description: '' },
  { voice_id: 'im_nicola',   name: 'Nicola',   language_code: 'it-IT', language_name: 'Italian',         gender: 'male',   description: '' },
  // French
  { voice_id: 'ff_siwis',    name: 'Siwis',    language_code: 'fr-FR', language_name: 'French',          gender: 'female', description: '' },
  // Hindi
  { voice_id: 'hf_alpha',    name: 'Alpha',    language_code: 'hi-IN', language_name: 'Hindi',           gender: 'female', description: '' },
  { voice_id: 'hf_beta',     name: 'Beta',     language_code: 'hi-IN', language_name: 'Hindi',           gender: 'female', description: '' },
  { voice_id: 'hm_omega',    name: 'Omega',    language_code: 'hi-IN', language_name: 'Hindi',           gender: 'male',   description: '' },
  { voice_id: 'hm_psi',      name: 'Psi',      language_code: 'hi-IN', language_name: 'Hindi',           gender: 'male',   description: '' },
  // Spanish
  { voice_id: 'ef_dora',     name: 'Dora',     language_code: 'es-ES', language_name: 'Spanish',         gender: 'female', description: '' },
  { voice_id: 'em_alex',     name: 'Alex',     language_code: 'es-ES', language_name: 'Spanish',         gender: 'male',   description: '' },
  { voice_id: 'em_santa',    name: 'Santa',    language_code: 'es-ES', language_name: 'Spanish',         gender: 'male',   description: '🎅' },
  // Portuguese
  { voice_id: 'pf_dora',     name: 'Dora',     language_code: 'pt-BR', language_name: 'Portuguese',      gender: 'female', description: '' },
  { voice_id: 'pm_alex',     name: 'Alex',     language_code: 'pt-BR', language_name: 'Portuguese',      gender: 'male',   description: '' },
  { voice_id: 'pm_santa',    name: 'Santa',    language_code: 'pt-BR', language_name: 'Portuguese',      gender: 'male',   description: '🎅' },
  // Japanese
  { voice_id: 'jf_alpha',      name: 'Alpha',      language_code: 'ja-JP', language_name: 'Japanese', gender: 'female', description: '' },
  { voice_id: 'jf_gongitsune', name: 'Gongitsune', language_code: 'ja-JP', language_name: 'Japanese', gender: 'female', description: '' },
  { voice_id: 'jf_nezumi',     name: 'Nezumi',     language_code: 'ja-JP', language_name: 'Japanese', gender: 'female', description: '' },
  { voice_id: 'jf_tebukuro',   name: 'Tebukuro',   language_code: 'ja-JP', language_name: 'Japanese', gender: 'female', description: '' },
  { voice_id: 'jm_kumo',       name: 'Kumo',       language_code: 'ja-JP', language_name: 'Japanese', gender: 'male',   description: '' },
  // Mandarin Chinese
  { voice_id: 'zf_xiaobei',  name: 'Xiaobei',  language_code: 'zh-CN', language_name: 'Mandarin Chinese', gender: 'female', description: '' },
  { voice_id: 'zf_xiaoni',   name: 'Xiaoni',   language_code: 'zh-CN', language_name: 'Mandarin Chinese', gender: 'female', description: '' },
  { voice_id: 'zf_xiaoxiao', name: 'Xiaoxiao', language_code: 'zh-CN', language_name: 'Mandarin Chinese', gender: 'female', description: '' },
  { voice_id: 'zf_xiaoyi',   name: 'Xiaoyi',   language_code: 'zh-CN', language_name: 'Mandarin Chinese', gender: 'female', description: '' },
  { voice_id: 'zm_yunjian',  name: 'Yunjian',  language_code: 'zh-CN', language_name: 'Mandarin Chinese', gender: 'male',   description: '' },
  { voice_id: 'zm_yunxi',    name: 'Yunxi',    language_code: 'zh-CN', language_name: 'Mandarin Chinese', gender: 'male',   description: '' },
  { voice_id: 'zm_yunxia',   name: 'Yunxia',   language_code: 'zh-CN', language_name: 'Mandarin Chinese', gender: 'male',   description: '' },
  { voice_id: 'zm_yunyang',  name: 'Yunyang',  language_code: 'zh-CN', language_name: 'Mandarin Chinese', gender: 'male',   description: '' },
];
