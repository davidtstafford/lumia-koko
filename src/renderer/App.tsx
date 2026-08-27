import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import './styles/App.css';
import { getTTSQueue } from './services/ttsQueue';
import { getTTSRulesService } from './services/ttsRules';

import Connection    from './pages/Connection';
import Chat          from './pages/Chat';
import ChatHistory   from './pages/ChatHistory';
import Viewers       from './pages/Viewers';
import TTS           from './pages/TTS';
import Voices        from './pages/Voices';
import Commands      from './pages/Commands';
import DiscordBot    from './pages/DiscordBot';
import KokoroSetup   from './pages/KokoroSetup';

interface ChatMessage {
  id?: number;
  viewer_id: string;
  username: string;
  display_name?: string;
  message: string;
  timestamp: string;
  platform?: string;
  was_read_by_tts?: boolean;
}

const NavLink: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => {
  const location = useLocation();
  const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  return (
    <li>
      <Link to={to} className={active ? 'active' : ''}>{children}</Link>
    </li>
  );
};

const AppInner: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const processedRef = useRef(new Set<string>());
  const ttsQueue = getTTSQueue();
  const ttsRules = getTTSRulesService();

  useEffect(() => {
    loadTTSSettings();

    const unsub = window.api.on('lumia:message', (msg: ChatMessage) => {
      setMessages(prev => {
        const next = [...prev, msg];
        return next.length > 500 ? next.slice(-500) : next;
      });
      processMessageForTTS(msg);
    });

    const unsubClear  = window.api.on('tts:clearQueue',     () => ttsQueue.clear());
    const unsubSkip   = window.api.on('tts:skipCurrent',    () => ttsQueue.skipCurrent());
    const unsubStatus = window.api.on('tts:status-changed', (enabled: boolean) => setTtsEnabled(enabled));

    return () => { unsub(); unsubClear(); unsubSkip(); unsubStatus(); };
  }, []);

  const loadTTSSettings = async () => {
    const enabled = await window.api.invoke('db:getSetting', 'tts_enabled');
    if (enabled) setTtsEnabled(enabled === 'true');
  };

  const checkTTSAccess = async (msg: ChatMessage): Promise<boolean> => {
    const restricted = await window.api.invoke('db:getSetting', 'tts_access_restricted');
    if (restricted !== 'true') return true;

    const viewer = await window.api.invoke('db:getViewer', msg.viewer_id);
    if (!viewer) return false;

    const allowMods = await window.api.invoke('db:getSetting', 'tts_access_moderators');
    if (allowMods === 'true' && viewer.is_moderator) return true;

    return false;
  };

  const checkTTSRestrictions = async (viewerId: string): Promise<{ allowed: boolean; reason?: string }> => {
    const restrictions = await window.api.invoke('db:getViewerTTSRestrictions', viewerId);
    if (!restrictions) return { allowed: true };

    if (restrictions.is_muted) {
      if (!restrictions.mute_expires_at) return { allowed: false, reason: 'Muted permanently' };
      if (new Date(restrictions.mute_expires_at) > new Date()) {
        return { allowed: false, reason: 'Muted temporarily' };
      }
    }

    if (restrictions.has_cooldown && restrictions.cooldown_gap_seconds && restrictions.last_tts_at) {
      const elapsed = (Date.now() - new Date(restrictions.last_tts_at).getTime()) / 1000;
      if (elapsed < restrictions.cooldown_gap_seconds) {
        return { allowed: false, reason: 'On cooldown' };
      }
    }

    return { allowed: true };
  };

  const processMessageForTTS = async (msg: ChatMessage) => {
    const dedupKey = `${msg.viewer_id}:${msg.timestamp}:${msg.message}`;
    if (processedRef.current.has(dedupKey)) return;
    processedRef.current.add(dedupKey);
    if (processedRef.current.size > 1000) {
      const iter = processedRef.current.values();
      processedRef.current.delete(iter.next().value!);
    }

    const currentEnabled = await window.api.invoke('db:getSetting', 'tts_enabled');
    if (currentEnabled !== 'true') return;

    if (!(await checkTTSAccess(msg))) return;

    const restrictions = await checkTTSRestrictions(msg.viewer_id);
    if (!restrictions.allowed) return;

    const processed = await ttsRules.processMessage(msg);
    if (!processed.shouldSpeak) return;

    const pref = await window.api.invoke('db:getViewerVoicePreference', msg.viewer_id);
    const defaultVoice = (await window.api.invoke('db:getSetting', 'tts_default_voice')) ?? 'af_heart';
    const defaultSpeed = parseFloat((await window.api.invoke('db:getSetting', 'tts_default_speed')) ?? '1.0');

    const voiceId = pref?.voice_id ?? defaultVoice;
    const speed   = pref?.speed   ?? defaultSpeed;
    const masterVolume = parseFloat((await window.api.invoke('db:getSetting', 'tts_default_volume')) ?? '1.0');
    const viewerVolumePct = pref?.volume ?? 100;
    const volume = Math.max(0, Math.min(1, masterVolume * (viewerVolumePct / 100)));

    ttsQueue.add({
      id: `${msg.viewer_id}-${Date.now()}`,
      text: processed.text,
      voiceId,
      speed,
      volume,
      viewerId: msg.viewer_id,
      username: msg.username
    });

    await window.api.invoke('db:updateLastTTSTime', msg.viewer_id).catch(() => {});
  };

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="app-title">🎤 Lumia Koko</div>
        <ul className="nav-menu">
          <NavLink to="/">Connection</NavLink>
          <NavLink to="/chat">Chat</NavLink>
          <NavLink to="/history">History</NavLink>
          <NavLink to="/tts">TTS</NavLink>
          <NavLink to="/voices">Voices</NavLink>
          <NavLink to="/viewers">Viewers</NavLink>
          <NavLink to="/commands">Commands</NavLink>
          <NavLink to="/discord">Discord Bot</NavLink>
          <NavLink to="/setup">Kokoro Setup</NavLink>
        </ul>
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/"        element={<Connection />} />
          <Route path="/chat"    element={<Chat messages={messages} onClearMessages={() => setMessages([])} />} />
          <Route path="/history" element={<ChatHistory />} />
          <Route path="/tts"     element={<TTS />} />
          <Route path="/voices"  element={<Voices />} />
          <Route path="/viewers" element={<Viewers />} />
          <Route path="/commands" element={<Commands />} />
          <Route path="/discord" element={<DiscordBot />} />
          <Route path="/setup"   element={<KokoroSetup />} />
        </Routes>
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <Router>
    <AppInner />
  </Router>
);

export default App;
