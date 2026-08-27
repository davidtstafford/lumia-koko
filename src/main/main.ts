import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { initializeDatabase } from './database/migrations';
import { closeDatabase, getDatabase } from './database/connection';
import { DatabaseService } from './database/service';
import { VoiceService } from './database/voiceService';
import { getLumiaService } from './lumia/lumiaService';
import { getOBSServer } from './obs/obsServer';
import { getApiServer } from './api/apiServer';
import { getDiscordService } from './discord/discordService';
import { synthesize, preloadModel, isModelLoaded, getModelError } from './tts/kokoroService';

console.log('Initializing database...');
initializeDatabase();
console.log('Database initialized');

let mainWindow: BrowserWindow | null = null;
const lumiaService = getLumiaService();
const obsServer = getOBSServer();
const apiServer = getApiServer();
const discordService = getDiscordService();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Lumia Koko'
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.on('ready', () => {
  createWindow();

  // ── Lumia messages → renderer ─────────────────────────────────────────────
  lumiaService.onMessage((message) => {
    mainWindow?.webContents.send('lumia:message', message);
  });

  lumiaService.onConnectionStatus((connected, error) => {
    mainWindow?.webContents.send('lumia:connectionStatus', { connected, error });
  });

  lumiaService.onClearQueue(() => {
    mainWindow?.webContents.send('tts:clearQueue');
  });

  lumiaService.onSkipCurrent(() => {
    mainWindow?.webContents.send('tts:skipCurrent');
  });

  // ── Discord connection status → renderer ──────────────────────────────────
  discordService.onConnectionStatus((connected, error) => {
    mainWindow?.webContents.send('discord:connectionStatus', { connected, error });
  });

  // ── API server TTS toggle → renderer ─────────────────────────────────────
  apiServer.on('tts-toggled', (enabled: boolean) => {
    mainWindow?.webContents.send('tts:status-changed', enabled);
  });

  // ── Start always-on API server ────────────────────────────────────────────
  apiServer.start().catch(err => console.error('Failed to start API server:', err));

  // ── Auto-connect Lumia if API key is saved ────────────────────────────────
  const autoConnect = DatabaseService.getSetting('auto_connect');
  const lumiaApiKey = DatabaseService.getSetting('lumia_api_key');

  if (autoConnect === 'true' && lumiaApiKey) {
    console.log('Auto-connecting to Lumia Stream...');
    lumiaService.connect(lumiaApiKey).catch(err => console.error('Lumia auto-connect failed:', err));
  }

  // ── Auto-connect Discord if enabled ──────────────────────────────────────
  const discordToken    = DatabaseService.getSetting('discord_token');
  const discordClientId = DatabaseService.getSetting('discord_client_id');
  const discordEnabled  = DatabaseService.getSetting('discord_enabled');

  if (discordEnabled === 'true' && discordToken && discordClientId) {
    console.log('Auto-connecting to Discord...');
    discordService.connect({
      token: discordToken,
      clientId: discordClientId,
      guildId: DatabaseService.getSetting('discord_guild_id') ?? undefined
    }).catch(err => console.error('Discord auto-connect failed:', err));
  }

  // ── Auto-start OBS server ─────────────────────────────────────────────────
  if (DatabaseService.getSetting('obs_browser_source_enabled') === 'true') {
    obsServer.start().catch(err => console.error('Failed to start OBS server:', err));
  }

  // ── Background preload of Kokoro model ────────────────────────────────────
  setTimeout(() => {
    console.log('[Main] Background preloading Kokoro model...');
    preloadModel();
  }, 2000);
});

