import React, { useState, useEffect } from 'react';

const Connection: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [savedApiKey, setSavedApiKey] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    checkConnection();

    const unsub = window.api.on('lumia:connectionStatus', ({ connected, error }: { connected: boolean; error?: string }) => {
      setIsConnected(connected);
      if (connected) {
        setStatus('Connected to Lumia Stream');
      } else {
        setStatus(error ? `Disconnected: ${error}` : 'Disconnected');
      }
    });

    return () => unsub();
  }, []);

  const checkConnection = async () => {
    try {
      const key = await window.api.invoke('db:getSetting', 'lumia_api_key');
      if (key) {
        setSavedApiKey(key);
        setApiKey(key);
      }
      const connected = await window.api.invoke('lumia:isConnected');
      setIsConnected(connected);
      if (connected) setStatus('Connected to Lumia Stream');
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const handleConnect = async () => {
    const key = apiKey.trim();
    if (!key) {
      setStatus('Please enter your Lumia Stream API key');
      return;
    }

    setIsConnecting(true);
    setStatus('Connecting to Lumia Stream...');

    try {
      const result = await window.api.invoke('lumia:connect', key);
      if (result.success) {
        setSavedApiKey(key);
        setIsConnected(true);
        setStatus('Connected to Lumia Stream');
      } else {
        setStatus(`Connection failed: ${result.error}`);
      }
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await window.api.invoke('lumia:disconnect');
      setIsConnected(false);
      setStatus('Disconnected');
    } catch (error) {
      setStatus('Error disconnecting');
    }
  };

  const handleForget = async () => {
    if (!confirm('Remove saved API key and disconnect?')) return;
    await window.api.invoke('lumia:forgetCredentials');
    setIsConnected(false);
    setApiKey('');
    setSavedApiKey('');
    setStatus('Credentials cleared');
  };

  return (
    <div className="page">
      <h2>Lumia Stream Connection</h2>

      <div className="card" style={{ maxWidth: 520 }}>
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`} />
          <strong style={{ fontSize: 16 }}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </strong>
        </div>

        {status && (
          <div style={{
            marginBottom: 20, padding: 10,
            backgroundColor: '#1a2a1a', border: '1px solid #404040',
            borderRadius: 6, fontSize: 13, color: '#ccc'
          }}>
            {status}
          </div>
        )}

        {!isConnected && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#aaa' }}>
              Lumia Stream API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              placeholder="Your Lumia Stream API token"
              style={{ marginBottom: 10 }}
            />
            <button
              className="primary"
              onClick={handleConnect}
              disabled={isConnecting || !apiKey.trim()}
              style={{ width: '100%', opacity: isConnecting || !apiKey.trim() ? 0.6 : 1 }}
            >
              {isConnecting ? '⏳ Connecting...' : '🔌 Connect to Lumia Stream'}
            </button>
          </div>
        )}

        {isConnected && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="secondary" onClick={handleDisconnect}>
              Disconnect
            </button>
            <button
              onClick={handleForget}
              style={{
                background: 'transparent', border: '1px solid #dc3545',
                color: '#dc3545', padding: '10px 20px', borderRadius: 6,
                fontSize: 14, cursor: 'pointer'
              }}
            >
              Forget API Key
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <h3 style={{ marginBottom: 12 }}>How to find your API Key</h3>
        <ol style={{ paddingLeft: 20, fontSize: 14, lineHeight: 1.8, color: '#ccc' }}>
          <li>Open <strong>Lumia Stream</strong> on your computer</li>
          <li>Click the <strong>Settings</strong> icon (gear) in the sidebar</li>
          <li>Go to <strong>Integrations</strong> or <strong>API</strong></li>
          <li>Copy the <strong>API Token</strong></li>
          <li>Paste it above and click Connect</li>
        </ol>
        <p style={{ marginTop: 12, fontSize: 13, color: '#888' }}>
          Lumia Stream must be running in the background for the connection to work.
          The app connects to <code style={{ background: '#1a1a1a', padding: '1px 5px', borderRadius: 3 }}>ws://localhost:39231</code>.
        </p>
      </div>
    </div>
  );
};

export default Connection;
