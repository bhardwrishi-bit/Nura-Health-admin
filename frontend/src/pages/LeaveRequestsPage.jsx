import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, X } from 'lucide-react';

// Real leave_type values from Supabase `leave_requests` table
const LEAVE_TYPES = ['annual', 'sick', 'personal', 'other'];
const LEAVE_TYPE_LABELS = {
  annual: 'Annual Leave',
  sick: 'Sick Leave',
  personal: 'Personal Leave',
  other: 'Other',
};

const EMPTY_FORM = { collector_id:'', leave_type:'annual', start_date:'', end_date:'', reason:'' };

const statusBadge = (s) => {
  const map = { pending:'warning', approved:'success', declined:'danger' };
  return <span className={`badge badge-${map[s]||'neutral'}`}>{s}</span>;
};

const collectorName = (c) => c ? [c.first_name, c.last_name].filter(Boolean).join(' ') : '—';

export default function LeaveRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const [rRes, cRes] = await Promise.all([
      // Join collectors with first_name/last_name (not name)
      supabase.from('leave_requests')
        .select('*, collectors(id, first_name, last_name)')
        .order('submitted_at', { ascending:false }),
      supabase.from('collectors')
        .select('id, first_name, last_name')
        .eq('status','active')
        .order('first_name'),
    ]);
    setRequests(rRes.data || []);
    setCollectors(cRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const ch = supabase.channel('leave-page')
      .on('postgres_changes', { event:'*', schema:'public', table:'leave_requests' }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const updateStatus = async (id, status) => {
    await supabase.from('leave_requests').update({ status }).eq('id', id);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    // Use `reason` field (not `notes`) per actual schema
    await supabase.from('leave_requests').insert(form);
    setSaving(false);
    setShowModal(false);
    setForm(EMPTY_FORM);
  };

  // Use working_days from DB if available, otherwise calculate from dates
  const displayDays = (r) => {
    if (r.working_days != null) return `${r.working_days}d`;
    if (!r.start_date || !r.end_date) return '—';
    const d = Math.ceil((new Date(r.end_date) - new Date(r.start_date)) / 86400000) + 1;
    return `${d}d`;
  };

  const filtered = tab === 'pending' ? requests.filter(r=>r.status==='pending') : requests;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Leave Requests</div>
          <div className="page-subtitle">{requests.filter(r=>r.status==='pending').length} pending approval</div>
        </div>
        <button className="btn-mint" onClick={()=>setShowModal(true)}><Plus size={14} /> Add Request</button>
      </div>

      <div className="tab-bar">
        {[['pending','Pending'],['all','All']].map(([key,lbl])=>(
          <button key={key} className={`tab-item${tab===key?' active':''}`} onClick={()=>setTab(key)}>{lbl}</button>
        ))}
      </div>

      <div className="panel">
        {loading ? <div className="empty-state">Loading…</div> : filtered.length === 0 ? (
          <div className="empty-state">{tab==='pending' ? 'No pending requests' : 'No leave requests'}</div>
        ) : (
          <table className="nura-table">
            <thead><tr>
              <th>Collector</th><th>Type</th><th>Period</th><th>Days</th><th>Reason</th><th>Status</th><th>Submitted</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight:500 }}>{collectorName(r.collectors)}</td>
                  <td style={{ fontSize:12 }}>{LEAVE_TYPE_LABELS[r.leave_type]||r.leave_type}</td>
                  <td style={{ fontSize:12, whiteSpace:'nowrap' }}>{r.start_date} → {r.end_date}</td>
                  <td style={{ fontSize:12 }}>{displayDays(r)}</td>
                  <td style={{ fontSize:11, color:'var(--muted)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.reason||'—'}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td style={{ fontSize:11, color:'var(--muted)', whiteSpace:'nowrap' }}>
                    {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-AU') : '—'}
                  </td>
                  <td>
                    {r.status === 'pending' && (
                      <div style={{ display:'flex', gap:6 }}>
                        <button className="btn-success" onClick={() => updateStatus(r.id,'approved')}>Approve</button>
                        <button className="btn-danger"  onClick={() => updateStatus(r.id,'declined')}>Decline</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal-card">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
              <div className="modal-title" style={{ marginBottom:0 }}>Add Leave Request</div>
              <button className="btn-ghost" onClick={()=>setShowModal(false)} style={{ padding:'4px 8px' }}><X size={14}/></button>
            </div>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom:12 }}>
                <label className="nura-label">Collector *</label>
                <select className="nura-select" value={form.collector_id} onChange={e=>setForm(p=>({...p,collector_id:e.target.value}))} required>
                  <option value="">Select collector…</option>
                  {collectors.map(c=><option key={c.id} value={c.id}>{collectorName(c)}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:12 }}>
                <label className="nura-label">Leave Type</label>
                <select className="nura-select" value={form.leave_type} onChange={e=>setForm(p=>({...p,leave_type:e.target.value}))}>
                  {LEAVE_TYPES.map(t=><option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div>
                  <label className="nura-label">Start Date *</label>
                  <input className="nura-input" type="date" value={form.start_date} onChange={e=>setForm(p=>({...p,start_date:e.target.value}))} required />
                </div>
                <div>
                  <label className="nura-label">End Date *</label>
                  <input className="nura-input" type="date" value={form.end_date} onChange={e=>setForm(p=>({...p,end_date:e.target.value}))} required />
                </div>
              </div>
              <div style={{ marginBottom:20 }}>
                <label className="nura-label">Reason</label>
                {/* Use `reason` field (not `notes`) per actual schema */}
                <textarea className="nura-input" rows={2} value={form.reason} onChange={e=>setForm(p=>({...p,reason:e.target.value}))} style={{ resize:'vertical' }} />
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-mint" disabled={saving}>{saving?'Saving…':'Submit Request'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
