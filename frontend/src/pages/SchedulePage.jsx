import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TIME_BANDS = [
  { key: 'morning',        label: 'Morning',          time: '8:00 AM – 11:00 AM', slots: ['morning','morning-early','morning-late'] },
  { key: 'afternoon-early', label: 'Early Afternoon',  time: '11:00 AM – 1:00 PM',  slots: ['afternoon-early'] },
  { key: 'afternoon-mid',   label: 'Mid Afternoon',    time: '1:00 PM – 3:00 PM',   slots: ['afternoon-mid'] },
  { key: 'afternoon-late',  label: 'Late Afternoon',   time: '3:00 PM – 5:00 PM',   slots: ['afternoon-late','evening'] },
];

const MONTHS      = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_S    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_S      = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const DAYS_FULL   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const addDays = (dateStr, n) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().split('T')[0];
};

const getAESTToday = () => {
  const aest = new Date(Date.now() + 10 * 60 * 60 * 1000);
  return aest.toISOString().split('T')[0];
};

const getMonday = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
  return addDays(dateStr, dow === 0 ? -6 : 1 - dow);
};

const getDOW = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

const fmtDayCol = (dateStr) => {
  const [, , d] = dateStr.split('-').map(Number);
  return `${DAYS_S[getDOW(dateStr)]} ${d}`;
};

const fmtDayFull = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${DAYS_FULL[getDOW(dateStr)]}, ${d} ${MONTHS[m - 1]} ${y}`;
};

const fmtShort = (dateStr) => {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${DAYS_FULL[getDOW(dateStr)].slice(0, 3)} ${d} ${MONTHS_S[m - 1]}`;
};

const formatService = (type) => ({
  'home-visit': 'Home Visit', 'home': 'Home Visit', 'home_visit': 'Home Visit',
  'ndis': 'NDIS',
  'corporate': 'Corporate',
  'aged-care': 'Aged Care', 'aged_care': 'Aged Care',
  'urgent': 'Priority',
})[type] || type;

const formatTime = (slot) => ({
  'morning':         '8–11AM',
  'morning-early':   '7–9AM',
  'morning-late':    '9–11AM',
  'afternoon-early': '11AM–1PM',
  'afternoon-mid':   '1–3PM',
  'afternoon-late':  '3–5PM',
  'evening':         '3–5PM',
})[slot] || slot || '—';

const statusBorderColor = (s) => ({
  confirmed:       '#3b82f6',
  completed:       '#22c55e',
  pending:         '#f59e0b',
  pending_payment: '#f59e0b',
  cancelled:       '#ef4444',
})[s] || '#4b5563';

const serviceDotColor = (type) => ({
  'home-visit': '#80E5CB', 'home': '#80E5CB', 'home_visit': '#80E5CB',
  'ndis': '#a855f7',
  'corporate': '#3b82f6',
  'aged-care': '#f59e0b', 'aged_care': '#f59e0b',
  'urgent': '#ef4444',
})[type] || '#9ca3af';

const getInitials = (f, l) => `${(f || '').charAt(0)}${(l || '').charAt(0)}`.toUpperCase() || '?';

// ─── BookingCard ───────────────────────────────────────────────────────────────

function BookingCard({ booking }) {
  return (
    <div style={{
      borderLeft: `3px solid ${statusBorderColor(booking.status)}`,
      background: 'var(--card2)',
      borderRadius: '0 4px 4px 0',
      padding: '5px 7px',
      marginBottom: 4,
      fontSize: 11,
      lineHeight: 1.4,
    }}>
      <div style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {booking.first_name} {booking.last_name}
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 10 }}>{formatTime(booking.scheduled_time)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: serviceDotColor(booking.service_type), flexShrink: 0 }} />
        <span style={{ color: 'var(--muted)', fontSize: 10 }}>{formatService(booking.service_type)}</span>
      </div>
    </div>
  );
}

// ─── WeekView ──────────────────────────────────────────────────────────────────

