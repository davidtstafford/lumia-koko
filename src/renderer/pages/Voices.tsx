import React, { useState, useEffect } from 'react';

interface KokoroVoice {
  voice_id: string;
  name: string;
  language_code: string;
  language_name: string;
  gender?: string;
  is_custom: boolean;
  is_available: boolean;
  description?: string;
}

const Voices: React.FC = () => {
  const [voices, setVoices] = useState<KokoroVoice[]>([]);
  const [filter, setFilter] = useState('');
  const [langFilter, setLangFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [showCustomOnly, setShowCustomOnly] = useState(false);

  // Add custom voice form
  const [showForm, setShowForm] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newLang, setNewLang] = useState('en-US');
  const [newLangName, setNewLangName] = useState('American English');
  const [newGender, setNewGender] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { loadVoices(); }, []);

  const loadVoices = async () => {
    const data = await window.api.invoke('db:getAllVoices');
    setVoices(data ?? []);
  };

  const languages = ['all', ...Array.from(new Set((voices ?? []).map(v => v.language_name))).sort()];
  const genders   = ['all', 'female', 'male'];

  const filtered = (voices ?? []).filter(v => {
    if (showCustomOnly && !v.is_custom) return false;
    if (langFilter !== 'all' && v.language_name !== langFilter) return false;
    if (genderFilter !== 'all' && v.gender !== genderFilter) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return v.voice_id.toLowerCase().includes(q) || v.name.toLowerCase().includes(q);
    }
    return true;
  });

  const handleAddCustom = async () => {
    if (!newId.trim() || !newName.trim()) {
      setMessage({ type: 'error', text: 'Voice ID and Name are required.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await window.api.invoke('db:addCustomVoice', {
        voice_id:      newId.trim(),
        name:          newName.trim(),
        language_code: newLang.trim(),
        language_name: newLangName.trim(),
        gender:        newGender || undefined,
        description:   newDesc.trim() || undefined,
        is_available:  true,
      });

      setMessage({ type: 'success', text: `Custom voice "${newId}" added.` });
      setNewId(''); setNewName(''); setNewGender(''); setNewDesc('');
      setShowForm(false);
      await loadVoices();
    } catch (err) {
      setMessage({ type: 'error', text: String(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveCustom = async (voiceId: string) => {
    if (!confirm(`Remove custom voice "${voiceId}"?`)) return;
    await window.api.invoke('db:removeCustomVoice', voiceId);
    await loadVoices();
  };

  const genderIcon = (g?: string) => g === 'female' ? '♀️' : g === 'male' ? '♂️' : '';

  return (
    <div className="page">
      <h2>Kokoro Voices</h2>

      <div className="card">
        <p style={{ fontSize: 13, color: '#aaa' }}>
          Stream Koko uses <strong>Kokoro AI</strong> voices — 100% offline, no API keys.
          Viewers set their voice in Twitch chat with <code>~setvoice &lt;voice_id&gt;</code>.
        </p>
      </div>

      {/* Filters */}
      <div className="card" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text" value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search name or ID…"
          style={{ flex: 1, minWidth: 150 }}
        />
        <select value={langFilter} onChange={e => setLangFilter(e.target.value)}>
          {languages.map(l => <option key={l} value={l}>{l === 'all' ? 'All Languages' : l}</option>)}
        </select>
        <select value={genderFilter} onChange={e => setGenderFilter(e.target.value)}>
          {genders.map(g => <option key={g} value={g}>{g === 'all' ? 'All Genders' : g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={showCustomOnly} onChange={e => setShowCustomOnly(e.target.checked)} />
          Custom only
        </label>
        <span style={{ fontSize: 13, color: '#888' }}>{filtered.length} voice{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Voice table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1a1a1a', textAlign: 'left' }}>
              <th style={{ padding: '10px 14px' }}>Voice ID</th>
              <th style={{ padding: '10px 14px' }}>Name</th>
              <th style={{ padding: '10px 14px' }}>Language</th>
              <th style={{ padding: '10px 14px' }}>Gender</th>
              <th style={{ padding: '10px 14px' }}>Notes</th>
              <th style={{ padding: '10px 14px' }}>Command</th>
              <th style={{ padding: '10px 14px' }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v, i) => (
              <tr key={v.voice_id} style={{ background: i % 2 === 0 ? '#252525' : '#1e1e1e' }}>
                <td style={{ padding: '8px 14px', fontFamily: 'monospace', color: '#9147ff' }}>{v.voice_id}</td>
                <td style={{ padding: '8px 14px' }}>{v.name}{v.is_custom ? ' ⭐' : ''}</td>
                <td style={{ padding: '8px 14px' }}>{v.language_name}</td>
                <td style={{ padding: '8px 14px' }}>{genderIcon(v.gender)}</td>
                <td style={{ padding: '8px 14px', color: '#888' }}>{v.description}</td>
                <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 12, color: '#aaa' }}>~setvoice {v.voice_id}</td>
                <td style={{ padding: '8px 14px' }}>
                  {v.is_custom && (
                    <button className="secondary" style={{ padding: '3px 8px', fontSize: 11 }}
                      onClick={() => handleRemoveCustom(v.voice_id)}>Remove</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>No voices match the current filters.</div>
        )}
      </div>

      {/* Add custom voice */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Add Custom Voice</h3>
          <button className="secondary" onClick={() => setShowForm(!showForm)}>
            {showForm ? '▲ Hide' : '▼ Show'}
          </button>
        </div>

        {showForm && (
          <>
            <div className="card" style={{ background: '#2a2a2a' }}>
              <p style={{ fontSize: 13, color: '#aaa', marginBottom: 12 }}>
                Kokoro supports custom voice blending using voice IDs.
                If you have a custom Kokoro voice ID (from a fine-tuned model or a voice blend), add it here.
                The voice ID must be valid for your installed Kokoro model version.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Voice ID *</label>
                  <input type="text" value={newId} onChange={e => setNewId(e.target.value)} placeholder="e.g. af_custom_01" />
                </div>
                <div>
                  <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Display Name *</label>
                  <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. My Custom Voice" />
                </div>
                <div>
                  <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Language Code</label>
                  <input type="text" value={newLang} onChange={e => setNewLang(e.target.value)} placeholder="e.g. en-US" />
                </div>
                <div>
                  <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Language Name</label>
                  <input type="text" value={newLangName} onChange={e => setNewLangName(e.target.value)} placeholder="e.g. American English" />
                </div>
                <div>
                  <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Gender</label>
                  <select value={newGender} onChange={e => setNewGender(e.target.value)}>
                    <option value="">Not specified</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Description</label>
                  <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional notes" />
                </div>
              </div>

              {message && (
                <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 4, fontSize: 13,
                  background: message.type === 'success' ? '#00330022' : '#33000022',
                  border: `1px solid ${message.type === 'success' ? '#00ff00' : '#ff4444'}`,
                  color: message.type === 'success' ? '#00ff00' : '#ff4444' }}>
                  {message.text}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
                <button className="primary" onClick={handleAddCustom} disabled={saving}>
                  {saving ? '⏳ Saving…' : '+ Add Voice'}
                </button>
                <button className="secondary" onClick={() => { setShowForm(false); setMessage(null); }}>Cancel</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Voices;
