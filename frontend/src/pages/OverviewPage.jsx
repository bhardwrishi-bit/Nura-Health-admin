import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';

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
  const [stats, setStats] = useState({ activeToday: 0, completeToday: 0, activeCollectors: 0, weekEarnings: 0 });
  const [liveRuns, setLiveRuns] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Use Brisbane/Sydney local date (AEST UTC+10, no DST)
  const toAESTDateString = (d) => {
    const aest = new Date(d.getTime() + 10 * 60 * 60 * 1000);
    return aest.toISOString().split('T')[0];
  };
  const today = toAESTDateString(new Date());
  const weekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return toAESTDateString(d);
  })();

  const fetchData = async () => {
    const [bookingsRes, collectorsRes] = await Promise.all([
      supabase.from('patient_bookings').select('*').order('created_at', { ascending: false }),
      supabase.from('collectors').select('id, status'),
    ]);

    const bookings = bookingsRes.data || [];
    const collectors = collectorsRes.data || [];

    const todayBookings = bookings.filter(b => b.scheduled_date === today);
    const weekEarnings = bookings
      .filter(b => b.scheduled_date >= weekStart)
      .reduce((sum, b) => sum + (parseFloat(b.amount_charged) || 0), 0);

    setStats({
      activeToday:      todayBookings.filter(b => !['completed','cancelled'].includes(b.status)).length,
      completeToday:    todayBookings.filter(b => b.status === 'completed').length,
      activeCollectors: collectors.filter(c => c.status === 'active').length,
      weekEarnings,
    });

    setLiveRuns(todayBookings.slice(0, 20));

    const alertItems = [];
    bookings.forEach(b => {
      // referral_uploaded means patient uploaded referral but prescription file not yet filed by admin
      if (b.referral_uploaded === false && ['confirmed','pending'].includes(b.status)) {
        alertItems.push({ type: 'warning', msg: `No referral uploaded: ${b.first_name} ${b.last_name} (${b.booking_ref || b.id?.slice(0,8)})` });
      }
      if (['failed','unpaid'].includes(b.payment_status)) {
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{greeting} 👋</div>
          <div className="page-subtitle">{new Date().toLocaleDateString('en-AU', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
        {[
          { label:'Active Runs Today',        value: stats.activeToday,             sub:'scheduled for today' },
          { label:'Collections Complete',     value: stats.completeToday,           sub:'completed today' },
          { label:'Active Collectors',        value: stats.activeCollectors,        sub:'currently active' },
          { label:'Earnings This Week',       value: `$${stats.weekEarnings.toFixed(0)}`, sub:'total this week' },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:20 }}>
        {/* Live runs */}
        <div className="panel">
          <div className="panel-header">
            <span>Live Runs — Today</span>
            <span style={{ fontSize:11, color:'var(--muted)' }}>{liveRuns.length} bookings</span>
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
                      <div style={{ fontWeight:500 }}>{b.first_name} {b.last_name}</div>
                      <div style={{ fontSize:11, color:'var(--muted)' }}>{b.email}</div>
                    </td>
                    <td style={{ color:'var(--muted)', fontSize:12 }}>{b.service_type}</td>
                    <td style={{ fontSize:12 }}>{TIME_LABELS[b.scheduled_time] || b.scheduled_time}</td>
                    <td style={{ color:'var(--accent)' }}>${parseFloat(b.amount_charged||0).toFixed(2)}</td>
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
            <span style={{ fontSize:11, color:'var(--muted)' }}>{alerts.length}</span>
          </div>
          <div style={{ padding:'12px' }}>
            {alerts.length === 0 ? (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px', color:'var(--success)', fontSize:13 }}>
                <CheckCircle size={16} /> All clear
              </div>
            ) : alerts.map((a, i) => (
              <div key={i} className={`alert-item alert-${a.type}`}>
                <AlertTriangle size={14} style={{ color: a.type === 'danger' ? 'var(--danger)' : 'var(--warning)', flexShrink:0, marginTop:1 }} />
                <span style={{ color: a.type === 'danger' ? 'var(--danger)' : 'var(--warning)' }}>{a.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
