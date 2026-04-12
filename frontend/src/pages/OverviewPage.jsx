import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, CheckCircle, ClipboardList, UserCheck, DollarSign } from 'lucide-react';

const TIME_LABELS = {
  'morning-early':   '7–9 AM',
  'morning-late':    '9–11 AM',
  'afternoon-early': '11 AM–1 PM',
  'afternoon-late':  '1–3 PM',
  'evening':         '3–5 PM',
};

const statusBadge = (s) => {
  const map = { confirmed: 'accent', completed: 'success', pending: 'warning', cancelled: 'danger', 'pending_payment': 'warning' };
  return <span className={`badge badge-${map[s] || 'neutral'}`}>{s}</span>;
};

export default function OverviewPage() {
  const navigate = useNavigate();
  const [stats, setStats]     = useState({ activeToday: 0, completeToday: 0, activeCollectors: 0, weekEarnings: 0, monthRevenue: 0 });
  const [pipeline, setPipeline] = useState({ pending: 0, pendingThisWeek: 0, confirmedUnassigned: 0, confirmedAssigned: 0, assigned: 0, assignedThisWeek: 0, invoiced: 0, paid: 0 });
  const [liveRuns, setLiveRuns] = useState([]);
  const [alerts, setAlerts]   = useState([]);
  const [loading, setLoading] = useState(true);

  // AEST date helpers (UTC+10, no DST)
  const toAESTDateString = (d) => {
    const aest = new Date(d.getTime() + 10 * 60 * 60 * 1000);
    return aest.toISOString().split('T')[0];
  };

  const today = toAESTDateString(new Date());

  // Sunday-based week start (for existing earnings calc)
  const weekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return toAESTDateString(d);
  })();

  // Monday-based week start/end (for pipeline this-week sub-stats)
  const { weekMonStr, weekSunStr } = (() => {
    const aestNow = new Date(Date.now() + 10 * 60 * 60 * 1000);
    const dow = aestNow.getUTCDay(); // 0=Sun
    const daysFromMon = dow === 0 ? 6 : dow - 1;
    const mon = new Date(aestNow.getTime() - daysFromMon * 24 * 60 * 60 * 1000);
    const sun = new Date(mon.getTime() + 6 * 24 * 60 * 60 * 1000);
    return {
      weekMonStr: mon.toISOString().split('T')[0],
      weekSunStr: sun.toISOString().split('T')[0],
    };
  })();

  // AEST month helpers
  const aestNow     = new Date(Date.now() + 10 * 60 * 60 * 1000);
  const monthPrefix = `${aestNow.getUTCFullYear()}-${String(aestNow.getUTCMonth() + 1).padStart(2, '0')}`;
  const monthShort  = aestNow.toLocaleString('en-AU', { month: 'short', timeZone: 'UTC' });
  const monthLabel  = `1 ${monthShort} – ${aestNow.getUTCDate()} ${monthShort}`;

  const fetchData = async () => {
    const [bookingsRes, collectorsRes] = await Promise.all([
      supabase.from('patient_bookings').select('*').order('created_at', { ascending: false }),
      supabase.from('collectors').select('id, status'),
    ]);

    const bookings  = bookingsRes.data  || [];
    const collectors = collectorsRes.data || [];

    const todayBookings = bookings.filter(b => b.scheduled_date === today);

    const weekEarnings = bookings
      .filter(b => b.scheduled_date >= weekStart)
      .reduce((sum, b) => sum + (parseFloat(b.amount_charged) || 0), 0);

    const monthRevenue = bookings
      .filter(b => {
        if (!b.created_at) return false;
        const bAest = new Date(new Date(b.created_at).getTime() + 10 * 60 * 60 * 1000);
        const bPfx  = `${bAest.getUTCFullYear()}-${String(bAest.getUTCMonth() + 1).padStart(2, '0')}`;
        return bPfx === monthPrefix;
      })
      .reduce((sum, b) => sum + (parseFloat(b.amount_charged) || 0), 0);

    setStats({
      activeToday:      todayBookings.filter(b => !['completed', 'cancelled'].includes(b.status)).length,
      completeToday:    todayBookings.filter(b => b.status === 'completed').length,
      activeCollectors: collectors.filter(c => c.status === 'active').length,
      weekEarnings,
      monthRevenue,
    });

    // Pipeline
    const pendingAll          = bookings.filter(b => b.status === 'pending');
    const confirmedUnassigned = bookings.filter(b => b.status === 'confirmed' && !b.collector_id);
    const confirmedAssigned   = bookings.filter(b => b.status === 'confirmed' &&  b.collector_id);
    const invoicedAll         = bookings.filter(b => ['invoice_sent', 'paid'].includes(b.invoice_status));
    const paidAll             = bookings.filter(b => b.invoice_status === 'paid');

    const pendingThisWeek  = pendingAll.filter(b => b.scheduled_date >= weekMonStr && b.scheduled_date <= weekSunStr).length;
    const assignedThisWeek = confirmedAssigned.filter(b => b.scheduled_date >= weekMonStr && b.scheduled_date <= weekSunStr).length;

    setPipeline({
      pending:             pendingAll.length,
      pendingThisWeek,
      confirmedUnassigned: confirmedUnassigned.length,
      confirmedAssigned:   confirmedAssigned.length,
      assigned:            confirmedAssigned.length,
      assignedThisWeek,
      invoiced:            invoicedAll.length,
      paid:                paidAll.length,
    });

    setLiveRuns(todayBookings.slice(0, 20));

    // Alerts — past due first (red), then referral (orange), then payment (red)
    const alertItems = [];

    bookings
      .filter(b => b.scheduled_date < today && !['completed', 'cancelled'].includes(b.status))
      .forEach(b => {
        alertItems.push({ type: 'pastdue', msg: `Past due: ${b.first_name} ${b.last_name} (${b.booking_ref || b.id?.slice(0, 8)})` });
      });

    bookings.forEach(b => {
      if (b.referral_uploaded === false && b.status !== 'cancelled') {
        alertItems.push({ type: 'warning', msg: `No referral uploaded: ${b.first_name} ${b.last_name} (${b.booking_ref || b.id?.slice(0, 8)})` });
      }
      if (['failed', 'unpaid'].includes(b.payment_status)) {
        alertItems.push({ type: 'danger', msg: `Payment issue: ${b.first_name} ${b.last_name} — ${b.payment_status}` });
      }
    });

    setAlerts(alertItems.slice(0, 10));
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const ch = supabase.channel('overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_bookings' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collectors' }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  if (loading) return <div className="empty-state">Loading…</div>;

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const PIPELINE_STAGES = [
    {
      Icon:   ClipboardList,
      label:  'New Bookings',
      count:  pipeline.pending,
      status: 'Awaiting confirmation',
      sub:    `This week: ${pipeline.pendingThisWeek}`,
      color:  '#80E5CB',
    },
    {
      Icon:   CheckCircle,
      label:  'Confirmed',
      count:  pipeline.confirmedUnassigned,
      status: 'Needs collector assigned',
      sub:    `Assigned: ${pipeline.confirmedAssigned}`,
      color:  '#3B82F6',
    },
    {
      Icon:   UserCheck,
      label:  'Assigned',
      count:  pipeline.assigned,
      status: 'Ready to run',
      sub:    `This week: ${pipeline.assignedThisWeek}`,
      color:  '#8B5CF6',
    },
    {
      Icon:   DollarSign,
      label:  'Invoiced',
      count:  pipeline.invoiced,
      status: 'Invoices sent',
      sub:    `Paid: ${pipeline.paid}`,
      color:  '#10B981',
    },
  ];

  const alertIconColor = (type) => {
    if (type === 'pastdue') return '#EF4444';
    if (type === 'danger')  return 'var(--danger)';
    return 'var(--warning)';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{greeting} 👋</div>
          <div className="page-subtitle">{new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
      </div>

      {/* Stats — 5 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Active Runs Today',    value: stats.activeToday,                   sub: 'scheduled for today' },
          { label: 'Collections Complete', value: stats.completeToday,                 sub: 'completed today' },
          { label: 'Active Collectors',    value: stats.activeCollectors,              sub: 'currently active' },
          { label: 'Earnings This Week',   value: `$${stats.weekEarnings.toFixed(0)}`, sub: 'total this week' },
          { label: 'Revenue This Month',   value: `$${stats.monthRevenue.toFixed(0)}`, sub: monthLabel },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Workflow Pipeline */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <span style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.08em', color: 'var(--muted)', fontWeight: 600 }}>Workflow</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch', padding: '16px 16px 20px', flexWrap: 'wrap', gap: 0 }}>
          {PIPELINE_STAGES.map((stage, i) => (
            <React.Fragment key={stage.label}>
              <div
                onClick={() => navigate('/bookings')}
                style={{
                  flex: '1 1 160px',
                  background: 'var(--card2)',
                  borderRadius: 10,
                  padding: '16px 18px',
                  borderLeft: `4px solid ${stage.color}`,
                  cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                  <stage.Icon size={15} style={{ color: stage.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
                    {stage.label}
                  </span>
                </div>
                <div style={{ fontSize: 34, fontWeight: 700, color: 'var(--text)', lineHeight: 1, marginBottom: 6 }}>
                  {stage.count}
                </div>
                <div style={{ fontSize: 12, color: stage.color, fontWeight: 500, marginBottom: 8 }}>
                  {stage.status}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {stage.sub}
                </div>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', opacity: 0.3, fontSize: 20, color: 'var(--text)', flexShrink: 0 }}>
                  →
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Live runs */}
        <div className="panel">
          <div className="panel-header">
            <span>Live Runs — Today</span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{liveRuns.length} bookings</span>
          </div>
          {liveRuns.length === 0 ? (
            <div className="empty-state">No bookings scheduled for today</div>
          ) : (
            <table className="nura-table">
              <thead><tr>
                <th>Patient</th><th>Service</th><th>Time</th><th>Amount</th><th>Status</th>
              </tr></thead>
              <tbody>
                {liveRuns.map(b => (
                  <tr key={b.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{b.first_name} {b.last_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{b.email}</div>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{b.service_type}</td>
                    <td style={{ fontSize: 12 }}>{TIME_LABELS[b.scheduled_time] || b.scheduled_time}</td>
                    <td style={{ color: 'var(--accent)' }}>${parseFloat(b.amount_charged || 0).toFixed(2)}</td>
                    <td>{statusBadge(b.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Alerts */}
        <div className="panel">
          <div className="panel-header">
            <span>Alerts</span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{alerts.length}</span>
          </div>
          <div style={{ padding: '12px' }}>
            {alerts.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px', color: 'var(--success)', fontSize: 13 }}>
                <CheckCircle size={16} /> All clear
              </div>
            ) : alerts.map((a, i) => (
              <div key={i} className={`alert-item alert-${a.type === 'pastdue' ? 'danger' : a.type}`}>
                <AlertTriangle size={14} style={{ color: alertIconColor(a.type), flexShrink: 0, marginTop: 1 }} />
                <span style={{ color: alertIconColor(a.type) }}>{a.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
