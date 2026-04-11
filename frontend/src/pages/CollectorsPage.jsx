import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Phone, Mail, X } from 'lucide-react';

const EMPTY_FORM = { name:'', type:'contractor', status:'active', phone:'', email:'', document_expiry:'' };

const initials = (name) => name.split(' ').map(w=>w[0]||'').join('').toUpperCase().slice(0,2);

export default function CollectorsPage() {
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchCollectors = async () => {
    const { data } = await supabase.from('collectors').select('*').order('created_at', { ascending:false });
    setCollectors(data || []);
    setLoading(false);
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

  const openProfile = (c) => { setSelected(c); setEditForm({ ...c }); };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    await supabase.from('collectors').update(editForm).eq('id', selected.id);
    setSaving(false);
    setSelected(null);
  };

  const docExpiryStatus = (date) => {
    if (!date) return null;
    const days = Math.ceil((new Date(date) - new Date()) / 86400000);
    if (days < 0) return <span className="badge badge-danger">Expired</span>;
    if (days <= 30) return <span className="badge badge-warning">Expiring in {days}d</span>;
    return <span className="badge badge-success">Valid</span>;
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

      {loading ? <div className="empty-state">Loading…</div> : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:16 }}>
          {collectors.map(c => (
            <div key={c.id} className="collector-card" onClick={() => openProfile(c)}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                <div className="collector-avatar">{initials(c.name)}</div>
                <div>
                  <div style={{ fontWeight:500, fontSize:14 }}>{c.name}</div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
                    <span className={`badge badge-${c.type==='employee'?'accent':'neutral'}`} style={{ fontSize:10 }}>{c.type}</span>
                    {' '}
                    <span className={`badge badge-${c.status==='active'?'success':'neutral'}`} style={{ fontSize:10 }}>{c.status}</span>
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:12, color:'var(--muted)' }}>
                {c.phone && <span style={{ display:'flex', alignItems:'center', gap:6 }}><Phone size={11} />{c.phone}</span>}
                {c.email && <span style={{ display:'flex', alignItems:'center', gap:6 }}><Mail size={11} />{c.email}</span>}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:14, paddingTop:12, borderTop:'1px solid var(--border2)', fontSize:12 }}>
                <span style={{ color:'var(--muted)' }}>Runs: <strong style={{ color:'var(--text)' }}>{c.runs_total||0}</strong></span>
                <span style={{ color:'var(--muted)' }}>This month: <strong style={{ color:'var(--accent)' }}>${(c.earnings_month||0).toFixed(0)}</strong></span>
              </div>
              {c.document_expiry && (
                <div style={{ marginTop:10 }}>{docExpiryStatus(c.document_expiry)}</div>
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
              <div style={{ marginBottom:12 }}>
                <label className="nura-label">Full Name *</label>
                <input className="nura-input" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} required />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div>
                  <label className="nura-label">Type</label>
                  <select className="nura-select" value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
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
                <label className="nura-label">Document Expiry</label>
                <input className="nura-input" type="date" value={form.document_expiry} onChange={e=>setForm(p=>({...p,document_expiry:e.target.value}))} />
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
          <div className="modal-card" style={{ maxWidth:520 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div className="collector-avatar" style={{ width:48,height:48,fontSize:17 }}>{initials(selected.name)}</div>
                <div>
                  <div className="modal-title" style={{ marginBottom:2 }}>{selected.name}</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{selected.email}</div>
                </div>
              </div>
              <button className="btn-ghost" onClick={()=>setSelected(null)} style={{ padding:'4px 8px' }}><X size={14} /></button>
            </div>
            <form onSubmit={handleUpdate}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[['name','Full Name'],['email','Email'],['phone','Phone']].map(([f,l])=>(
                  <div key={f} style={{ gridColumn: f==='name'?'1/-1':'auto' }}>
                    <label className="nura-label">{l}</label>
                    <input className="nura-input" value={editForm[f]||''} onChange={e=>setEditForm(p=>({...p,[f]:e.target.value}))} />
                  </div>
                ))}
                <div>
                  <label className="nura-label">Type</label>
                  <select className="nura-select" value={editForm.type||'contractor'} onChange={e=>setEditForm(p=>({...p,type:e.target.value}))}>
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
                  <label className="nura-label">Document Expiry</label>
                  <input className="nura-input" type="date" value={editForm.document_expiry||''} onChange={e=>setEditForm(p=>({...p,document_expiry:e.target.value}))} />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12, padding:'12px', background:'var(--card2)', borderRadius:8 }}>
                <div style={{ fontSize:12 }}><div className="nura-label">Total Runs</div><strong style={{ color:'var(--accent)' }}>{selected.runs_total||0}</strong></div>
                <div style={{ fontSize:12 }}><div className="nura-label">Earnings This Month</div><strong style={{ color:'var(--accent)' }}>${(selected.earnings_month||0).toFixed(2)}</strong></div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={()=>setSelected(null)}>Cancel</button>
                <button type="submit" className="btn-mint" disabled={saving}>{saving?'Saving…':'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
