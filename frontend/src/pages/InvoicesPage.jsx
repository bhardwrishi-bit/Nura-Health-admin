import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const INVOICE_STATUSES = ['invoice_pending','invoice_sent','paid'];
const invoiceBadge = (s) => {
  const map = { invoice_pending:'warning', invoice_sent:'accent', paid:'success' };
  const label = { invoice_pending:'Pending', invoice_sent:'Sent', paid:'Paid' };
  return <span className={`badge badge-${map[s]||'neutral'}`}>{label[s]||s}</span>;
};

export default function InvoicesPage() {
  const [bookings, setBookings] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollector, setSelectedCollector] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });

  const fetchData = async () => {
    const [bRes, cRes] = await Promise.all([
      supabase.from('patient_bookings').select('*').order('scheduled_date', { ascending:false }),
      supabase.from('collectors').select('id, name').order('name'),
    ]);
    setBookings(bRes.data || []);
    setCollectors(cRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const ch = supabase.channel('invoices-page')
      .on('postgres_changes', { event:'*', schema:'public', table:'patient_bookings' }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const updateInvoiceStatus = async (id, invoice_status) => {
    await supabase.from('patient_bookings').update({ invoice_status }).eq('id', id);
  };

  const assignCollector = async (id, collector_id) => {
    await supabase.from('patient_bookings').update({ collector_id: collector_id || null }).eq('id', id);
  };

  const filtered = bookings.filter(b => {
    const monthMatch = !selectedMonth || (b.scheduled_date && b.scheduled_date.startsWith(selectedMonth));
    const collectorMatch = selectedCollector === 'all' || b.collector_id === selectedCollector || (selectedCollector === 'unassigned' && !b.collector_id);
    return monthMatch && collectorMatch;
  });

  const totalRevenue = filtered.reduce((s, b) => s + (parseFloat(b.amount_charged)||0), 0);
  const paidTotal    = filtered.filter(b=>b.invoice_status==='paid').reduce((s,b)=>s+(parseFloat(b.amount_charged)||0),0);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Invoices & Pay</div>
          <div className="page-subtitle">{filtered.length} bookings · ${totalRevenue.toFixed(2)} total · ${paidTotal.toFixed(2)} paid</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        <input
          className="nura-input"
          type="month"
          value={selectedMonth}
          onChange={e=>setSelectedMonth(e.target.value)}
          style={{ width:'auto' }}
        />
        <select className="nura-select" style={{ width:'auto' }} value={selectedCollector} onChange={e=>setSelectedCollector(e.target.value)}>
          <option value="all">All collectors</option>
          <option value="unassigned">Unassigned</option>
          {collectors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:22 }}>
        {[
          { label:'Total Invoiced', value:`$${totalRevenue.toFixed(2)}`, badge:'neutral' },
          { label:'Paid',           value:`$${paidTotal.toFixed(2)}`,    badge:'success' },
          { label:'Outstanding',    value:`$${(totalRevenue-paidTotal).toFixed(2)}`, badge:'warning' },
        ].map(s=>(
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ fontSize:22 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        {loading ? <div className="empty-state">Loading…</div> : filtered.length === 0 ? (
          <div className="empty-state">No bookings for this period</div>
        ) : (
          <table className="nura-table">
            <thead><tr>
              <th>Ref</th><th>Patient</th><th>Service</th><th>Date</th><th>Amount</th>
              <th>Collector</th><th>Invoice Status</th>
            </tr></thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id}>
                  <td style={{ fontSize:11, color:'var(--muted)' }}>{b.booking_ref}</td>
                  <td>
                    <div style={{ fontWeight:500 }}>{b.first_name} {b.last_name}</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>{b.email}</div>
                  </td>
                  <td style={{ fontSize:12 }}>{b.service_type}</td>
                  <td style={{ fontSize:12 }}>{b.scheduled_date}</td>
                  <td style={{ color:'var(--accent)' }}>${parseFloat(b.amount_charged||0).toFixed(2)}</td>
                  <td>
                    <select
                      className="nura-select"
                      style={{ width:'auto', fontSize:11, padding:'4px 8px' }}
                      value={b.collector_id || ''}
                      onChange={e => assignCollector(b.id, e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {collectors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select
                      className="nura-select"
                      style={{ width:'auto', fontSize:11, padding:'4px 8px' }}
                      value={b.invoice_status||'invoice_pending'}
                      onChange={e => updateInvoiceStatus(b.id, e.target.value)}
                    >
                      {INVOICE_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
