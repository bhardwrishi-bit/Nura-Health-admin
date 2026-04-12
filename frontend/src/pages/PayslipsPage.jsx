import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Plus, Printer } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (dateStr) => {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

const fmtDateLong = (dateStr) => {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
};

const fmtPeriod = (start, end) => `${fmtDate(start)} – ${fmtDate(end)}`;

const collectorName = (c) =>
  c ? [c.first_name, c.last_name].filter(Boolean).join(' ') : '—';

const getInitials = (first, last) =>
  `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();

// ── Sub-components ────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const styles = {
    generated: { bg: 'rgba(59,130,246,0.15)',  color: '#3B82F6' },
    sent:      { bg: 'rgba(139,92,246,0.15)',  color: '#8B5CF6' },
    paid:      { bg: 'rgba(16,185,129,0.15)',  color: '#10B981' },
  };
  const s = styles[status] || { bg: 'rgba(128,130,140,0.15)', color: 'var(--muted)' };
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
    }}>
      {status || 'generated'}
    </span>
  );
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

// ── Print layout ──────────────────────────────────────────────────────────────

function PrintPayslip({ data, onClose }) {
  const { payslip: p, collector: c } = data;

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.85)', zIndex: 9998,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        id="nura-print-payslip"
        style={{
          background: 'white', color: '#111',
          width: 680, maxHeight: '90vh', overflowY: 'auto',
          borderRadius: 8, padding: '48px 52px',
          fontFamily: 'Arial, Helvetica, sans-serif',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          position: 'relative',
        }}
      >
        {/* Close button (screen only) */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 16,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: '#888', lineHeight: 1,
          }}
          className="no-print"
        >
          ×
        </button>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, paddingBottom: 20, borderBottom: '2px solid #2B3879' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#2B3879' }}>Nura Health</div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>ABN: 80 126 969 531</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#2B3879', letterSpacing: '0.06em' }}>PAYSLIP</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
              Generated {p.generated_at ? new Date(p.generated_at).toLocaleDateString('en-AU') : '—'}
            </div>
          </div>
        </div>

        {/* Collector info */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', marginBottom: 8 }}>
            Payee Details
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{collectorName(c)}</div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>
                {c?.employment_type === 'employee' ? 'Employee' : 'Contractor'}
              </div>
              {c?.abn && (
                <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>ABN: {c.abn}</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Pay Period</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {fmtDateLong(p.period_start)}
              </div>
              <div style={{ fontSize: 13, color: '#555' }}>to {fmtDateLong(p.period_end)}</div>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', marginBottom: 8 }}>
            Earnings
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f5f7ff' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e0e4ef', fontWeight: 600 }}>Description</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid #e0e4ef', fontWeight: 600 }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid #e0e4ef', fontWeight: 600 }}>Rate</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid #e0e4ef', fontWeight: 600 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid #eee' }}>Blood Collection Services</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid #eee', textAlign: 'center' }}>{p.total_runs}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid #eee', textAlign: 'right' }}>
                  ${parseFloat(p.rate_per_run || 0).toFixed(2)} / run
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid #eee', textAlign: 'right' }}>
                  ${parseFloat(p.total_amount || 0).toFixed(2)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ padding: '12px', fontWeight: 700, textAlign: 'right', fontSize: 15 }}>Total</td>
                <td style={{ padding: '12px', fontWeight: 700, fontSize: 15, textAlign: 'right', color: '#2B3879' }}>
                  ${parseFloat(p.total_amount || 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bank details */}
        {(c?.bank_account_name || c?.bank_bsb || c?.bank_account_no) && (
          <div style={{ marginBottom: 28, background: '#f9faff', borderRadius: 6, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', marginBottom: 8 }}>
              Bank Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, fontSize: 13 }}>
              {c.bank_account_name && (
                <div>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>Account Name</div>
                  <div style={{ fontWeight: 600 }}>{c.bank_account_name}</div>
                </div>
              )}
              {c.bank_bsb && (
                <div>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>BSB</div>
                  <div style={{ fontWeight: 600 }}>{c.bank_bsb}</div>
                </div>
              )}
              {c.bank_account_no && (
                <div>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>Account No.</div>
                  <div style={{ fontWeight: 600 }}>{c.bank_account_no}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #ddd', paddingTop: 14, fontSize: 11, color: '#888', textAlign: 'center' }}>
          Nura Health Pty Ltd · hello@nurahealth.com.au · 0420 424 290
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PayslipsPage() {
  const navigate = useNavigate();
  const [payslips, setPayslips]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [printData, setPrintData] = useState(null);
  const [toast, setToast]         = useState(null);

  // ── Data ─────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    const { data } = await supabase
      .from('collector_payslips')
      .select('*, collectors(id, first_name, last_name, employment_type, abn, bank_account_name, bank_bsb, bank_account_no)')
      .order('created_at', { ascending: false });
    setPayslips(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const ch = supabase.channel('payslips-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collector_payslips' }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  // ── Print ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!printData) return;
    const timer = setTimeout(() => window.print(), 150);
    const afterPrint = () => setPrintData(null);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [printData]);

  const handlePrint = (p) => {
    setPrintData({ payslip: p, collector: p.collectors });
  };

  // ── Status update ─────────────────────────────────────────────────────────

  const updateStatus = async (id, status) => {
    await supabase.from('collector_payslips').update({ status }).eq('id', id);
    fetchData();
  };

  // ── Toast ─────────────────────────────────────────────────────────────────

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ── Stats ─────────────────────────────────────────────────────────────────

  const aestNow     = new Date(Date.now() + 10 * 60 * 60 * 1000);
  const monthPrefix = `${aestNow.getUTCFullYear()}-${String(aestNow.getUTCMonth() + 1).padStart(2, '0')}`;

  const totalGenerated = payslips.length;
  const totalPaidOut   = payslips
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + (parseFloat(p.total_amount) || 0), 0);
  const thisMonth = payslips
    .filter(p => {
      const ts = p.generated_at || p.created_at;
      if (!ts) return false;
      const bAest = new Date(new Date(ts).getTime() + 10 * 60 * 60 * 1000);
      const pfx   = `${bAest.getUTCFullYear()}-${String(bAest.getUTCMonth() + 1).padStart(2, '0')}`;
      return pfx === monthPrefix;
    })
    .reduce((sum, p) => sum + (parseFloat(p.total_amount) || 0), 0);

  return (
    <div>
      {/* Print CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #nura-print-payslip, #nura-print-payslip * { visibility: visible !important; }
          #nura-print-payslip {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important;
            background: white !important;
            padding: 40px !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="page-header">
        <div>
          <div className="page-title">Payslips</div>
          <div className="page-subtitle">{payslips.length} payslips generated</div>
        </div>
        <button className="btn-mint" onClick={() => navigate('/timesheets?tab=payroll')}>
          <Plus size={14} /> Generate Payslip
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Generated', value: totalGenerated,             sub: 'all time' },
          { label: 'Total Paid Out',  value: `$${totalPaidOut.toFixed(2)}`, sub: 'paid payslips' },
          { label: 'This Month',      value: `$${thisMonth.toFixed(2)}`,    sub: 'current month' },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Payslip list */}
      <div className="panel">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : payslips.length === 0 ? (
          <div className="empty-state">No payslips yet. Generate one from the Payroll tab.</div>
        ) : (
          <table className="nura-table">
            <thead><tr>
              <th>Collector</th>
              <th>Period</th>
              <th>Runs</th>
              <th>Rate</th>
              <th>Total</th>
              <th>Status</th>
              <th>Generated</th>
              <th>Actions</th>
            </tr></thead>
            <tbody>
              {payslips.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar
                        firstName={p.collectors?.first_name}
                        lastName={p.collectors?.last_name}
                        size={28}
                      />
                      <span style={{ fontWeight: 500 }}>{collectorName(p.collectors)}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    {fmtPeriod(p.period_start, p.period_end)}
                  </td>
                  <td style={{ fontSize: 13 }}>{p.total_runs}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                    ${parseFloat(p.rate_per_run || 0).toFixed(2)}/run
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--accent)' }}>
                    ${parseFloat(p.total_amount || 0).toFixed(2)}
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {p.generated_at
                      ? new Date(p.generated_at).toLocaleDateString('en-AU')
                      : new Date(p.created_at).toLocaleDateString('en-AU')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        className="btn-ghost"
                        style={{ padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => handlePrint(p)}
                      >
                        <Printer size={12} /> Print PDF
                      </button>
                      <select
                        className="nura-select"
                        style={{ width: 'auto', fontSize: 11, padding: '4px 8px' }}
                        value={p.status || 'generated'}
                        onChange={e => updateStatus(p.id, e.target.value)}
                      >
                        <option value="generated">generated</option>
                        <option value="sent">sent</option>
                        <option value="paid">paid</option>
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Print overlay */}
      {printData && (
        <PrintPayslip data={printData} onClose={() => setPrintData(null)} />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: '#10B981', color: 'white',
          padding: '12px 20px', borderRadius: 8,
          fontSize: 13, fontWeight: 500, zIndex: 9999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
