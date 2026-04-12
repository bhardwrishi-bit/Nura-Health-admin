import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Plus, X, Phone, Mail } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatService = (type) => ({
  'home_visit':         'Home Visit',
  'home-visit':         'Home Visit',
  'home':               'Home Visit',
  'ndis':               'NDIS',
  'corporate':          'Corporate',
  'aged_care':          'Aged Care',
  'aged-care':          'Aged Care',
  'urgent':             'Priority',
  'same-day-priority':  'Priority',
})[type] || type;

const formatTime = (slot) => ({
  'morning':         '8AM–11AM',
  'morning-early':   '7AM–9AM',
  'morning-late':    '9AM–11AM',
  'afternoon-early': '11AM–1PM',
  'afternoon-mid':   '1PM–3PM',
  'afternoon-late':  '3PM–5PM',
  'evening':         '3PM–5PM',
})[slot] || slot || '—';

const fmtDate = (raw) => {
  if (!raw) return '—';
  // Date-only string: parse as local to avoid UTC off-by-one
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return new Date(raw).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtCurrency = (val) =>
  `$${(parseFloat(val) || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getInitials = (first, last) =>
  `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase() || '?';

const isActive = (lastBookingAt) => {
  if (!lastBookingAt) return false;
  return (Date.now() - new Date(lastBookingAt).getTime()) / 86400000 <= 90;
};

const servicePill = (type, i) => (
  <span key={i} style={{
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: 10,
    fontWeight: 600,
    marginRight: 4,
    marginBottom: 2,
    background: 'rgba(128,229,203,0.15)',
    color: 'var(--accent)',
    border: '1px solid rgba(128,229,203,0.3)',
  }}>
    {formatService(type)}
  </span>
);

const statusBadge = (s) => {
  const map = { confirmed: 'accent', completed: 'success', pending: 'warning', cancelled: 'danger', pending_payment: 'warning' };
  return <span className={`badge badge-${map[s] || 'neutral'}`}>{s?.replace(/_/g, ' ')}</span>;
};

const invoiceBadge = (s) => {
  if (!s) return <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>;
  const map = { invoice_pending: 'warning', paid: 'success', sent: 'accent' };
  return <span className={`badge badge-${map[s] || 'neutral'}`}>{s.replace(/_/g, ' ')}</span>;
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function PatientsPage() {
  const [patients, setPatients]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [drawerTab, setDrawerTab]       = useState('overview');
  const [patientBookings, setPatientBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  useEffect(() => { fetchPatients(); }, []);

  const fetchPatients = async () => {
    const { data } = await supabase
      .from('patients')
      .select('*')
      .order('last_booking_at', { ascending: false });
    setPatients(data || []);
    setLoading(false);
  };

  const openPatient = async (patient) => {
    setSelectedPatient(patient);
    setDrawerTab('overview');
    setBookingsLoading(true);
    const { data } = await supabase
      .from('patient_bookings')
      .select('*')
      .eq('email', patient.email)
      .order('scheduled_date', { ascending: false });
    setPatientBookings(data || []);
    setBookingsLoading(false);
  };

  // ── Stats ──
  const now = new Date();
  const totalPatients = patients.length;
  const activeThisMonth = patients.filter(p => {
    if (!p.last_booking_at) return false;
    const d = new Date(p.last_booking_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const totalCollections = patients.reduce((s, p) => s + (Number(p.total_bookings) || 0), 0);
  const totalRevenue     = patients.reduce((s, p) => s + (parseFloat(p.lifetime_value) || 0), 0);

  // ── Filter ──
  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      `${p.first_name} ${p.last_name} ${p.email} ${p.phone || ''}`.toLowerCase().includes(q);
    const matchService = serviceFilter === 'all' ||
      (p.service_types || []).some(t => formatService(t) === formatService(serviceFilter));
    return matchSearch && matchService;
  });

  if (loading) return <div className="empty-state">Loading…</div>;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Patients</div>
          <div className="page-subtitle">{totalPatients} patients</div>
        </div>
        <button className="btn-mint" onClick={() => alert('Coming soon')}>
          <Plus size={14} /> New Patient
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Patients',     value: totalPatients,    sub: 'unique patients' },
          { label: 'Active This Month',  value: activeThisMonth,  sub: 'booked this month' },
          { label: 'Total Collections',  value: totalCollections, sub: 'across all patients' },
          { label: 'Total Revenue',      value: `$${totalRevenue.toLocaleString('en-AU', { minimumFractionDigits: 0 })}`, sub: 'lifetime value' },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            className="nura-input"
            style={{ paddingLeft: 30 }}
            placeholder="Search by name, email, phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="nura-select" style={{ width: 'auto' }} value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}>
          <option value="all">All Services</option>
          <option value="home-visit">Home Visit</option>
          <option value="ndis">NDIS</option>
          <option value="corporate">Corporate</option>
          <option value="aged-care">Aged Care</option>
        </select>
      </div>

      {/* Patient table */}
      <div className="panel">
        {filtered.length === 0 ? (
          <div className="empty-state">No patients found</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="nura-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Phone</th>
                  <th>Services</th>
                  <th style={{ textAlign: 'center' }}>Bookings</th>
                  <th>Lifetime Value</th>
                  <th>Last Booking</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr
                    key={`${p.email}_${p.first_name}_${p.last_name}`}
                    onClick={() => openPatient(p)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: '#80E5CB', color: '#00001E',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, flexShrink: 0,
                        }}>
                          {getInitials(p.first_name, p.last_name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{p.first_name} {p.last_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{p.phone || '—'}</td>
                    <td>{(p.service_types || []).map(servicePill)}</td>
                    <td style={{ textAlign: 'center', fontSize: 13 }}>{p.total_bookings}</td>
                    <td style={{ color: 'var(--accent)' }}>{fmtCurrency(p.lifetime_value)}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtDate(p.last_booking_at)}</td>
                    <td>
                      {isActive(p.last_booking_at)
                        ? <span className="badge badge-success">Active</span>
                        : <span className="badge badge-neutral">Inactive</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selectedPatient && (
        <>
          <div
            onClick={() => setSelectedPatient(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.52)', zIndex: 40 }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: 520, maxWidth: '95vw',
            background: 'var(--card)',
            borderLeft: '1px solid var(--border)',
            zIndex: 50,
            display: 'flex', flexDirection: 'column',
            overflowY: 'auto',
          }}>
            {/* Drawer header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: '50%',
                  background: '#80E5CB', color: '#00001E',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17, fontWeight: 700, flexShrink: 0,
                }}>
                  {getInitials(selectedPatient.first_name, selectedPatient.last_name)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    {selectedPatient.first_name} {selectedPatient.last_name}
                  </div>
                  <div style={{ marginTop: 3 }}>
                    {isActive(selectedPatient.last_booking_at)
                      ? <span className="badge badge-success">Active</span>
                      : <span className="badge badge-neutral">Inactive</span>}
                  </div>
                </div>
              </div>
              <button className="btn-ghost" onClick={() => setSelectedPatient(null)} style={{ padding: '6px 8px' }}>
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', padding: '14px 24px 0', borderBottom: '1px solid var(--border)' }}>
              {[['overview', 'Overview'], ['history', 'Booking History']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setDrawerTab(key)}
                  style={{
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: drawerTab === key ? 600 : 400,
                    color: drawerTab === key ? 'var(--accent)' : 'var(--muted)',
                    background: 'none', border: 'none',
                    borderBottom: drawerTab === key ? '2px solid var(--accent)' : '2px solid transparent',
                    cursor: 'pointer',
                    marginBottom: -1,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ padding: '20px 24px', flex: 1 }}>
              {drawerTab === 'overview'
                ? <OverviewTab patient={selectedPatient} onViewHistory={() => setDrawerTab('history')} />
                : <HistoryTab bookings={patientBookings} loading={bookingsLoading} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ patient, onViewHistory }) {
  const fullAddress = [patient.address, patient.suburb, patient.state, patient.postcode]
    .filter(Boolean).join(', ') || '—';

  return (
    <div>
      {/* Patient info card */}
      <div className="nura-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: 'var(--accent)' }}>Patient Details</div>
        {[
          { label: 'Email',         value: <a href={`mailto:${patient.email}`} style={{ color: 'var(--accent)' }}>{patient.email}</a> },
          { label: 'Phone',         value: patient.phone ? <a href={`tel:${patient.phone}`} style={{ color: 'var(--accent)' }}>{patient.phone}</a> : '—' },
          { label: 'Date of Birth', value: patient.date_of_birth ? fmtDate(patient.date_of_birth) : 'Not provided' },
          { label: 'Address',       value: fullAddress },
          { label: 'First Booking', value: fmtDate(patient.first_booking_at) },
          { label: 'Last Booking',  value: fmtDate(patient.last_booking_at) },
        ].map(({ label, value }) => (
          <div key={label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            padding: '8px 0', borderBottom: '1px solid var(--border2)', fontSize: 13,
          }}>
            <span style={{ color: 'var(--muted)', flexShrink: 0, marginRight: 16 }}>{label}</span>
            <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="stat-card" style={{ padding: '12px 14px' }}>
          <div className="stat-label" style={{ fontSize: 11 }}>Total Bookings</div>
          <div className="stat-value" style={{ fontSize: 22 }}>{patient.total_bookings}</div>
        </div>
        <div className="stat-card" style={{ padding: '12px 14px' }}>
          <div className="stat-label" style={{ fontSize: 11 }}>Lifetime Value</div>
          <div className="stat-value" style={{ fontSize: 22 }}>{fmtCurrency(patient.lifetime_value)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div className="nura-card" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Services Used</div>
          {(patient.service_types || []).length === 0
            ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>
            : (patient.service_types || []).map(servicePill)}
        </div>
        <div className="nura-card" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Referral Uploaded</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {patient.has_uploaded_referral
              ? <span style={{ color: 'var(--success)' }}>Yes</span>
              : <span style={{ color: 'var(--muted)' }}>No</span>}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-mint" onClick={onViewHistory} style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}>
          View All Bookings
        </button>
        {patient.phone && (
          <a
            href={`tel:${patient.phone}`}
            className="btn-ghost"
            style={{ flex: 1, justifyContent: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}
          >
            <Phone size={12} /> Call Patient
          </a>
        )}
        <a
          href={`mailto:${patient.email}`}
          className="btn-ghost"
          style={{ flex: 1, justifyContent: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}
        >
          <Mail size={12} /> Email Patient
        </a>
      </div>
    </div>
  );
}

// ─── Booking History Tab ───────────────────────────────────────────────────────

function HistoryTab({ bookings, loading }) {
  if (loading) return <div className="empty-state">Loading bookings…</div>;
  if (!bookings.length) return <div className="empty-state">No bookings found</div>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="nura-table">
        <thead>
          <tr>
            <th>Ref</th>
            <th>Service</th>
            <th>Date</th>
            <th>Time</th>
            <th>Status</th>
            <th>Invoice</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map(b => (
            <tr key={b.id}>
              <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--accent)' }}>{b.booking_ref}</td>
              <td style={{ fontSize: 12 }}>{formatService(b.service_type)}</td>
              <td style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtDate(b.scheduled_date)}</td>
              <td style={{ fontSize: 11, color: 'var(--muted)' }}>{formatTime(b.scheduled_time)}</td>
              <td>{statusBadge(b.status)}</td>
              <td>{invoiceBadge(b.invoice_status)}</td>
              <td style={{ color: 'var(--accent)' }}>
                {b.amount_charged ? `$${parseFloat(b.amount_charged).toFixed(2)}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
