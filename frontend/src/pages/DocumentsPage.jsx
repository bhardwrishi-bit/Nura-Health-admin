import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, X, ExternalLink } from 'lucide-react';

const DOC_TYPES = ['WWCC','Police Check','First Aid','ABN','Insurance','Driver\'s Licence'];
const EMPTY_FORM = { collector_id:'', document_type:'WWCC', expiry_date:'', file_url:'' };

const docStatus = (expiry_date) => {
  if (!expiry_date) return { status:'missing', badge:'danger', label:'Missing' };
  const days = Math.ceil((new Date(expiry_date) - new Date()) / 86400000);
  if (days < 0)  return { status:'expired',  badge:'danger',  label:`Expired ${Math.abs(days)}d ago` };
  if (days <= 30) return { status:'expiring', badge:'warning', label:`Expiring in ${days}d` };
  return { status:'valid', badge:'success', label:'Valid' };
};

export default function DocumentsPage() {
  const [collectors, setCollectors] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // collector filter
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const [cRes, dRes] = await Promise.all([
      supabase.from('collectors').select('id, name').order('name'),
      supabase.from('collector_documents').select('*, collectors(name)').order('created_at', { ascending:false }),
    ]);
    setCollectors(cRes.data || []);
    setDocuments(dRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const ch = supabase.channel('docs-page')
      .on('postgres_changes', { event:'*', schema:'public', table:'collector_documents' }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { status } = docStatus(form.expiry_date);
    await supabase.from('collector_documents').insert({ ...form, status });
    setSaving(false);
    setShowModal(false);
    setForm(EMPTY_FORM);
  };

  const handleDelete = async (id) => {
    await supabase.from('collector_documents').delete().eq('id', id);
  };

  const filtered = selected ? documents.filter(d=>d.collector_id===selected) : documents;

  const expiring = documents.filter(d => {
    const s = docStatus(d.expiry_date).status;
    return s === 'expired' || s === 'expiring';
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Documents</div>
          <div className="page-subtitle">{expiring.length > 0 ? `${expiring.length} requiring attention` : 'All documents current'}</div>
        </div>
        <button className="btn-mint" onClick={()=>setShowModal(true)}><Plus size={14} /> Add Document</button>
      </div>

      {/* Alerts */}
      {expiring.length > 0 && (
        <div className="nura-card" style={{ marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--warning)', marginBottom:12 }}>⚠ Documents Requiring Attention</div>
          {expiring.map(d => {
            const { badge, label } = docStatus(d.expiry_date);
            return (
              <div key={d.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border2)', fontSize:12 }}>
                <span><strong>{d.collectors?.name}</strong> — {d.document_type}</span>
                <span className={`badge badge-${badge}`}>{label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter by collector */}
      <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap' }}>
        <button className={`tab-item${!selected?' active':''}`} style={{ border:'1px solid var(--border)', borderRadius:6, padding:'5px 12px' }} onClick={()=>setSelected(null)}>All</button>
        {collectors.map(c=>(
          <button key={c.id} className={`tab-item${selected===c.id?' active':''}`} style={{ border:'1px solid var(--border)', borderRadius:6, padding:'5px 12px' }} onClick={()=>setSelected(c.id)}>{c.name}</button>
        ))}
      </div>

      <div className="panel">
        {loading ? <div className="empty-state">Loading…</div> : filtered.length === 0 ? (
          <div className="empty-state">No documents found</div>
        ) : (
          <table className="nura-table">
            <thead><tr>
              <th>Collector</th><th>Document</th><th>Expiry</th><th>Status</th><th>File</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.map(d => {
                const { badge, label } = docStatus(d.expiry_date);
                return (
                  <tr key={d.id}>
                    <td style={{ fontWeight:500 }}>{d.collectors?.name}</td>
                    <td style={{ fontSize:12 }}>{d.document_type}</td>
                    <td style={{ fontSize:12 }}>{d.expiry_date || '—'}</td>
                    <td><span className={`badge badge-${badge}`}>{label}</span></td>
                    <td>
                      {d.file_url ? (
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer" style={{ color:'var(--accent)', fontSize:11, display:'flex', alignItems:'center', gap:4 }}>
                          View <ExternalLink size={11}/>
                        </a>
                      ) : <span style={{ fontSize:11, color:'var(--muted)' }}>No file</span>}
                    </td>
                    <td>
                      <button className="btn-ghost" style={{ padding:'3px 8px', fontSize:11 }} onClick={()=>handleDelete(d.id)}>Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal-card">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
              <div className="modal-title" style={{ marginBottom:0 }}>Add Document</div>
              <button className="btn-ghost" onClick={()=>setShowModal(false)} style={{ padding:'4px 8px' }}><X size={14}/></button>
            </div>
            <form onSubmit={handleAdd}>
              <div style={{ marginBottom:12 }}>
                <label className="nura-label">Collector *</label>
                <select className="nura-select" value={form.collector_id} onChange={e=>setForm(p=>({...p,collector_id:e.target.value}))} required>
                  <option value="">Select collector…</option>
                  {collectors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:12 }}>
                <label className="nura-label">Document Type</label>
                <select className="nura-select" value={form.document_type} onChange={e=>setForm(p=>({...p,document_type:e.target.value}))}>
                  {DOC_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:12 }}>
                <label className="nura-label">Expiry Date</label>
                <input className="nura-input" type="date" value={form.expiry_date} onChange={e=>setForm(p=>({...p,expiry_date:e.target.value}))} />
              </div>
              <div style={{ marginBottom:20 }}>
                <label className="nura-label">File URL (optional)</label>
                <input className="nura-input" type="url" placeholder="https://…" value={form.file_url} onChange={e=>setForm(p=>({...p,file_url:e.target.value}))} />
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-mint" disabled={saving}>{saving?'Saving…':'Add Document'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
