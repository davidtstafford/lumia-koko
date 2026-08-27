import React, { useState, useEffect } from 'react';

interface Viewer {
  id: string;
  lumia_id?: string;
  username: string;
  display_name: string;
  is_moderator: boolean;
  message_count: number;
  first_seen_at?: string;
  last_seen_at?: string;
}

const Viewers: React.FC = () => {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [filteredViewers, setFilteredViewers] = useState<Viewer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'moderators'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [ttsStatsMap, setTtsStatsMap] = useState<Map<string, { tts_count: number }>>(new Map());

  useEffect(() => { loadViewers(); }, []);
  useEffect(() => { applyFilters(); }, [viewers, searchTerm, filter]);

  const loadViewers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data: Viewer[] = await window.api.invoke('db:getViewers');
      setViewers(data || []);
      try {
        const ttsRows = await window.api.invoke('db:query',
          'SELECT viewer_id, COALESCE(tts_count, 0) as tts_count FROM viewer_tts_restrictions'
        );
        setTtsStatsMap(new Map((ttsRows ?? []).map((r: any) => [r.viewer_id, r])));
      } catch { /* non-fatal */ }
    } catch {
      setError('Failed to load viewers');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...viewers];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(v =>
        v.display_name.toLowerCase().includes(term) ||
        v.username.toLowerCase().includes(term)
      );
    }
    if (filter === 'moderators') filtered = filtered.filter(v => v.is_moderator);
    filtered.sort((a, b) => {
      if (!a.last_seen_at) return 1;
      if (!b.last_seen_at) return -1;
      return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
    });
    setFilteredViewers(filtered);
  };

  const formatDate = (d?: string) => {
    if (!d) return 'Never';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(d).toLocaleDateString();
  };

  const handleToggleMod = async (viewer: Viewer) => {
    const newStatus = !viewer.is_moderator;
    try {
      setActionLoading(`mod-${viewer.id}`);
      await window.api.invoke('db:setViewerModStatus', viewer.id, newStatus);
      setViewers(prev => prev.map(v => v.id === viewer.id ? { ...v, is_moderator: newStatus } : v));
    } catch { alert('Failed to update moderator status'); }
    finally { setActionLoading(null); }
  };

  if (loading) return <div className="page"><p>Loading viewers...</p></div>;

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Viewers</h2>
        <button className="secondary" onClick={loadViewers}>🔄 Refresh</button>
      </div>

      {error && (
        <div style={{ padding: 12, backgroundColor: '#3a1a1a', borderRadius: 6, marginBottom: 16, color: '#ff6b6b' }}>
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search by name or username..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'moderators'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '8px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                backgroundColor: filter === f ? '#9147ff' : '#353535', color: 'white', fontSize: 13
              }}>
                {f === 'all' ? `All (${viewers.length})` : `Mods (${viewers.filter(v => v.is_moderator).length})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: '#1a1a1a', borderBottom: '1px solid #404040' }}>
                <th style={thStyle}>Viewer</th>
                <th style={thStyle}>Messages</th>
                <th style={thStyle}>TTS</th>
                <th style={thStyle}>Last Seen</th>
                <th style={thStyle}>Mod</th>
              </tr>
            </thead>
            <tbody>
              {filteredViewers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#888' }}>
                    {viewers.length === 0
                      ? 'No viewers yet. Viewers are added automatically when they chat.'
                      : 'No viewers match your search.'}
                  </td>
                </tr>
              ) : filteredViewers.map(viewer => {
                const tts = ttsStatsMap.get(viewer.id);
                const showUsername = viewer.username.toLowerCase() !== viewer.display_name.toLowerCase();
                return (
                  <tr key={viewer.id} style={{ borderBottom: '1px solid #333' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{viewer.display_name}</div>
                      {showUsername && (
                        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>@{viewer.username}</div>
                      )}
                      {viewer.lumia_id && (
                        <div style={{
                          display: 'inline-block', marginTop: 3, padding: '1px 6px',
                          borderRadius: 8, fontSize: 10, backgroundColor: '#2a2a2a', color: '#666',
                          fontFamily: 'monospace',
                        }}>
                          {viewer.lumia_id.slice(0, 8)}…
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>{viewer.message_count ?? 0}</td>
                    <td style={tdStyle}>{tts?.tts_count ?? 0}</td>
                    <td style={tdStyle}>{formatDate(viewer.last_seen_at)}</td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => handleToggleMod(viewer)}
                        disabled={actionLoading === `mod-${viewer.id}`}
                        style={{
                          padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer',
                          fontSize: 12, fontWeight: 600,
                          backgroundColor: viewer.is_moderator ? '#9147ff' : '#353535',
                          color: 'white', opacity: actionLoading === `mod-${viewer.id}` ? 0.5 : 1
                        }}
                      >
                        {viewer.is_moderator ? '⚔️ Mod' : 'Set Mod'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontWeight: 600,
  color: '#aaa', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em'
};

const tdStyle: React.CSSProperties = {
  padding: '10px 14px', color: '#ccc', verticalAlign: 'middle'
};

export default Viewers;
