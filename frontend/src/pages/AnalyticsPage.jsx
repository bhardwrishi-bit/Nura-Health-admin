import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#80E5CB','#3b82f6','#a855f7','#f59e0b','#ef4444','#22c55e'];

const SERVICE_LABELS = { 'home-visit':'Home Visit', 'corporate':'Corporate', 'aged-care':'Aged Care', 'ndis':'NDIS' };

function getWeekKey(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const monday = new Date(d); monday.setDate(d.getDate() - day + (day===0?-6:1));
  return monday.toISOString().split('T')[0];
}

function fmt(dateStr) {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth()+1}`;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', fontSize:12 }}>
      <div style={{ color:'var(--muted)', marginBottom:4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' && p.name.toLowerCase().includes('revenue') ? `$${p.value.toFixed(0)}` : p.value}</div>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [bookings, setBookings] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('12w');

  const fetchData = async () => {
    const [bRes, cRes] = await Promise.all([
      supabase.from('patient_bookings').select('*'),
      supabase.from('collectors').select('id, name, runs_total, earnings_month'),
    ]);
    setBookings(bRes.data || []);
    setCollectors(cRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const ch = supabase.channel('analytics-page')
      .on('postgres_changes', { event:'*', schema:'public', table:'patient_bookings' }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const cutoff = (() => {
    const d = new Date();
    const weeks = parseInt(range) || 12;
    d.setDate(d.getDate() - weeks * 7);
    return d.toISOString().split('T')[0];
  })();

  const recent = bookings.filter(b => b.scheduled_date && b.scheduled_date >= cutoff);

  // Bookings + revenue per week
  const weekMap = {};
  recent.forEach(b => {
    if (!b.scheduled_date) return;
    const wk = getWeekKey(b.scheduled_date);
    if (!weekMap[wk]) weekMap[wk] = { week: fmt(wk), bookings: 0, revenue: 0 };
    weekMap[wk].bookings++;
    weekMap[wk].revenue += parseFloat(b.amount_charged) || 0;
  });
  const weekData = Object.values(weekMap).sort((a,b) => a.week.localeCompare(b.week));

  // Service type breakdown
  const serviceMap = {};
  recent.forEach(b => {
    const k = b.service_type || 'unknown';
    serviceMap[k] = (serviceMap[k] || 0) + 1;
  });
  const pieData = Object.entries(serviceMap).map(([k,v]) => ({ name: SERVICE_LABELS[k]||k, value: v }));

  // Collector performance
  const collectorData = collectors.map(c => ({
    name: c.name.split(' ')[0],
    runs: c.runs_total || 0,
    earnings: c.earnings_month || 0,
  })).sort((a,b) => b.runs - a.runs).slice(0,8);

  const totalRevenue = recent.reduce((s,b) => s + (parseFloat(b.amount_charged)||0), 0);
  const avgPerBooking = recent.length ? totalRevenue / recent.length : 0;

  if (loading) return <div className="empty-state">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Analytics</div>
          <div className="page-subtitle">{recent.length} bookings · ${totalRevenue.toFixed(0)} revenue</div>
        </div>
        <select className="nura-select" style={{ width:'auto' }} value={range} onChange={e=>setRange(e.target.value)}>
          <option value="4w">Last 4 weeks</option>
          <option value="8w">Last 8 weeks</option>
          <option value="12w">Last 12 weeks</option>
          <option value="26w">Last 6 months</option>
        </select>
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:28 }}>
        {[
          { label:'Total Bookings',    value: recent.length },
          { label:'Total Revenue',     value: `$${totalRevenue.toFixed(0)}` },
          { label:'Avg per Booking',   value: `$${avgPerBooking.toFixed(0)}` },
          { label:'Completed',         value: recent.filter(b=>b.status==='completed').length },
        ].map(s=>(
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ fontSize:24 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        {/* Bookings per week */}
        <div className="panel">
          <div className="panel-header">Bookings per Week</div>
          <div style={{ padding:'16px' }}>
            {weekData.length === 0 ? <div className="empty-state" style={{ padding:32 }}>No data</div> : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={weekData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border2)" />
                  <XAxis dataKey="week" tick={{ fill:'var(--muted)', fontSize:11 }} />
                  <YAxis tick={{ fill:'var(--muted)', fontSize:11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="bookings" stroke="var(--accent)" strokeWidth={2} dot={false} name="Bookings" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Revenue per week */}
        <div className="panel">
          <div className="panel-header">Revenue per Week</div>
          <div style={{ padding:'16px' }}>
            {weekData.length === 0 ? <div className="empty-state" style={{ padding:32 }}>No data</div> : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={weekData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border2)" />
                  <XAxis dataKey="week" tick={{ fill:'var(--muted)', fontSize:11 }} />
                  <YAxis tick={{ fill:'var(--muted)', fontSize:11 }} tickFormatter={v=>`$${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} name="Revenue ($)" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:20 }}>
        {/* Service type pie */}
        <div className="panel">
          <div className="panel-header">By Service Type</div>
          <div style={{ padding:'16px', display:'flex', flexDirection:'column', alignItems:'center' }}>
            {pieData.length === 0 ? <div className="empty-state" style={{ padding:32 }}>No data</div> : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'8px 16px', justifyContent:'center', marginTop:8 }}>
                  {pieData.map((d, i) => (
                    <div key={d.name} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:COLORS[i%COLORS.length] }} />
                      <span style={{ color:'var(--muted)' }}>{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Collector performance */}
        <div className="panel">
          <div className="panel-header">Collector Performance (Runs)</div>
          <div style={{ padding:'16px' }}>
            {collectorData.length === 0 ? <div className="empty-state" style={{ padding:32 }}>No collector data</div> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={collectorData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border2)" />
                  <XAxis dataKey="name" tick={{ fill:'var(--muted)', fontSize:11 }} />
                  <YAxis tick={{ fill:'var(--muted)', fontSize:11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="runs" fill="var(--accent)" radius={[4,4,0,0]} name="Total Runs" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
