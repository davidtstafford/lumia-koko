import React, { useState, useEffect } from 'react';

interface ChatMessage {
  id: number;
  viewer_id: string;
  username: string;
  display_name: string;
  message: string;
  timestamp: string;
  badges: string;
  was_read_by_tts: boolean;
}

const ChatHistory: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search and filter state
  const [searchUsername, setSearchUsername] = useState('');
  const [searchMessage, setSearchMessage] = useState('');
  const [selectedViewer, setSelectedViewer] = useState('');
  const [viewers, setViewers] = useState<string[]>([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const messagesPerPage = 50;

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [messages, searchUsername, searchMessage, selectedViewer]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      // Check count first
      const count = await window.electron.invoke('db:getChatHistoryCount');
      console.log(`Database has ${count} messages`);
      
      const result = await window.electron.invoke('db:getChatHistory', 5000, 0);
      console.log(`Loaded ${result.length} messages from database`);
      setMessages(result);
      
      // Extract unique viewers
      const uniqueViewers = Array.from(
        new Set(result.map((m: ChatMessage) => m.username))
      ).sort() as string[];
      setViewers(uniqueViewers);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...messages];

    if (searchUsername) {
      filtered = filtered.filter(m =>
        m.username.toLowerCase().includes(searchUsername.toLowerCase()) ||
        (m.display_name && m.display_name.toLowerCase().includes(searchUsername.toLowerCase()))
      );
    }

    if (searchMessage) {
      filtered = filtered.filter(m =>
        m.message.toLowerCase().includes(searchMessage.toLowerCase())
      );
    }

    if (selectedViewer) {
      filtered = filtered.filter(m => m.username === selectedViewer);
    }

    setFilteredMessages(filtered);
    setCurrentPage(1); // Reset to first page on filter change
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const parseBadges = (badgesJson: string) => {
    try {
      if (!badgesJson) return [];
      const badges = JSON.parse(badgesJson);
      return Object.keys(badges).map(key => key.toUpperCase());
    } catch {
      return [];
    }
  };

  const clearHistory = async () => {
    if (!confirm('Are you sure you want to delete all chat history? This cannot be undone.')) {
      return;
    }

    try {
      await window.electron.invoke('db:clearChatHistory');
      setMessages([]);
      setFilteredMessages([]);
    } catch (error) {
      console.error('Failed to clear history:', error);
      alert('Failed to clear chat history');
    }
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Username', 'Display Name', 'Message', 'Timestamp', 'Badges', 'Read by TTS'];
    const rows = filteredMessages.map(m => [
      m.id,
      m.username,
      m.display_name || '',
      m.message.replace(/"/g, '""'), // Escape quotes
      m.timestamp,
      parseBadges(m.badges).join(' '),
      m.was_read_by_tts ? 'Yes' : 'No'
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-history-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Pagination
  const indexOfLastMessage = currentPage * messagesPerPage;
  const indexOfFirstMessage = indexOfLastMessage - messagesPerPage;
  const currentMessages = filteredMessages.slice(indexOfFirstMessage, indexOfLastMessage);
  const totalPages = Math.ceil(filteredMessages.length / messagesPerPage);

  if (loading) {
    return <div className="loading">Loading chat history...</div>;
  }

  return (
    <div style={{ padding: '2rem', backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: '#fff', margin: 0 }}>Chat History</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={loadMessages} className="refresh-btn">
              🔄 Refresh
            </button>
            <button onClick={exportToCSV} className="export-btn" disabled={filteredMessages.length === 0}>
              📥 Export CSV
            </button>
            <button onClick={clearHistory} className="clear-btn" disabled={messages.length === 0}>
              🗑️ Clear All
            </button>
          </div>
        </div>

        <div className="stats-bar">
          <span>Total Messages: {messages.length}</span>
          <span>Filtered: {filteredMessages.length}</span>
          <span>Page {currentPage} of {totalPages || 1}</span>
        </div>

        <div className="filters-container">
          <input
            type="text"
            placeholder="Search by username..."
            value={searchUsername}
            onChange={(e) => setSearchUsername(e.target.value)}
            className="filter-input"
          />
          <input
            type="text"
            placeholder="Search message content..."
            value={searchMessage}
            onChange={(e) => setSearchMessage(e.target.value)}
            className="filter-input"
          />
          <select
            value={selectedViewer}
            onChange={(e) => setSelectedViewer(e.target.value)}
            className="filter-select"
          >
            <option value="">All Viewers</option>
            {viewers.map(viewer => (
              <option key={viewer} value={viewer}>{viewer}</option>
            ))}
          </select>
          <button
            onClick={() => {
              setSearchUsername('');
              setSearchMessage('');
              setSelectedViewer('');
            }}
            className="clear-filters-btn"
          >
            Clear Filters
          </button>
        </div>

        {currentMessages.length === 0 ? (
          <div className="no-messages">
            {messages.length === 0 ? 'No messages in history yet' : 'No messages match your filters'}
          </div>
        ) : (
          <>
            <div className="messages-table-container">
              <table className="messages-table">
                <thead>
                  <tr>
                    <th style={{ width: '150px' }}>Username</th>
                    <th style={{ width: '100px' }}>Badges</th>
                    <th>Message</th>
                    <th style={{ width: '180px' }}>Timestamp</th>
                    <th style={{ width: '80px' }}>TTS</th>
                  </tr>
                </thead>
                <tbody>
                  {currentMessages.map((msg) => {
                    const badges = parseBadges(msg.badges);
                    return (
                      <tr key={msg.id}>
                        <td>
                          <div className="username-cell">
                            <div className="display-name">{msg.display_name || msg.username}</div>
                            {msg.display_name && (
                              <div className="username-small">@{msg.username}</div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="badges-cell">
                            {badges.map((badge, idx) => (
                              <span key={idx} className={`badge badge-${badge.toLowerCase()}`}>
                                {badge}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="message-cell">{msg.message}</td>
                        <td className="date-cell">{formatDate(msg.timestamp)}</td>
                        <td className="tts-cell">
                          {msg.was_read_by_tts ? '🔊' : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="page-btn"
                >
                  « First
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="page-btn"
                >
                  ‹ Prev
                </button>
                <span className="page-info">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="page-btn"
                >
                  Next ›
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="page-btn"
                >
                  Last »
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .stats-bar {
          display: flex;
          gap: 2rem;
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: #2a2a2a;
          border-radius: 8px;
          color: #aaa;
          font-size: 0.9rem;
        }

        .filters-container {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr auto;
          gap: 10px;
          margin-bottom: 1.5rem;
        }

        .filter-input, .filter-select {
          padding: 0.75rem;
          font-size: 1rem;
          border: 1px solid #444;
          border-radius: 4px;
          background: #2a2a2a;
          color: #fff;
        }

        .clear-filters-btn {
          padding: 0.75rem 1.5rem;
          background: #444;
          color: #fff;
          border: 1px solid #555;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1rem;
        }

        .clear-filters-btn:hover {
          background: #555;
        }

        .refresh-btn, .export-btn, .clear-btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1rem;
        }

        .refresh-btn {
          background: #9147ff;
          color: white;
        }

        .refresh-btn:hover {
          background: #7c3aed;
        }

        .export-btn {
          background: #0ea5e9;
          color: white;
        }

        .export-btn:hover:not(:disabled) {
          background: #0284c7;
        }

        .clear-btn {
          background: #ef4444;
          color: white;
        }

        .clear-btn:hover:not(:disabled) {
          background: #dc2626;
        }

        .export-btn:disabled, .clear-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .messages-table-container {
          overflow-x: auto;
          border: 1px solid #444;
          border-radius: 8px;
          background: #2a2a2a;
        }

        .messages-table {
          width: 100%;
          border-collapse: collapse;
          background: #2a2a2a;
          color: #fff;
        }

        .messages-table thead {
          background: #1a1a1a;
        }

        .messages-table th {
          text-align: left;
          padding: 1rem;
          font-weight: 600;
          border-bottom: 2px solid #444;
          color: #fff;
        }

        .messages-table td {
          padding: 1rem;
          border-bottom: 1px solid #333;
          color: #fff;
        }

        .messages-table tbody tr:hover {
          background: #333;
        }

        .username-cell {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .display-name {
          font-weight: 500;
        }

        .username-small {
          font-size: 0.85rem;
          color: #999;
        }

        .badges-cell {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .badge {
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: bold;
          color: white;
        }

        .badge-moderator, .badge-mod {
          background: #00ad03;
        }

        .badge-vip {
          background: #e005b9;
        }

        .badge-subscriber, .badge-sub {
          background: #9147ff;
        }

        .badge-broadcaster {
          background: #e91916;
        }

        .badge-premium {
          background: #0ea5e9;
        }

        .message-cell {
          word-break: break-word;
        }

        .date-cell {
          color: #aaa;
          font-size: 0.9rem;
          white-space: nowrap;
        }

        .tts-cell {
          text-align: center;
          font-size: 1.2rem;
        }

        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          margin-top: 1.5rem;
          padding: 1rem;
          background: #2a2a2a;
          border-radius: 8px;
        }

        .page-btn {
          padding: 0.5rem 1rem;
          background: #444;
          color: #fff;
          border: 1px solid #555;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
        }

        .page-btn:hover:not(:disabled) {
          background: #555;
        }

        .page-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .page-info {
          color: #aaa;
          font-size: 0.9rem;
        }

        .loading, .no-messages {
          text-align: center;
          padding: 3rem;
          font-size: 1.2rem;
          color: #aaa;
        }
      `}</style>
    </div>
  );
};

export default ChatHistory;