function WeekView({ weekDays, collectors, bookings, todayStr }) {
  const getCell = (collectorId, dateStr) =>
    bookings.filter(b => b.collector_id === collectorId && b.scheduled_date === dateStr);

  const cellBase = {
    padding: '6px',
    verticalAlign: 'top',
    borderRight: '1px solid var(--border2)',
    borderBottom: '1px solid var(--border2)',
    minWidth: 130,
    minHeight: 56,
  };

  if (collectors.length === 0) return <div className="empty-state">No active collectors</div>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 160 }} />
          {weekDays.map(d => <col key={d} style={{ width: 140 }} />)}
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...cellBase, background: 'var(--card)', fontSize: 11, color: 'var(--muted)', fontWeight: 600, position: 'sticky', left: 0, zIndex: 2, width: 160 }}>
              COLLECTOR
            </th>
            {weekDays.map(d => (
              <th key={d} style={{
                ...cellBase,
                background: d === todayStr ? 'rgba(128,229,203,0.07)' : 'var(--card)',
                fontSize: 12,
                fontWeight: d === todayStr ? 700 : 500,
                color: d === todayStr ? 'var(--accent)' : 'var(--text)',
                textAlign: 'center',
                padding: '10px 6px',
              }}>
                {fmtDayCol(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {collectors.map(c => (
            <tr key={c.id}>
              {/* Collector name — sticky left */}
              <td style={{
                ...cellBase,
                background: 'var(--card)',
                position: 'sticky', left: 0, zIndex: 1,
                padding: '8px 10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: '#80E5CB', color: '#00001E',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, flexShrink: 0,
                  }}>
                    {getInitials(c.first_name, c.last_name)}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}>
                    <div>{c.first_name}</div>
                    <div style={{ color: 'var(--muted)', fontWeight: 400 }}>{c.last_name}</div>
                  </div>
                </div>
              </td>

              {/* Day cells */}
              {weekDays.map(d => {
                const cards = getCell(c.id, d);
                return (
                  <td key={d} style={{
                    ...cellBase,
                    background: d === todayStr ? 'rgba(128,229,203,0.04)' : 'transparent',
                    position: 'relative',
                  }}>
                    {cards.length > 0
                      ? cards.map(b => <BookingCard key={b.id} booking={b} />)
                      : (
                        <div title="Assign booking" style={{
                          height: '100%', minHeight: 48,
                          border: '1px dashed var(--border2)',
                          borderRadius: 4,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'rgba(255,255,255,0.08)',
                          fontSize: 16, cursor: 'default',
                          transition: 'color 0.15s',
                        }}
                          onMouseEnter={e => e.currentTarget.style.color = 'rgba(128,229,203,0.3)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.08)'}
                        >
                          +
                        </div>
                      )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── DayView ───────────────────────────────────────────────────────────────────

function DayView({ dayStr, collectors, bookings }) {
  const getSlotBookings = (collectorId, bandSlots) =>
    bookings.filter(b =>
      b.collector_id === collectorId &&
      b.scheduled_date === dayStr &&
      bandSlots.includes(b.scheduled_time)
    );

  if (collectors.length === 0) return <div className="empty-state">No active collectors</div>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <colgroup>
          <col style={{ width: 170 }} />
          {collectors.map(c => <col key={c.id} style={{ minWidth: 150 }} />)}
        </colgroup>
        <thead>
          <tr>
            <th style={{ padding: '10px 12px', fontSize: 11, color: 'var(--muted)', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid var(--border2)', position: 'sticky', left: 0, background: 'var(--card)', zIndex: 2 }}>
              TIME SLOT
            </th>
            {collectors.map(c => (
              <th key={c.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border2)', borderLeft: '1px solid var(--border2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#80E5CB', color: '#00001E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                    {getInitials(c.first_name, c.last_name)}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{c.first_name} {c.last_name}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIME_BANDS.map(band => (
            <tr key={band.key}>
              <td style={{ padding: '10px 12px', verticalAlign: 'top', borderBottom: '1px solid var(--border2)', position: 'sticky', left: 0, background: 'var(--card)', zIndex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{band.label}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{band.time}</div>
              </td>
              {collectors.map(c => {
                const cards = getSlotBookings(c.id, band.slots);
                return (
                  <td key={c.id} style={{ padding: '8px', verticalAlign: 'top', borderBottom: '1px solid var(--border2)', borderLeft: '1px solid var(--border2)', minWidth: 150, minHeight: 60 }}>
                    {cards.length > 0
                      ? cards.map(b => <BookingCard key={b.id} booking={b} />)
                      : (
                        <div style={{ height: 40, border: '1px dashed var(--border2)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.08)', fontSize: 14 }}
                          onMouseEnter={e => e.currentTarget.style.color = 'rgba(128,229,203,0.3)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.08)'}
                        >
                          +
                        </div>
                      )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── UnassignedPanel ───────────────────────────────────────────────────────────

function UnassignedPanel({ bookings }) {
  if (bookings.length === 0) return null;

  const statusMap = { confirmed: 'accent', completed: 'success', pending: 'warning', cancelled: 'danger', pending_payment: 'warning' };

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#f59e0b' }}>Unassigned Bookings</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{bookings.length} need assignment</span>
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {bookings.map(b => (
          <div key={b.id} style={{
            background: 'var(--card)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 8,
            padding: '12px 14px',
            minWidth: 220,
            flexShrink: 0,
          }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
              {b.first_name} {b.last_name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>
              {fmtShort(b.scheduled_date)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
              {formatTime(b.scheduled_time)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: serviceDotColor(b.service_type) }} />
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatService(b.service_type)}</span>
              <span className={`badge badge-${statusMap[b.status] || 'neutral'}`} style={{ marginLeft: 'auto', fontSize: 9 }}>
                {b.status?.replace(/_/g, ' ')}
              </span>
            </div>
            <button
              className="btn-ghost"
              style={{ width: '100%', justifyContent: 'center', fontSize: 11, padding: '4px 0', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)' }}
              onClick={() => {}}
            >
              Assign →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const [collectors,  setCollectors]  = useState([]);
  const [bookings,    setBookings]    = useState([]);
  const [unassigned,  setUnassigned]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [viewMode,    setViewMode]    = useState('week');
  const [weekStart,   setWeekStart]   = useState(() => getMonday(getAESTToday()));
  const [dayIndex,    setDayIndex]    = useState(() => {
    const today = getAESTToday();
    const mon   = getMonday(today);
    const diff  = Math.round((Date.parse(today) - Date.parse(mon)) / 86400000);
    return Math.max(0, Math.min(6, diff));
  });
  const [collectorFilter, setCollectorFilter] = useState('all');

  const todayStr  = getAESTToday();
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayStr    = weekDays[dayIndex] || weekDays[0];

  const fetchData = useCallback(async (ws) => {
    setLoading(true);
    const rangeStart = addDays(ws, -7);
    const rangeEnd   = addDays(ws, 14);

    const [colRes, bkRes, unRes] = await Promise.all([
      supabase.from('collectors')
        .select('id, first_name, last_name, employment_type')
        .eq('status', 'active')
        .order('first_name'),
      supabase.from('patient_bookings')
        .select('id, booking_ref, first_name, last_name, service_type, scheduled_date, scheduled_time, address, suburb, status, collector_id, amount_charged, invoice_status')
        .gte('scheduled_date', rangeStart)
        .lte('scheduled_date', rangeEnd)
        .not('collector_id', 'is', null)
        .order('scheduled_date')
        .order('scheduled_time'),
      supabase.from('patient_bookings')
        .select('id, booking_ref, first_name, last_name, service_type, scheduled_date, scheduled_time, status, collector_id')
        .is('collector_id', null)
        .gte('scheduled_date', todayStr)
        .order('scheduled_date'),
    ]);

    setCollectors(colRes.data || []);
    setBookings(bkRes.data || []);
    setUnassigned(unRes.data || []);
    setLoading(false);
  }, [todayStr]);

  useEffect(() => { fetchData(weekStart); }, [weekStart, fetchData]);

  // ── Navigation ──
  const goBack = () => {
    if (viewMode === 'week') {
      setWeekStart(ws => addDays(ws, -7));
    } else {
      if (dayIndex === 0) { setWeekStart(ws => addDays(ws, -7)); setDayIndex(6); }
      else setDayIndex(i => i - 1);
    }
  };

  const goForward = () => {
    if (viewMode === 'week') {
      setWeekStart(ws => addDays(ws, 7));
    } else {
      if (dayIndex === 6) { setWeekStart(ws => addDays(ws, 7)); setDayIndex(0); }
      else setDayIndex(i => i + 1);
    }
  };

  const goToday = () => {
    const today = getAESTToday();
    const mon   = getMonday(today);
    const diff  = Math.max(0, Math.min(6, Math.round((Date.parse(today) - Date.parse(mon)) / 86400000)));
    setWeekStart(mon);
    setDayIndex(diff);
  };

  // ── Filtered collectors ──
  const visibleCollectors = collectorFilter === 'all'
    ? collectors
    : collectors.filter(c => c.id === collectorFilter);

  // ── Header label ──
  const [, wm, wd] = weekStart.split('-').map(Number);
  const weekLabel = viewMode === 'week'
    ? `Week of Mon ${wd} ${MONTHS[wm - 1]} ${weekStart.split('-')[0]}`
    : fmtDayFull(dayStr);

  if (loading) return <div className="empty-state">Loading…</div>;

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title">Schedule</div>
          <div className="page-subtitle">{visibleCollectors.length} collectors · {weekLabel}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Week navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="btn-ghost" onClick={goBack}  style={{ padding: '6px 8px' }}><ChevronLeft  size={15} /></button>
            <button className="btn-ghost" onClick={goToday} style={{ fontSize: 12, padding: '6px 12px' }}>Today</button>
            <button className="btn-ghost" onClick={goForward} style={{ padding: '6px 8px' }}><ChevronRight size={15} /></button>
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {['week','day'].map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: viewMode === v ? 600 : 400,
                  background: viewMode === v ? 'var(--primary)' : 'transparent',
                  color: viewMode === v ? '#fff' : 'var(--muted)',
                  border: 'none', cursor: 'pointer', textTransform: 'capitalize',
                }}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Collector filter */}
          <select className="nura-select" style={{ width: 'auto' }} value={collectorFilter} onChange={e => setCollectorFilter(e.target.value)}>
            <option value="all">All Collectors</option>
            {collectors.map(c => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main grid */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        {viewMode === 'week'
          ? <WeekView weekDays={weekDays} collectors={visibleCollectors} bookings={bookings} todayStr={todayStr} />
          : <DayView  dayStr={dayStr}     collectors={visibleCollectors} bookings={bookings} />}
      </div>

      {/* Unassigned bookings */}
      <UnassignedPanel bookings={unassigned} />
    </div>
  );
}
