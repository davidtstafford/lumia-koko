import React, { useState, useEffect } from 'react';

interface Command {
  name: string;
  permission: string;
  description: string;
  usage: string;
  rateLimit: number;
}

const Commands: React.FC = () => {
  const [commands] = useState<Command[]>([
    {
      name: 'help',
      permission: 'Viewer',
      description: 'List all commands, or get details on a specific one.',
      usage: '~help [command]',
      rateLimit: 5
    },
    {
      name: 'hello',
      permission: 'Viewer',
      description: 'Say hello and get a tip about Lumia Koko.',
      usage: '~hello',
      rateLimit: 5
    },
    {
      name: 'voices',
      permission: 'Viewer',
      description: 'List available TTS voices. Optional search term filters by name or language.',
      usage: '~voices [search]',
      rateLimit: 10
    },
    {
      name: 'setvoice',
      permission: 'Viewer',
      description: 'Set your personal TTS voice. Use ~voices to browse available IDs.',
      usage: '~setvoice <voice_id>',
      rateLimit: 5
    },
    {
      name: 'setvoicespeed',
      permission: 'Viewer',
      description: 'Set your TTS speed. 1.0 is normal, 0.5 is half speed, 2.0 is double.',
      usage: '~setvoicespeed <0.25–4.0>',
      rateLimit: 5
    },
    {
      name: 'setvolume',
      permission: 'Viewer',
      description: 'Set your TTS volume as a percentage of the master volume. Cannot exceed 100%.',
      usage: '~setvolume <0–100>',
      rateLimit: 5
    },
    {
      name: 'randomvoice',
      permission: 'Viewer',
      description: 'Assign yourself a completely random TTS voice.',
      usage: '~randomvoice',
      rateLimit: 10
    },
    {
      name: 'myvoice',
      permission: 'Viewer',
      description: 'Show your current voice, speed and volume settings.',
      usage: '~myvoice',
      rateLimit: 5
    },
    {
      name: 'resetvoice',
      permission: 'Viewer',
      description: 'Reset your voice, speed and volume back to the stream defaults.',
      usage: '~resetvoice',
      rateLimit: 5
    },
    {
      name: 'skip',
      permission: 'Moderator',
      description: 'Skip the currently-playing TTS message.',
      usage: '~skip',
      rateLimit: 0
    },
    {
      name: 'mutevoice',
      permission: 'Moderator',
      description: 'Silence a viewer\'s TTS. Optional minutes duration; omit for permanent.',
      usage: '~mutevoice <user> [mins]',
      rateLimit: 0
    },
    {
      name: 'unmutevoice',
      permission: 'Moderator',
      description: 'Re-enable TTS for a muted viewer.',
      usage: '~unmutevoice <user>',
      rateLimit: 0
    },
    {
      name: 'cooldownvoice',
      permission: 'Moderator',
      description: 'Set a minimum gap between TTS messages for a viewer. Default: 30s.',
      usage: '~cooldownvoice <user> [secs]',
      rateLimit: 0
    },
    {
      name: 'uncooldownvoice',
      permission: 'Moderator',
      description: 'Remove the per-viewer TTS cooldown.',
      usage: '~uncooldownvoice <user>',
      rateLimit: 0
    },
    {
      name: 'mutetts',
      permission: 'Moderator',
      description: 'Pause TTS globally — no messages are read until unmuted.',
      usage: '~mutetts',
      rateLimit: 0
    },
    {
      name: 'unmutetts',
      permission: 'Moderator',
      description: 'Resume global TTS after ~mutetts.',
      usage: '~unmutetts',
      rateLimit: 0
    },
    {
      name: 'clearqueue',
      permission: 'Moderator',
      description: 'Flush the entire TTS queue immediately.',
      usage: '~clearqueue',
      rateLimit: 0
    }
  ]);

  const getPermissionColor = (permission: string) => {
    switch (permission.toLowerCase()) {
      case 'viewer':
        return '#28a745';
      case 'moderator':
        return '#ffc107';
      case 'broadcaster':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      <h1 style={{ color: '#fff' }}>Chat Commands</h1>

      <div style={{
        padding: '15px',
        backgroundColor: '#2a4a6a',
        borderRadius: '8px',
        marginBottom: '20px',
        color: '#a8d8ff'
      }}>
        <strong>ℹ️ Command Prefix:</strong> All commands use the <code>~</code> prefix (e.g., <code>~hello</code>)
        <br />
        <strong>📝 Note:</strong> All command arguments are case-insensitive (usernames, voice names, etc.)
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
        gap: '20px',
        marginTop: '20px'
      }}>
        {commands.map(cmd => (
          <div
            key={cmd.name}
            style={{
              border: '1px solid #444',
              borderRadius: '8px',
              padding: '15px',
              backgroundColor: '#2a2a2a'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>
                <code style={{ backgroundColor: '#1a1a1a', padding: '4px 8px', borderRadius: '4px', color: '#9147ff' }}>
                  {cmd.usage}
                </code>
              </h3>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: 'white',
                  backgroundColor: getPermissionColor(cmd.permission)
                }}
              >
                {cmd.permission}
              </span>
            </div>

            <p style={{ color: '#ccc', margin: '10px 0' }}>
              {cmd.description}
            </p>

            {cmd.rateLimit > 0 && (
              <div style={{
                fontSize: '12px',
                color: '#999',
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '1px solid #444'
              }}>
                ⏱️ Rate limit: {cmd.rateLimit}s per user
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#2a2a2a',
        borderRadius: '8px',
        border: '1px solid #444'
      }}>
        <h2 style={{ marginTop: 0, color: '#fff' }}>Permission Levels</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              width: '100px',
              padding: '6px 12px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 'bold',
              color: 'white',
              backgroundColor: getPermissionColor('viewer'),
              textAlign: 'center'
            }}>
              Viewer
            </span>
            <span style={{ color: '#ccc' }}>Anyone in chat can use these commands</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              width: '100px',
              padding: '6px 12px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 'bold',
              color: 'white',
              backgroundColor: getPermissionColor('moderator'),
              textAlign: 'center'
            }}>
              Moderator
            </span>
            <span style={{ color: '#ccc' }}>Only moderators and the broadcaster can use these commands</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              width: '100px',
              padding: '6px 12px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 'bold',
              color: 'white',
              backgroundColor: getPermissionColor('broadcaster'),
              textAlign: 'center'
            }}>
              Broadcaster
            </span>
            <span style={{ color: '#ccc' }}>Only the broadcaster can use these commands</span>
          </div>
        </div>
      </div>

      <div style={{
        marginTop: '20px',
        padding: '20px',
        backgroundColor: '#3a3520',
        borderRadius: '8px',
        border: '1px solid #ffc107',
        color: '#ffd54f'
      }}>
        <strong>💡 Examples:</strong>
        <ul style={{ marginTop: '10px', marginBottom: 0 }}>
          <li><code>~setvoice af_bella</code> — switch to Bella (American English female)</li>
          <li><code>~setvoicespeed 1.5</code> — speed up to 1.5×</li>
          <li><code>~setvolume 75</code> — set volume to 75% of master</li>
          <li><code>~randomvoice</code> — get assigned a random voice</li>
          <li><code>~myvoice</code> — check your current voice settings</li>
          <li><code>~resetvoice</code> — go back to stream defaults</li>
          <li><code>~skip</code> — (mod) skip whatever is currently playing</li>
          <li><code>~mutevoice trolluser 30</code> — (mod) mute a viewer for 30 minutes</li>
        </ul>
      </div>
    </div>
  );
};

export default Commands;
