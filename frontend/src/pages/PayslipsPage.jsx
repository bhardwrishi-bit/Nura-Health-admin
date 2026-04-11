import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Download, X } from 'lucide-react';

const EMPTY_FORM = { collector_id:'', period_start:'', period_end:'', total_runs:0, total_amount:0 };

const statusBadge = (s) => {
  const map = { draft:'neutral', sent:'accent', paid:'success' };
  return <span className={`badge badge-${map[s]||'neutral'}`}>{s}</span>;
};

export default function PayslipsPage() {
  const [payslips, setPayslips] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const [pRes, cRes, bRes] = await Promise.all([
      supabase.from('collector_payslips').select('*, collectors(name)').order('created_at', { ascending:false }),
      supabase.from('collectors').select('id, name').order('name'),
      supabase.from('patient_bookings').select('collector_id, amount_charged, status, scheduled_date'),
    ]);
    setPayslips(pRes.data || []);
    setCollectors(cRes.data || []);
    setBookings(bRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const ch = supabase.channel('payslips-page')
      .on('postgres_changes', { event:'*', schema:'public', table:'collector_payslips' }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const calcTotals = () => {
    if (!form.collector_id || !form.period_start || !form.period_end) return;
    const runs = bookings.filter(b =>
      b.collector_id === form.collector_id &&
      b.scheduled_date >= form.period_start &&
      b.scheduled_date <= form.period_end &&
      b.status === 'completed'
    );
    setForm(p => ({ ...p, total_runs: runs.length, total_amount: runs.reduce((s,b)=>s+(parseFloat(b.amount_charged)||0),0) }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    await supabase.from('collector_payslips').insert(form);
    setSaving(false);
    setShowModal(false);
    setForm(EMPTY_FORM);
  };

  const updateStatus = async (id, status) => {
    await supabase.from('collector_payslips').update({ status }).eq('id', id);
  };

  const downloadPayslip = (p) => {
    const collector = collectors.find(c=>c.id===p.collector_id);
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Payslip — ${collector?.name}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #111; }
  .header { display: flex; justify-content: space-between; margin-bottom: 32px; border-bottom: 2px solid #2B3879; padding-bottom: 16px; }
  .title { font-size: 24px; font-weight: bold; color: #2B3879; }
  .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  .table th, .table td { border: 1px solid #ddd; padding: 10px 14px; text-align: left; }
  .table th { background: #f5f5f5; font-weight: 600; }
  .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 20px; }
</style></head><body>
<div class="header">
  <div><div class="title">Nura Health</div><div>Payslip</div></div>
  <div><div>${collector?.name}</div><div>Period: ${p.period_start} – ${p.period_end}</div></div>
</div>
<table class="table">
  <tr><th>Description</th><th>Runs</th><th>Amount</th></tr>
  <tr><td>Blood Collection Services</td><td>${p.total_runs}</td><td>$${parseFloat(p.total_amount).toFixed(2)}</td></tr>
</table>
<div class="total">Total: $${parseFloat(p.total_amount).toFixed(2)}</div>
</body></html>`;
    const w = window.open('','_blank');
    w.document.write(html);
    w.document.close();
    w.print();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Payslips</div>
          <div className="page-subtitle">{payslips.length} payslips generated</div>
        </div>
        <button className="btn-mint" onClick={()=>setShowModal(true)}><Plus size={14} /> Generate Payslip</button>
      </div>

      <div className="panel">
        {loading ? <div className="empty-state">Loading…</div> : payslips.length === 0 ? (
          <div className="empty-state">No payslips yet. Generate one for a collector.</div>
        ) : (
          <table className="nura-table">
            <thead><tr>
              <th>Collector</th><th>Period</th><th>Runs</th><th>Total</th><th>Status</th><th>Generated</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {payslips.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight:500 }}>{p.collectors?.name}</td>
                  <td style={{ fontSize:12 }}>{p.period_start} – {p.period_end}</td>
                  <td>{p.total_runs}</td>
                  <td style={{ color:'var(--accent)' }}>${parseFloat(p.total_amount).toFixed(2)}</td>
                  <td>
                    <select
                      className="nura-select"
                      style={{ width:'auto', fontSize:11, padding:'4px 8px' }}
                      value={p.status}
                      onChange={e => updateStatus(p.id, e.target.value)}
                    >
                      {['draft','sent','paid'].map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{ fontSize:11, color:'var(--muted)' }}>{new Date(p.generated_at).toLocaleDateString('en-AU')}</td>
                  <td>
                    <button className="btn-ghost" style={{ padding:'4px 10px', fontSize:11 }} onClick={()=>downloadPayslip(p)}>
                      <Download size={12} /> PDF
                    </button>
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
              <div className="modal-title" style={{ marginBottom:0 }}>Generate Payslip</div>
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
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div>
                  <label className="nura-label">Period Start *</label>
                  <input className="nura-input" type="date" value={form.period_start} onChange={e=>setForm(p=>({...p,period_start:e.target.value}))} required />
                </div>
                <div>
                  <label className="nura-label">Period End *</label>
                  <input className="nura-input" type="date" value={form.period_end} onChange={e=>setForm(p=>({...p,period_end:e.target.value}))} required />
                </div>
              </div>
              <button type="button" className="btn-ghost" style={{ marginBottom:16 }} onClick={calcTotals}>
                Auto-calculate from completed bookings
              </button>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
                <div>
                  <label className="nura-label">Total Runs</label>
                  <input className="nura-input" type="number" value={form.total_runs} onChange={e=>setForm(p=>({...p,total_runs:parseInt(e.target.value)||0}))} />
                </div>
                <div>
                  <label className="nura-label">Total Amount ($)</label>
                  <input className="nura-input" type="number" step="0.01" value={form.total_amount} onChange={e=>setForm(p=>({...p,total_amount:parseFloat(e.target.value)||0}))} />
                </div>
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-mint" disabled={saving}>{saving?'Saving…':'Generate'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
