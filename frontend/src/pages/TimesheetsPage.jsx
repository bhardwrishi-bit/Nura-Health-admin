import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────

const getAESTToday = () => {
  const aest = new Date(Date.now() + 10 * 60 * 60 * 1000);
  return aest.toISOString().split('T')[0];
};

const getAESTMonday = () => {
  const aestNow = new Date(Date.now() + 10 * 60 * 60 * 1000);
  const dow = aestNow.getUTCDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const mon = new Date(aestNow.getTime() - daysFromMon * 24 * 60 * 60 * 1000);
  return mon.toISOString().split('T')[0];
};

const addDays = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().split('T')[0];
};

const getWeekSunday = (mondayStr) => addDays(mondayStr, 6);

const fmtDate = (dateStr) => {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
};

const fmtDateShort = (dateStr) => {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

const fmtTime = (timeStr) => {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const calcHours = (clockIn, clockOut) => {
  if (!clockIn || !clockOut) return '';
  const [h1, m1] = clockIn.split(':').map(Number);
  const [h2, m2] = clockOut.split(':').map(Number);
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins <= 0) return '';
  return (mins / 60).toFixed(2);
};

const collectorName = (c) =>
  c ? [c.first_name, c.last_name].filter(Boolean).join(' ') : '—';

const getInitials = (first, last) =>
  `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();

const EMPTY_FORM = {
  collector_id: '', work_date: getAESTToday(),
  clock_in: '', clock_out: '', hours_worked: '', runs_completed: '', notes: '',
};

// ── Sub-components ────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const map = { pending: 'warning', approved: 'success', rejected: 'danger' };
  return <span className={`badge badge-${map[status] || 'neutral'}`}>{status}</span>;
};

const Avatar = ({ firstName, lastName, size = 32 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: 'var(--primary)', border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.35, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
  }}>
    {getInitials(firstName, lastName)}
  </div>
);

const EmpBadge = ({ type }) => {
  const map = {
    contractor: { bg: 'rgba(139,92,246,0.15)', color: '#8B5CF6' },
    employee:   { bg: 'rgba(59,130,246,0.15)',  color: '#3B82F6' },
  };
  const s = map[type] || map.contractor;
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
      {type || 'contractor'}
    </span>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TimesheetsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tab, setTab]               = useState(searchParams.get('tab') || 'timesheets');
  const [timesheets, setTimesheets] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState(null);

  // Tab 1
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [saving, setSaving]               = useState(false);
  const [weekFilter, setWeekFilter]       = useState(getAESTMonday());
  const [collectorFilter, setCollFilter]  = useState('');

  // Tab 3
  const [payrollWeekStart, setPayrollWeekStart] = useState(getAESTMonday());
  const [rates, setRates]                       = useState({});
  const [generating, setGenerating]             = useState({});

  // ── Data ─────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    const [tRes, cRes] = await Promise.all([
      supabase.from('timesheets')
        .select('*, collectors(id, first_name, last_name)')
        .order('work_date', { ascending: false }),
      supabase.from('collectors')
        .select('id, first_name, last_name, employment_type')
        .eq('status', 'active')
        .order('first_name'),
    ]);
    setTimesheets(tRes.data || []);
    setCollectors(cRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Seed default rates (non-destructive)
  useEffect(() => {
    setRates(prev => {
      const updated = { ...prev };
      collectors.forEach(c => {
        if (!(c.id in updated)) {
          updated[c.id] = c.employment_type === 'employee' ? 30 : 25;
        }
      });
      return updated;
    });
  }, [collectors]);

  // ── Toast ─────────────────────────────────────────────────────────────────

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Derived stats ─────────────────────────────────────────────────────────

  const currentMon      = getAESTMonday();
  const currentSun      = getWeekSunday(currentMon);
  const thisWeekApproved = timesheets.filter(
    t => t.status === 'approved' && t.work_date >= currentMon && t.work_date <= currentSun
  );
  const totalHours   = thisWeekApproved.reduce((s, t) => s + (parseFloat(t.hours_worked) || 0), 0);
  const totalRuns    = thisWeekApproved.reduce((s, t) => s + (parseInt(t.runs_completed)  || 0), 0);
  const pendingCount = timesheets.filter(t => t.status === 'pending').length;

  // ── Tab 1 handlers ────────────────────────────────────────────────────────

  const handleFormChange = (field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'clock_in' || field === 'clock_out') {
        const h = calcHours(
          field === 'clock_in'  ? value : prev.clock_in,
          field === 'clock_out' ? value : prev.clock_out,
        );
        if (h) updated.hours_worked = h;
      }
      return updated;
    });
  };

  const handleLogTimesheet = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await supabase.from('timesheets').insert({
        collector_id:   form.collector_id,
        work_date:      form.work_date,
        clock_in:       form.clock_in       || null,
        clock_out:      form.clock_out      || null,
        hours_worked:   parseFloat(form.hours_worked)  || null,
        runs_completed: parseInt(form.runs_completed)  || 0,
        notes:          form.notes || null,
        status:         'pending',
      });
      setForm({ ...EMPTY_FORM, work_date: getAESTToday() });
      await fetchData();
      showToast('Timesheet logged successfully');
    } finally {
      setSaving(false);
    }
  };

  // ── Tab 2 handlers ────────────────────────────────────────────────────────

  const handleApprove = async (id) => {
    await supabase.from('timesheets').update({
      status: 'approved', approved_by: 'Admin', approved_at: new Date().toISOString(),
    }).eq('id', id);
    fetchData();
  };

  const handleReject = async (id) => {
    await supabase.from('timesheets').update({
      status: 'rejected', approved_by: 'Admin', approved_at: new Date().toISOString(),
    }).eq('id', id);
    fetchData();
  };

  // ── Tab 3 handlers ────────────────────────────────────────────────────────

  const payrollWeekEnd = getWeekSunday(payrollWeekStart);

  const handleGeneratePayslip = async (collector) => {
    setGenerating(g => ({ ...g, [collector.id]: true }));
    try {
      const rate = rates[collector.id] ?? 25;
      const collTs = timesheets.filter(t =>
        t.collector_id === collector.id &&
        t.status === 'approved' &&
        t.work_date >= payrollWeekStart &&
        t.work_date <= payrollWeekEnd
      );
      const totalRunsVal   = collTs.reduce((s, t) => s + (parseInt(t.runs_completed) || 0), 0);
      const totalAmountVal = totalRunsVal * rate;

      await supabase.from('collector_payslips').insert({
        collector_id: collector.id,
        period_start: payrollWeekStart,
        period_end:   payrollWeekEnd,
        total_runs:   totalRunsVal,
        total_amount: totalAmountVal,
        rate_per_run: rate,
        status:       'generated',
        generated_at: new Date().toISOString(),
      });

      showToast(`Payslip generated for ${collectorName(collector)}`);
      setTimeout(() => navigate('/payslips'), 1500);
    } finally {
      setGenerating(g => ({ ...g, [collector.id]: false }));
    }
  };

  // ── Filtered timesheets (Tab 1) ───────────────────────────────────────────

  const weekEnd = getWeekSunday(weekFilter);
  const filteredTimesheets = timesheets.filter(t => {
    const wk   = t.work_date >= weekFilter && t.work_date <= weekEnd;
    const coll = !collectorFilter || t.collector_id === collectorFilter;
    return wk && coll;
  });

  const pendingTimesheets = timesheets.filter(t => t.status === 'pending');

  if (loading) return <div className="empty-state">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Timesheets</div>
          <div className="page-subtitle">{pendingCount} pending approval</div>
        </div>
      </div>

      <div className="tab-bar">
        {[
          ['timesheets', 'Timesheets'],
          ['approve',    `Approve${pendingCount > 0 ? ` (${pendingCount})` : ''}`],
          ['payroll',    'Payroll'],
        ].map(([key, lbl]) => (
          <button key={key} className={`tab-item${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── TAB 1: TIMESHEETS ──────────────────────────────────────────── */}
      {tab === 'timesheets' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total Hours This Week', value: totalHours.toFixed(1) + 'h', sub: 'approved timesheets' },
              { label: 'Total Runs This Week',  value: totalRuns,                   sub: 'approved timesheets' },
              { label: 'Pending Approval',      value: pendingCount,                sub: 'awaiting review' },
            ].map(s => (
              <div className="stat-card" key={s.label}>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
            {/* Log form */}
            <div className="panel">
              <div className="panel-header"><span>Log Timesheet</span></div>
              <form onSubmit={handleLogTimesheet} style={{ padding: '16px 18px' }}>
                <div style={{ marginBottom: 12 }}>
                  <label className="nura-label">Collector *</label>
                  <select className="nura-select" value={form.collector_id}
                    onChange={e => handleFormChange('collector_id', e.target.value)} required>
                    <option value="">Select collector…</option>
                    {collectors.map(c => (
                      <option key={c.id} value={c.id}>{collectorName(c)}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label className="nura-label">Work Date *</label>
                  <input className="nura-input" type="date" value={form.work_date}
                    onChange={e => handleFormChange('work_date', e.target.value)} required />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label className="nura-label">Clock In</label>
                    <input className="nura-input" type="time" value={form.clock_in}
                      onChange={e => handleFormChange('clock_in', e.target.value)} />
                  </div>
                  <div>
                    <label className="nura-label">Clock Out</label>
                    <input className="nura-input" type="time" value={form.clock_out}
                      onChange={e => handleFormChange('clock_out', e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label className="nura-label">Hours Worked</label>
                    <input className="nura-input" type="number" step="0.25" min="0" value={form.hours_worked}
                      onChange={e => handleFormChange('hours_worked', e.target.value)}
                      placeholder="Auto-calculated" />
                  </div>
                  <div>
                    <label className="nura-label">Runs Completed *</label>
                    <input className="nura-input" type="number" min="0" value={form.runs_completed}
                      onChange={e => handleFormChange('runs_completed', e.target.value)}
                      required placeholder="0" />
                  </div>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label className="nura-label">Notes</label>
                  <textarea className="nura-input" rows={2} value={form.notes}
                    onChange={e => handleFormChange('notes', e.target.value)}
                    style={{ resize: 'vertical' }} placeholder="Optional notes…" />
                </div>

                <button type="submit" className="btn-mint" style={{ width: '100%' }} disabled={saving}>
                  {saving ? 'Saving…' : '+ Log Timesheet'}
                </button>
              </form>
            </div>

            {/* Timesheet list */}
            <div className="panel">
              <div className="panel-header">
                <span>Timesheet Log</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 12 }}
                    onClick={() => setWeekFilter(addDays(weekFilter, -7))}>←</button>
                  <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {fmtDateShort(weekFilter)} – {fmtDateShort(weekEnd)}
                  </span>
                  <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 12 }}
                    onClick={() => setWeekFilter(addDays(weekFilter, 7))}>→</button>
                  <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 11 }}
                    onClick={() => setWeekFilter(getAESTMonday())}>This Week</button>
                  <select className="nura-select"
                    style={{ width: 140, fontSize: 12, padding: '4px 8px' }}
                    value={collectorFilter} onChange={e => setCollFilter(e.target.value)}>
                    <option value="">All Collectors</option>
                    {collectors.map(c => (
                      <option key={c.id} value={c.id}>{collectorName(c)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredTimesheets.length === 0 ? (
                <div className="empty-state">No timesheets logged yet</div>
              ) : (
                <table className="nura-table">
                  <thead><tr>
                    <th>Collector</th><th>Date</th><th>Clock In</th><th>Clock Out</th>
                    <th>Hours</th><th>Runs</th><th>Status</th><th>Notes</th>
                  </tr></thead>
                  <tbody>
                    {filteredTimesheets.map(t => (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 500 }}>{collectorName(t.collectors)}</td>
                        <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(t.work_date)}</td>
                        <td style={{ fontSize: 12 }}>{fmtTime(t.clock_in)}</td>
                        <td style={{ fontSize: 12 }}>{fmtTime(t.clock_out)}</td>
                        <td style={{ fontSize: 12 }}>
                          {t.hours_worked ? `${parseFloat(t.hours_worked).toFixed(1)}h` : '—'}
                        </td>
                        <td style={{ fontSize: 12 }}>{t.runs_completed ?? '—'}</td>
                        <td><StatusBadge status={t.status} /></td>
                        <td style={{
                          fontSize: 11, color: 'var(--muted)',
                          maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {t.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── TAB 2: APPROVE ─────────────────────────────────────────────── */}
      {tab === 'approve' && (
        <>
          {pendingTimesheets.length === 0 ? (
            <div className="empty-state">No timesheets pending approval 🎉</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
              {pendingTimesheets.map(t => (
                <div key={t.id} style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderLeft: '4px solid var(--warning)',
                  borderRadius: 10,
                  padding: '18px 20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <Avatar
                      firstName={t.collectors?.first_name}
                      lastName={t.collectors?.last_name}
                      size={38}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{collectorName(t.collectors)}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtDate(t.work_date)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div style={{ background: 'var(--card2)', borderRadius: 7, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                        Hours
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
                        {t.hours_worked ? `${parseFloat(t.hours_worked).toFixed(1)}h` : '—'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
                        {fmtTime(t.clock_in)} – {fmtTime(t.clock_out)}
                      </div>
                    </div>
                    <div style={{ background: 'var(--card2)', borderRadius: 7, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                        Runs
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
                        {t.runs_completed ?? '—'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>collections</div>
                    </div>
                  </div>

                  {t.notes && (
                    <div style={{
                      fontSize: 12, color: 'var(--muted)',
                      background: 'var(--card2)', borderRadius: 6,
                      padding: '8px 12px', marginBottom: 12,
                    }}>
                      {t.notes}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn-success"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => handleApprove(t.id)}
                    >
                      ✓ Approve
                    </button>
                    <button
                      className="btn-danger"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => handleReject(t.id)}
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TAB 3: PAYROLL ─────────────────────────────────────────────── */}
      {tab === 'payroll' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Period:</span>
            <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}
              onClick={() => setPayrollWeekStart(addDays(payrollWeekStart, -7))}>←</button>
            <span style={{ fontSize: 13, color: 'var(--muted)', minWidth: 220, textAlign: 'center' }}>
              {fmtDate(payrollWeekStart)} – {fmtDate(payrollWeekEnd)}
            </span>
            <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}
              onClick={() => setPayrollWeekStart(addDays(payrollWeekStart, 7))}>→</button>
            <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}
              onClick={() => setPayrollWeekStart(getAESTMonday())}>This Week</button>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span>Generate Payslips</span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{collectors.length} active collectors</span>
            </div>

            {collectors.length === 0 ? (
              <div className="empty-state">No active collectors</div>
            ) : (
              <table className="nura-table">
                <thead><tr>
                  <th>Collector</th>
                  <th>Type</th>
                  <th>Approved Runs</th>
                  <th>Hours</th>
                  <th>Rate / Run</th>
                  <th>Total</th>
                  <th>Action</th>
                </tr></thead>
                <tbody>
                  {collectors.map(c => {
                    const collTs = timesheets.filter(t =>
                      t.collector_id === c.id &&
                      t.status === 'approved' &&
                      t.work_date >= payrollWeekStart &&
                      t.work_date <= payrollWeekEnd
                    );
                    const approvedRuns  = collTs.reduce((s, t) => s + (parseInt(t.runs_completed) || 0), 0);
                    const approvedHours = collTs.reduce((s, t) => s + (parseFloat(t.hours_worked)  || 0), 0);
                    const rate          = rates[c.id] ?? 25;
                    const total         = approvedRuns * rate;
                    const hasRuns       = approvedRuns > 0;

                    return (
                      <tr key={c.id} style={{ opacity: hasRuns ? 1 : 0.4 }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar firstName={c.first_name} lastName={c.last_name} size={30} />
                            <span style={{ fontWeight: 500 }}>{collectorName(c)}</span>
                          </div>
                        </td>
                        <td><EmpBadge type={c.employment_type} /></td>
                        <td style={{ fontWeight: 600 }}>{approvedRuns}</td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {approvedHours > 0 ? `${approvedHours.toFixed(1)}h` : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 13, color: 'var(--muted)' }}>$</span>
                            <input
                              type="number" step="0.50" min="0"
                              className="nura-input"
                              style={{ width: 72, padding: '4px 8px', fontSize: 13 }}
                              value={rate}
                              onChange={e =>
                                setRates(r => ({ ...r, [c.id]: parseFloat(e.target.value) || 0 }))
                              }
                            />
                          </div>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--accent)' }}>
                          ${total.toFixed(2)}
                        </td>
                        <td>
                          <button
                            className="btn-mint"
                            style={{ padding: '5px 12px', fontSize: 12 }}
                            disabled={!hasRuns || !!generating[c.id]}
                            title={!hasRuns ? 'No approved timesheets in this period' : undefined}
                            onClick={() => handleGeneratePayslip(c)}
                          >
                            {generating[c.id] ? 'Generating…' : 'Generate Payslip →'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: toast.type === 'success' ? '#10B981' : 'var(--danger)',
          color: 'white', padding: '12px 20px', borderRadius: 8,
          fontSize: 13, fontWeight: 500, zIndex: 9999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
