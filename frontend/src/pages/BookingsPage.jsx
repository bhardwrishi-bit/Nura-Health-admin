import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, ExternalLink, Search } from 'lucide-react';

const STATUS_OPTIONS = ['pending','confirmed','completed','cancelled','pending_payment'];
const SERVICE_OPTIONS = ['home-visit','corporate','aged-care','ndis'];
const TIME_OPTIONS = ['morning-early','morning-late','afternoon-early','afternoon-late','evening'];
const TIME_LABELS = { 'morning-early':'7–9 AM','morning-late':'9–11 AM','afternoon-early':'11 AM–1 PM','afternoon-late':'1–3 PM','evening':'3–5 PM' };

const statusBadge = (s) => {
  const map = { confirmed:'accent', completed:'success', pending:'warning', cancelled:'danger', pending_payment:'warning' };
  return <span className={`badge badge-${map[s]||'neutral'}`}>{s}</span>;
};

const EMPTY_FORM = { first_name:'', last_name:'', email:'', phone:'', service_type:'home-visit', scheduled_date:'', scheduled_time:'morning-early', address:'', suburb:'', state:'VIC', postcode:'', amount_charged:'', special_notes:'', payment_status:'pending', status:'confirmed', referral_uploaded:false };

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchBookings = async () => {
    const { data } = await supabase.from('patient_bookings').select('*').order('created_at', { ascending:false });
    setBookings(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();
    const ch = supabase.channel('bookings-page')
      .on('postgres_changes', { event:'*', schema:'public', table:'patient_bookings' }, fetchBookings)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const updateStatus = async (id, status) => {
    await supabase.from('patient_bookings').update({ status }).eq('id', id);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const booking_ref = 'NR-' + Date.now().toString(36).toUpperCase();
    await supabase.from('patient_bookings').insert({ ...form, booking_ref, amount_charged: parseFloat(form.amount_charged)||0 });
    setSaving(false);
    setShowModal(false);
    setForm(EMPTY_FORM);
  };

  const filtered = bookings.filter(b => {
    const matchSearch = !search || `${b.first_name} ${b.last_name} ${b.email} ${b.booking_ref}`.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || b.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Bookings</div>
          <div className="page-subtitle">{bookings.length} total bookings</div>
        </div>
        <button className="btn-mint" onClick={() => setShowModal(true)}><Plus size={14} /> New Job</button>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:12, marginBottom:20, alignItems:'center' }}>
        <div style={{ position:'relative', flex:1, maxWidth:300 }}>
          <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--muted)' }} />
          <input className="nura-input" style={{ paddingLeft:30 }} placeholder="Search by name, email, ref…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <select className="nura-select" style={{ width:'auto' }} value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="panel">
        {loading ? <div className="empty-state">Loading…</div> : filtered.length === 0 ? (
          <div className="empty-state">No bookings found</div>
        ) : (
          <table className="nura-table">
            <thead><tr>
              <th>Patient</th><th>Service</th><th>Appointment</th><th>Amount</th>
              <th>Payment</th><th>Status</th><th>Referral</th><th>Booked</th>
            </tr></thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id}>
                  <td>
                    <div style={{ fontWeight:500 }}>{b.first_name} {b.last_name}</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>{b.email}</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>{b.phone}</div>
                  </td>
                  <td style={{ fontSize:12 }}>
                    <div>{b.service_type}</div>
                    <div style={{ color:'var(--muted)', fontSize:11 }}>{b.address}</div>
                  </td>
                  <td style={{ fontSize:12 }}>
                    <div>{b.scheduled_date}</div>
                    <div style={{ color:'var(--muted)' }}>{TIME_LABELS[b.scheduled_time]||b.scheduled_time}</div>
                  </td>
                  <td style={{ color:'var(--accent)' }}>${parseFloat(b.amount_charged||0).toFixed(2)}</td>
                  <td><span className={`badge badge-${b.payment_status==='paid'?'success':b.payment_status==='failed'?'danger':'warning'}`}>{b.payment_status}</span></td>
                  <td>
                    <select
                      className="nura-select"
                      style={{ width:'auto', fontSize:11, padding:'4px 8px' }}
                      value={b.status}
                      onChange={e => updateStatus(b.id, e.target.value)}
                    >
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>
                    {b.prescription_url ? (
                      <a href={b.prescription_url} target="_blank" rel="noopener noreferrer" style={{ color:'var(--accent)', fontSize:11, display:'flex', alignItems:'center', gap:4 }}>
                        View <ExternalLink size={11} />
                      </a>
                    ) : <span style={{ fontSize:11, color:'var(--muted)' }}>None</span>}
                  </td>
                  <td style={{ fontSize:11, color:'var(--muted)' }}>{new Date(b.created_at).toLocaleDateString('en-AU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New booking modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowModal(false)}>
          <div className="modal-card">
            <div className="modal-title">New Booking</div>
            <form onSubmit={handleCreate}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[['first_name','First Name'],['last_name','Last Name'],['email','Email'],['phone','Phone']].map(([f,l])=>(
                  <div key={f}>
                    <label className="nura-label">{l}</label>
                    <input className="nura-input" value={form[f]} onChange={e=>setForm(p=>({...p,[f]:e.target.value}))} required={['first_name','last_name','email','phone'].includes(f)} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop:12 }}>
                <label className="nura-label">Address</label>
                <input className="nura-input" value={form.address} onChange={e=>setForm(p=>({...p,address:e.target.value}))} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginTop:12 }}>
                <div><label className="nura-label">Suburb</label><input className="nura-input" value={form.suburb} onChange={e=>setForm(p=>({...p,suburb:e.target.value}))} /></div>
                <div><label className="nura-label">State</label><input className="nura-input" value={form.state} onChange={e=>setForm(p=>({...p,state:e.target.value}))} /></div>
                <div><label className="nura-label">Postcode</label><input className="nura-input" value={form.postcode} onChange={e=>setForm(p=>({...p,postcode:e.target.value}))} /></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}>
                <div>
                  <label className="nura-label">Service</label>
                  <select className="nura-select" value={form.service_type} onChange={e=>setForm(p=>({...p,service_type:e.target.value}))}>
                    {SERVICE_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="nura-label">Amount ($)</label>
                  <input className="nura-input" type="number" step="0.01" value={form.amount_charged} onChange={e=>setForm(p=>({...p,amount_charged:e.target.value}))} />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}>
                <div>
                  <label className="nura-label">Date</label>
                  <input className="nura-input" type="date" value={form.scheduled_date} onChange={e=>setForm(p=>({...p,scheduled_date:e.target.value}))} required />
                </div>
                <div>
                  <label className="nura-label">Time Slot</label>
                  <select className="nura-select" value={form.scheduled_time} onChange={e=>setForm(p=>({...p,scheduled_time:e.target.value}))}>
                    {TIME_OPTIONS.map(t=><option key={t} value={t}>{TIME_LABELS[t]}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop:12 }}>
                <label className="nura-label">Notes</label>
                <textarea className="nura-input" rows={2} value={form.special_notes} onChange={e=>setForm(p=>({...p,special_notes:e.target.value}))} style={{ resize:'vertical' }} />
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-mint" disabled={saving}>{saving?'Saving…':'Create Booking'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
