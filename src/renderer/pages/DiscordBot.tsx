import React, { useState, useEffect } from 'react';

const DiscordBot: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [guildId, setGuildId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    checkConnection();

    // Listen for connection status changes
    const unsubscribe = window.api.on('discord:connectionStatus', (status: { connected: boolean; error?: string }) => {
      setConnected(status.connected);
      if (status.error) {
        setError(status.error);
      }
    });

    return () => unsubscribe();
  }, []);

  const loadSettings = async () => {
    try {
      const token = await window.api.invoke('db:getSetting', 'discord_token');
      const cId = await window.api.invoke('db:getSetting', 'discord_client_id');
      const gId = await window.api.invoke('db:getSetting', 'discord_guild_id');
      
      if (token) setBotToken(token);
      if (cId) setClientId(cId);
      if (gId) setGuildId(gId);
    } catch (err) {
      console.error('Failed to load Discord settings:', err);
    }
  };

  const checkConnection = async () => {
    try {
      const isConnected = await window.api.invoke('discord:isConnected');
      setConnected(isConnected);
    } catch (err) {
      console.error('Failed to check Discord connection:', err);
    }
  };

  const handleConnect = async () => {
    if (!botToken || !clientId) {
      setError('Bot Token and Client ID are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await window.api.invoke('discord:connect', {
        token: botToken,
        clientId: clientId,
        guildId: guildId || undefined
      });

      if (result.success) {
        setConnected(true);
        setError(null);
      } else {
        setError(result.error || 'Failed to connect');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await window.api.invoke('discord:disconnect');
      setConnected(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForget = async () => {
    if (!confirm('Are you sure you want to forget Discord credentials? This will disconnect the bot.')) {
      return;
    }

    setLoading(true);
    try {
      await window.api.invoke('discord:forgetCredentials');
      setBotToken('');
      setClientId('');
      setGuildId('');
      setConnected(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h2>Discord Bot</h2>
      
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3>Connection Status</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: connected ? '#00ff00' : '#ff0000'
            }} />
            <span>{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>

        {error && (
          <div style={{
            padding: '10px',
            backgroundColor: '#ff00001a',
            border: '1px solid #ff0000',
            borderRadius: '4px',
            marginBottom: '15px',
            color: '#ff0000'
          }}>
            {error}
          </div>
        )}

        <div className="card" style={{ backgroundColor: '#2a2a2a', marginBottom: '20px' }}>
          <h4>What is this?</h4>
          <p style={{ marginBottom: '10px' }}>
            The Discord bot helps your viewers:
          </p>
          <ul style={{ marginLeft: '20px', marginBottom: '10px' }}>
            <li>Search and discover available TTS voices</li>
            <li>Learn the Twitch chat commands to customize their voice</li>
            <li>Get help with voice settings (pitch, speed, volume)</li>
          </ul>
          <p style={{ fontSize: '13px', color: '#888' }}>
            <strong>Available Commands:</strong><br />
            ⭐⭐⭐ <code>/searchvoice &lt;query&gt;</code> - Quick search for voices<br />
            ⭐⭐⭐ <code>/findvoice</code> - Advanced filtering with pagination<br />
            ⭐⭐ <code>/randomvoice</code> - Get a random voice suggestion<br />
            ⭐⭐ <code>/providers</code> - Learn about TTS providers<br />
            • <code>/listlanguages</code> - View all available languages<br />
            • <code>/commands</code> - Show Twitch chat commands<br />
            • <code>/help</code> - Full help and examples
          </p>
          <p style={{ fontSize: '13px', color: '#ff9800', marginTop: '10px' }}>
            <strong>⚠️ Note:</strong> Voice settings are tied to Twitch accounts, not Discord accounts. Viewers can check their settings using <code>~myvoice</code> in Twitch chat.
          </p>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Bot Token *
            <span style={{ fontSize: '12px', color: '#888', marginLeft: '5px' }}>
              (From Discord Developer Portal)
            </span>
          </label>
          <input
            type="password"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="Your bot token"
            style={{ width: '100%', padding: '8px' }}
            disabled={connected}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Client ID (Application ID) *
            <span style={{ fontSize: '12px', color: '#888', marginLeft: '5px' }}>
              (From Discord Developer Portal)
            </span>
          </label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Your application ID"
            style={{ width: '100%', padding: '8px' }}
            disabled={connected}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Guild ID (Optional)
            <span style={{ fontSize: '12px', color: '#888', marginLeft: '5px' }}>
              (For instant command updates in a specific server)
            </span>
          </label>
          <input
            type="text"
            value={guildId}
            onChange={(e) => setGuildId(e.target.value)}
            placeholder="Leave empty for global commands (slower)"
            style={{ width: '100%', padding: '8px' }}
            disabled={connected}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {!connected ? (
            <button
              className="primary"
              onClick={handleConnect}
              disabled={loading || !botToken || !clientId}
              style={{ flex: 1 }}
            >
              {loading ? 'Connecting...' : 'Connect Bot'}
            </button>
          ) : (
            <>
              <button
                className="secondary"
                onClick={handleDisconnect}
                disabled={loading}
                style={{ flex: 1 }}
              >
                Disconnect
              </button>
              <button
                className="danger"
                onClick={handleForget}
                disabled={loading}
              >
                Forget Credentials
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <h3>📚 Setup Guide</h3>
        <div style={{ lineHeight: '1.6' }}>
          <h4 style={{ marginTop: '15px' }}>1. Create a Discord Application</h4>
          <ol style={{ marginLeft: '20px' }}>
            <li>Go to <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" style={{ color: '#9146FF' }}>Discord Developer Portal</a></li>
            <li>Click "New Application" and give it a name</li>
            <li>Copy the "Application ID" (this is your Client ID)</li>
          </ol>

          <h4 style={{ marginTop: '15px' }}>2. Create a Bot</h4>
          <ol style={{ marginLeft: '20px' }}>
            <li>In your application, go to the "Bot" section</li>
            <li>Click "Add Bot"</li>
            <li>Click "Reset Token" and copy your bot token</li>
            <li>Enable "Message Content Intent" (under Privileged Gateway Intents)</li>
          </ol>

          <h4 style={{ marginTop: '15px' }}>3. Invite Bot to Your Server</h4>
          <ol style={{ marginLeft: '20px' }}>
            <li>Go to "OAuth2" → "URL Generator"</li>
            <li>Select scopes: <code>bot</code> and <code>applications.commands</code></li>
            <li>Select permissions: <code>Send Messages</code>, <code>Use Slash Commands</code></li>
            <li>Copy the generated URL and open it to invite your bot</li>
          </ol>

          <h4 style={{ marginTop: '15px' }}>4. Get Guild ID (Optional)</h4>
          <ol style={{ marginLeft: '20px' }}>
            <li>Enable Developer Mode in Discord (Settings → Advanced → Developer Mode)</li>
            <li>Right-click your server and select "Copy Server ID"</li>
            <li>Paste this as Guild ID for instant slash command updates</li>
          </ol>

          <p style={{ marginTop: '15px', padding: '10px', backgroundColor: '#2a2a2a', borderRadius: '4px' }}>
            <strong>Note:</strong> Without a Guild ID, slash commands will be global but may take up to 1 hour to update. 
            With a Guild ID, commands update instantly but only work in that specific server.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DiscordBot;
