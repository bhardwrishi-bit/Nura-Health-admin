import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, X } from 'lucide-react';

const LEAVE_TYPES = ['Annual Leave','Sick Leave','Personal Leave','Carer\'s Leave','Public Holiday'];
const EMPTY_FORM = { collector_id:'', leave_type:'Annual Leave', start_date:'', end_date:'', notes:'' };

const statusBadge = (s) => {
  const map = { pending:'warning', approved:'success', declined:'danger' };
  return <span className={`badge badge-${map[s]||'neutral'}`}>{s}</span>;
};

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
      supabase.from('leave_requests').select('*, collectors(name)').order('submitted_at', { ascending:false }),
      supabase.from('collectors').select('id, name').eq('status','active').order('name'),
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
    await supabase.from('leave_requests').insert(form);
    setSaving(false);
    setShowModal(false);
    setForm(EMPTY_FORM);
  };

  const days = (start, end) => {
    if (!start || !end) return 0;
    return Math.ceil((new Date(end) - new Date(start)) / 86400000) + 1;
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
              <th>Collector</th><th>Type</th><th>Period</th><th>Days</th><th>Status</th><th>Submitted</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight:500 }}>{r.collectors?.name || '—'}</td>
                  <td style={{ fontSize:12 }}>{r.leave_type}</td>
                  <td style={{ fontSize:12 }}>{r.start_date} → {r.end_date}</td>
                  <td style={{ fontSize:12 }}>{days(r.start_date, r.end_date)}d</td>
                  <td>{statusBadge(r.status)}</td>
                  <td style={{ fontSize:11, color:'var(--muted)' }}>{new Date(r.submitted_at).toLocaleDateString('en-AU')}</td>
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
                  {collectors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:12 }}>
                <label className="nura-label">Leave Type</label>
                <select className="nura-select" value={form.leave_type} onChange={e=>setForm(p=>({...p,leave_type:e.target.value}))}>
                  {LEAVE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
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
                <label className="nura-label">Notes</label>
                <textarea className="nura-input" rows={2} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} style={{ resize:'vertical' }} />
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
