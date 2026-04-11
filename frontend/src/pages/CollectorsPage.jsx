import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Phone, Mail, X } from 'lucide-react';

const EMPTY_FORM = { first_name:'', last_name:'', employment_type:'contractor', status:'active', phone:'', email:'', abn:'' };

const initials = (first, last) => {
  const f = (first||'').trim()[0] || '';
  const l = (last||'').trim()[0] || '';
  return (f + l).toUpperCase() || '?';
};

const fullName = (c) => [c.first_name, c.last_name].filter(Boolean).join(' ') || '—';

export default function CollectorsPage() {
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [runsheet, setRunsheet] = useState([]);
  const [runsheetTab, setRunsheetTab] = useState('profile'); // 'profile' | 'runsheet'

  const fetchCollectors = async () => {
    try {
      const { data, error } = await supabase
        .from('collectors')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) { setError(error.message); } else { setCollectors(data || []); }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollectors();
    const ch = supabase.channel('collectors-page')
      .on('postgres_changes', { event:'*', schema:'public', table:'collectors' }, fetchCollectors)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    setSaving(true);
    await supabase.from('collectors').insert(form);
    setSaving(false);
    setShowInvite(false);
    setForm(EMPTY_FORM);
  };

  const openProfile = async (c) => {
    setSelected(c);
    setEditForm({ ...c });
    setRunsheetTab('profile');
    // Load bookings assigned to this collector
    const { data } = await supabase
      .from('patient_bookings')
      .select('id, first_name, last_name, service_type, scheduled_date, scheduled_time, status, amount_charged')
      .eq('collector_id', c.id)
      .order('scheduled_date', { ascending: false });
    setRunsheet(data || []);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    await supabase.from('collectors').update(editForm).eq('id', selected.id);
    setSaving(false);
    setSelected(null);
  };

  const TIME_LABELS = {
    'morning-early':'7–9 AM','morning-late':'9–11 AM',
    'afternoon-early':'11 AM–1 PM','afternoon-late':'1–3 PM','evening':'3–5 PM'
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Collectors</div>
          <div className="page-subtitle">{collectors.filter(c=>c.status==='active').length} active</div>
        </div>
        <button className="btn-mint" onClick={() => setShowInvite(true)}><Plus size={14} /> Invite Collector</button>
      </div>

      {error && (
        <div style={{ padding:'16px', marginBottom:16, background:'rgba(244,67,54,0.08)', border:'1px solid rgba(244,67,54,0.2)', borderRadius:8, color:'var(--danger)', fontSize:13 }}>
          Could not load collectors: {error}
        </div>
      )}
      {loading ? <div className="empty-state">Loading…</div> : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:16 }}>
          {collectors.map(c => (
            <div key={c.id} className="collector-card" onClick={() => openProfile(c)}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                <div className="collector-avatar">{initials(c.first_name, c.last_name)}</div>
                <div>
                  <div style={{ fontWeight:500, fontSize:14 }}>{fullName(c)}</div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
                    <span className={`badge badge-${c.employment_type==='employee'?'accent':'neutral'}`} style={{ fontSize:10 }}>{c.employment_type||'contractor'}</span>
                    {' '}
                    <span className={`badge badge-${c.status==='active'?'success':'neutral'}`} style={{ fontSize:10 }}>{c.status}</span>
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:12, color:'var(--muted)' }}>
                {c.phone && <span style={{ display:'flex', alignItems:'center', gap:6 }}><Phone size={11} />{c.phone}</span>}
                {c.email && <span style={{ display:'flex', alignItems:'center', gap:6 }}><Mail size={11} />{c.email}</span>}
              </div>
              {c.abn && (
                <div style={{ marginTop:10, fontSize:11, color:'var(--muted)' }}>ABN: {c.abn}</div>
              )}
            </div>
          ))}
          {collectors.length === 0 && <div className="empty-state" style={{ gridColumn:'1/-1' }}>No collectors yet. Invite one to get started.</div>}
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowInvite(false)}>
          <div className="modal-card">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
              <div className="modal-title" style={{ marginBottom:0 }}>Invite Collector</div>
              <button className="btn-ghost" onClick={()=>setShowInvite(false)} style={{ padding:'4px 8px' }}><X size={14} /></button>
            </div>
            <form onSubmit={handleInvite}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div>
                  <label className="nura-label">First Name *</label>
                  <input className="nura-input" value={form.first_name} onChange={e=>setForm(p=>({...p,first_name:e.target.value}))} required />
                </div>
                <div>
                  <label className="nura-label">Last Name *</label>
                  <input className="nura-input" value={form.last_name} onChange={e=>setForm(p=>({...p,last_name:e.target.value}))} required />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div>
                  <label className="nura-label">Type</label>
                  <select className="nura-select" value={form.employment_type} onChange={e=>setForm(p=>({...p,employment_type:e.target.value}))}>
                    <option value="contractor">Contractor</option>
                    <option value="employee">Employee</option>
                  </select>
                </div>
                <div>
                  <label className="nura-label">Status</label>
                  <select className="nura-select" value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom:12 }}>
                <label className="nura-label">Phone</label>
                <input className="nura-input" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} />
              </div>
              <div style={{ marginBottom:12 }}>
                <label className="nura-label">Email</label>
                <input className="nura-input" type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} />
              </div>
              <div style={{ marginBottom:20 }}>
                <label className="nura-label">ABN</label>
                <input className="nura-input" placeholder="XX XXX XXX XXX" value={form.abn} onChange={e=>setForm(p=>({...p,abn:e.target.value}))} />
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={()=>setShowInvite(false)}>Cancel</button>
                <button type="submit" className="btn-mint" disabled={saving}>{saving?'Saving…':'Add Collector'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile modal */}
      {selected && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setSelected(null)}>
          <div className="modal-card" style={{ maxWidth:560 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div className="collector-avatar" style={{ width:48,height:48,fontSize:17 }}>{initials(selected.first_name, selected.last_name)}</div>
                <div>
                  <div className="modal-title" style={{ marginBottom:2 }}>{fullName(selected)}</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{selected.email}</div>
                </div>
              </div>
              <button className="btn-ghost" onClick={()=>setSelected(null)} style={{ padding:'4px 8px' }}><X size={14} /></button>
            </div>

            <div className="tab-bar" style={{ marginBottom:18 }}>
              <button className={`tab-item${runsheetTab==='profile'?' active':''}`} onClick={()=>setRunsheetTab('profile')}>Profile</button>
              <button className={`tab-item${runsheetTab==='runsheet'?' active':''}`} onClick={()=>setRunsheetTab('runsheet')}>Runsheet ({runsheet.length})</button>
            </div>

            {runsheetTab === 'profile' ? (
              <form onSubmit={handleUpdate}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label className="nura-label">First Name</label>
                    <input className="nura-input" value={editForm.first_name||''} onChange={e=>setEditForm(p=>({...p,first_name:e.target.value}))} />
                  </div>
                  <div>
                    <label className="nura-label">Last Name</label>
                    <input className="nura-input" value={editForm.last_name||''} onChange={e=>setEditForm(p=>({...p,last_name:e.target.value}))} />
                  </div>
                  <div>
                    <label className="nura-label">Email</label>
                    <input className="nura-input" value={editForm.email||''} onChange={e=>setEditForm(p=>({...p,email:e.target.value}))} />
                  </div>
                  <div>
                    <label className="nura-label">Phone</label>
                    <input className="nura-input" value={editForm.phone||''} onChange={e=>setEditForm(p=>({...p,phone:e.target.value}))} />
                  </div>
                  <div>
                    <label className="nura-label">Type</label>
                    <select className="nura-select" value={editForm.employment_type||'contractor'} onChange={e=>setEditForm(p=>({...p,employment_type:e.target.value}))}>
                      <option value="contractor">Contractor</option>
                      <option value="employee">Employee</option>
                    </select>
                  </div>
                  <div>
                    <label className="nura-label">Status</label>
                    <select className="nura-select" value={editForm.status||'active'} onChange={e=>setEditForm(p=>({...p,status:e.target.value}))}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label className="nura-label">ABN</label>
                    <input className="nura-input" value={editForm.abn||''} onChange={e=>setEditForm(p=>({...p,abn:e.target.value}))} />
                  </div>
                </div>
                <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
                  <button type="button" className="btn-ghost" onClick={()=>setSelected(null)}>Cancel</button>
                  <button type="submit" className="btn-mint" disabled={saving}>{saving?'Saving…':'Save Changes'}</button>
                </div>
              </form>
            ) : (
              <div>
                {runsheet.length === 0 ? (
                  <div className="empty-state" style={{ padding:'24px 0' }}>No bookings assigned yet</div>
                ) : (
                  <table className="nura-table">
                    <thead><tr>
                      <th>Patient</th><th>Service</th><th>Date</th><th>Time</th><th>Status</th><th>Amount</th>
                    </tr></thead>
                    <tbody>
                      {runsheet.map(b => (
                        <tr key={b.id}>
                          <td style={{ fontWeight:500, fontSize:12 }}>{b.first_name} {b.last_name}</td>
                          <td style={{ fontSize:11, color:'var(--muted)' }}>{b.service_type}</td>
                          <td style={{ fontSize:11 }}>{b.scheduled_date}</td>
                          <td style={{ fontSize:11, color:'var(--muted)' }}>{TIME_LABELS[b.scheduled_time]||b.scheduled_time||'—'}</td>
                          <td><span className={`badge badge-${b.status==='completed'?'success':b.status==='confirmed'?'accent':'warning'}`} style={{ fontSize:10 }}>{b.status}</span></td>
                          <td style={{ fontSize:12, color:'var(--accent)' }}>${parseFloat(b.amount_charged||0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
                  <button className="btn-ghost" onClick={()=>setSelected(null)}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
