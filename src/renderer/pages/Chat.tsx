import React, { useState, useEffect, useRef } from 'react';

interface ChatMessage {
  id?: number;
  viewer_id: string;
  username: string;
  display_name?: string;
  message: string;
  timestamp: string;
  badges?: string;
  was_read_by_tts?: boolean;
}

interface ChatProps {
  messages: ChatMessage[];
  onClearMessages: () => void;
}

const Chat: React.FC<ChatProps> = ({ messages, onClearMessages }) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  const handleClearChat = () => {
    if (confirm('Clear all messages from this session? (History will remain in database)')) {
      onClearMessages();
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const parseBadges = (badgesStr?: string): string[] => {
    if (!badgesStr) return [];
    try {
      const badges = JSON.parse(badgesStr);
      return Object.keys(badges);
    } catch {
      return [];
    }
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Live Chat</h2>
        <div>
          <label style={{ marginRight: '15px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              style={{ marginRight: '5px' }}
            />
            Auto-scroll
          </label>
          <button className="secondary" onClick={handleClearChat}>
            Clear Chat
          </button>
        </div>
      </div>

      <div 
        className="card" 
        ref={containerRef}
        style={{ 
          height: 'calc(100vh - 200px)', 
          overflow: 'auto',
          padding: '10px'
        }}
      >
        {messages.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            color: '#888', 
            padding: '40px',
            fontSize: '14px'
          }}>
            No messages yet. Connect to Lumia Stream to see chat messages.
          </div>
        ) : (
          <div>
            {messages.map((msg, index) => (
              <div 
                key={index}
                style={{ 
                  padding: '8px 10px',
                  borderBottom: '1px solid #333',
                  display: 'flex',
                  gap: '10px',
                  fontSize: '14px'
                }}
              >
                <span style={{ color: '#666', minWidth: '50px', flexShrink: 0 }}>
                  {formatTime(msg.timestamp)}
                </span>
                
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  {parseBadges(msg.badges).map(badge => (
                    <span 
                      key={badge}
                      style={{ 
                        backgroundColor: '#9147ff',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '11px',
                        textTransform: 'uppercase'
                      }}
                    >
                      {badge}
                    </span>
                  ))}
                </div>
                
                <span style={{ 
                  color: '#9147ff', 
                  fontWeight: 'bold',
                  minWidth: '100px',
                  flexShrink: 0
                }}>
                  {msg.display_name || msg.username}
                </span>
                
                <span style={{ color: '#fff', wordBreak: 'break-word' }}>
                  {msg.message}
                </span>
                
                {msg.was_read_by_tts && (
                  <span style={{ marginLeft: 'auto', flexShrink: 0 }}>🔊</span>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