app.on('window-all-closed', () => {
  lumiaService.destroy();
  discordService.destroy();
  obsServer.stop();
  apiServer.stop();
  closeDatabase();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// ── IPC handlers ──────────────────────────────────────────────────────────────

// Settings
ipcMain.handle('db:getSetting', (_e, key: string) => DatabaseService.getSetting(key));
ipcMain.handle('db:setSetting', (_e, key: string, value: string) => { DatabaseService.setSetting(key, value); return true; });
ipcMain.handle('db:getAllSettings', () => DatabaseService.getAllSettings());

// Viewers
ipcMain.handle('db:getViewers', () => DatabaseService.getAllViewers());
ipcMain.handle('db:getViewer', (_e, id: string) => DatabaseService.getViewerById(id));
ipcMain.handle('db:setViewerModStatus', (_e, viewerId: string, isMod: boolean) => {
  DatabaseService.updateViewerModStatus(viewerId, isMod);
  return true;
});
// Chat history
ipcMain.handle('db:getChatHistory', (_e, limit?: number, offset?: number) => DatabaseService.getChatHistory(limit, offset));
ipcMain.handle('db:searchChatHistory', (_e, term: string, limit?: number) => DatabaseService.searchChatHistory(term, limit));
ipcMain.handle('db:clearChatHistory', () => { DatabaseService.clearChatHistory(); return true; });
ipcMain.handle('db:getChatHistoryCount', () => {
  const db = getDatabase();
  const r = db.prepare('SELECT COUNT(*) as count FROM chat_messages').get() as { count: number };
  return r.count;
});

// Kokoro voices
ipcMain.handle('db:getAllVoices', () => VoiceService.getAllVoices());
ipcMain.handle('db:searchVoices', (_e, query: string) => VoiceService.searchVoices(query));
ipcMain.handle('db:getVoiceById', (_e, id: string) => VoiceService.getVoiceById(id));
ipcMain.handle('db:isVoiceAvailable', (_e, id: string) => VoiceService.isVoiceAvailable(id));
ipcMain.handle('db:addCustomVoice', (_e, voice: any) => { VoiceService.addCustomVoice(voice); return true; });
ipcMain.handle('db:removeCustomVoice', (_e, id: string) => { VoiceService.removeCustomVoice(id); return true; });
ipcMain.handle('db:getCustomVoices', () => VoiceService.getCustomVoices());

// Viewer voice preferences
ipcMain.handle('db:getViewerVoicePreference', (_e, viewerId: string) => VoiceService.getViewerVoicePreference(viewerId));
ipcMain.handle('db:setViewerVoicePreference', (_e, viewerId: string, voiceId: string, speed?: number, volume?: number) => {
  VoiceService.setViewerVoicePreference(viewerId, voiceId, speed, volume);
  return true;
});
ipcMain.handle('db:getAllViewerVoicePreferences', () => VoiceService.getAllViewerVoicePreferences());

// Viewer TTS restrictions
ipcMain.handle('db:getViewerTTSRestrictions', (_e, viewerId: string) => {
  return getDatabase().prepare('SELECT * FROM viewer_tts_restrictions WHERE viewer_id = ?').get(viewerId);
});
ipcMain.handle('db:updateLastTTSTime', (_e, viewerId: string) => {
  const now = new Date().toISOString();
  const db  = getDatabase();
  const exists = db.prepare('SELECT 1 FROM viewers WHERE id = ?').get(viewerId);
  if (exists) {
    db.prepare(`
      INSERT INTO viewer_tts_restrictions (viewer_id, last_tts_at, tts_count, updated_at)
      VALUES (?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(viewer_id) DO UPDATE SET
        last_tts_at = excluded.last_tts_at,
        tts_count   = COALESCE(tts_count, 0) + 1,
        updated_at  = CURRENT_TIMESTAMP
    `).run(viewerId, now);
  } else {
    db.prepare(
      'UPDATE viewer_tts_restrictions SET last_tts_at=?, tts_count=COALESCE(tts_count,0)+1, updated_at=CURRENT_TIMESTAMP WHERE viewer_id=?'
    ).run(now, viewerId);
  }
  return true;
});

// Pronunciations
ipcMain.handle('db:getPronunciations', () =>
  getDatabase().prepare('SELECT * FROM tts_pronunciations ORDER BY id').all()
);
ipcMain.handle('db:addPronunciation', (_e, pattern: string, replacement: string, isRegex = false, matchCase = false) => {
  getDatabase().prepare(
    'INSERT INTO tts_pronunciations (pattern, replacement, is_regex, match_case, enabled) VALUES (?, ?, ?, ?, 1)'
  ).run(pattern, replacement, isRegex ? 1 : 0, matchCase ? 1 : 0);
  return true;
});
ipcMain.handle('db:removePronunciation', (_e, id: number) => {
  getDatabase().prepare('DELETE FROM tts_pronunciations WHERE id = ?').run(id);
  return true;
});
ipcMain.handle('db:togglePronunciation', (_e, id: number, enabled: boolean) => {
  getDatabase().prepare('UPDATE tts_pronunciations SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
  return true;
});

// Generic DB query/exec
ipcMain.handle('db:query', (_e, sql: string, params: any[] = []) => {
  return getDatabase().prepare(sql).all(...params);
});
ipcMain.handle('db:run', (_e, sql: string, params: any[] = []) => {
  return getDatabase().prepare(sql).run(...params);
});

// ── Kokoro TTS ────────────────────────────────────────────────────────────────
ipcMain.handle('tts:synthesize', async (_e, opts: { text: string; voiceId: string; speed?: number }) => {
  return synthesize(opts.text, opts.voiceId, { speed: opts.speed });
});
ipcMain.handle('tts:isModelLoaded', () => isModelLoaded());
ipcMain.handle('tts:getModelError', () => getModelError());

// ── OBS Server ────────────────────────────────────────────────────────────────
ipcMain.handle('obs:start', async () => {
  try { await obsServer.start(); return { success: true, url: obsServer.getURL() }; }
  catch (err) { return { success: false, error: String(err) }; }
});
ipcMain.handle('obs:stop', async () => {
  try { await obsServer.stop(); return { success: true }; }
  catch (err) { return { success: false, error: String(err) }; }
});
ipcMain.handle('obs:getStatus', () => ({ running: obsServer.isRunning(), url: obsServer.getURL() }));
ipcMain.handle('obs:broadcastEvent', (_e, event: { type: string; item?: any }) => {
  obsServer.broadcast(event);
  return true;
});
ipcMain.handle('obs:waitForAudioComplete', () => new Promise(resolve => {
  const timeout = setTimeout(() => {
    obsServer.off('audioComplete', handler);
    resolve({ success: false, error: 'Timeout' });
  }, 30000);
  const handler = () => { clearTimeout(timeout); obsServer.off('audioComplete', handler); resolve({ success: true }); };
  obsServer.once('audioComplete', handler);
}));
ipcMain.handle('api:getUrl', () => apiServer.getURL());

// ── Lumia ─────────────────────────────────────────────────────────────────────
ipcMain.handle('lumia:connect', async (_e, apiKey: string) => {
  try {
    await lumiaService.connect(apiKey);
    DatabaseService.setSetting('lumia_api_key', apiKey);
    DatabaseService.setSetting('lumia_connected', 'true');
    return { success: true };
  } catch (err) { return { success: false, error: String(err) }; }
});

ipcMain.handle('lumia:disconnect', async () => {
  try {
    await lumiaService.disconnect();
    DatabaseService.setSetting('lumia_connected', 'false');
    return { success: true };
  } catch (err) { return { success: false, error: String(err) }; }
});

ipcMain.handle('lumia:isConnected', () => lumiaService.isConnected());

ipcMain.handle('lumia:forgetCredentials', async () => {
  await lumiaService.disconnect();
  DatabaseService.setSetting('lumia_api_key', '');
  DatabaseService.setSetting('lumia_connected', 'false');
  return { success: true };
});

// ── Discord ───────────────────────────────────────────────────────────────────
ipcMain.handle('discord:connect', async (_e, cfg: { token: string; clientId: string; guildId?: string }) => {
  try {
    await discordService.connect(cfg);
    DatabaseService.setSetting('discord_token', cfg.token);
    DatabaseService.setSetting('discord_client_id', cfg.clientId);
    if (cfg.guildId) DatabaseService.setSetting('discord_guild_id', cfg.guildId);
    DatabaseService.setSetting('discord_enabled', 'true');
    return { success: true };
  } catch (err) { return { success: false, error: String(err) }; }
});

ipcMain.handle('discord:disconnect', async () => {
  try {
    await discordService.disconnect();
    DatabaseService.setSetting('discord_enabled', 'false');
    return { success: true };
  } catch (err) { return { success: false, error: String(err) }; }
});

ipcMain.handle('discord:isConnected', () => discordService.isConnected());

ipcMain.handle('discord:forgetCredentials', async () => {
  await discordService.disconnect();
  ['discord_token', 'discord_client_id', 'discord_guild_id'].forEach(k => DatabaseService.setSetting(k, ''));
  DatabaseService.setSetting('discord_enabled', 'false');
  return { success: true };
});
