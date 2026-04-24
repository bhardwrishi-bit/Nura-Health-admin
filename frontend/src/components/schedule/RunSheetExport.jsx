import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

const NAVY   = '#2B3879';
const MINT   = '#80E5CB';
const BLACK  = '#00001E';
const DROP_OFF = 'Drop specimens at: Sullivan Nicolaides Pathology, 24 Bowen Bridge Road, Bowen Hills QLD 4006';

const SERVICE_LABELS = {
  'home':          'Home Collection',
  'home-visit':    'Home Collection',
  'home_visit':    'Home Collection',
  'urgent':        'Urgent Home Collection',
  'ndis':          'NDIS',
  'ndis-standard': 'NDIS Standard',
  'ndis-urgent':   'NDIS Urgent',
  'agedcare':      'Aged Care',
  'aged-care':     'Aged Care',
  'aged_care':     'Aged Care',
  'corporate':     'Corporate',
};

// Badge colour pairs: [background, text]
const SERVICE_BADGE = {
  'home':          [NAVY,      '#FFFFFF'],
  'home-visit':    [NAVY,      '#FFFFFF'],
  'home_visit':    [NAVY,      '#FFFFFF'],
  'urgent':        [NAVY,      '#FFFFFF'],
  'ndis':          [MINT,      BLACK],
  'ndis-standard': [MINT,      BLACK],
  'ndis-urgent':   [MINT,      BLACK],
  'agedcare':      ['#E59C00', '#FFFFFF'],
  'aged-care':     ['#E59C00', '#FFFFFF'],
  'aged_care':     ['#E59C00', '#FFFFFF'],
  'corporate':     ['#6B7280', '#FFFFFF'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function fmtDateBrisbane(dateStr) {
  // dateStr is YYYY-MM-DD — treat as Brisbane local date (no UTC shift)
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0); // noon local, safe from DST
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Australia/Brisbane',
  }).format(dt);
}

function fmtDOB(dob) {
  if (!dob) return null;
  // dob is YYYY-MM-DD
  const [y, m, d] = dob.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

function estDuration(count) {
  const mins = count * 30;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── Prescription lookup ──────────────────────────────────────────────────────

async function fetchPrescriptionUrl(booking) {
  if (!booking.referral_uploaded) return null;

  // Files are named exactly "{booking.id}.pdf" in the Prescriptions bucket
  const filePath = `${booking.id}.pdf`;
  const { data, error } = await supabase.storage
    .from('Prescriptions')
    .createSignedUrl(filePath, 86400); // 24 hours

  if (error || !data?.signedUrl) {
    // referral_uploaded is true but file not found in bucket
    return { found: false };
  }

  return { url: data.signedUrl, found: true };
}

async function buildQRDataUrl(url) {
  try {
    return await QRCode.toDataURL(url, {
      width: 150,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
  } catch {
    return null;
  }
}

// ─── PDF generation ───────────────────────────────────────────────────────────

async function generateRunSheet(collectorName, date, bookings) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const PW = 210; // page width mm
  const PH = 297; // page height mm
  const ML = 14;  // margin left
  const MR = 14;  // margin right
  const CW = PW - ML - MR; // content width
  const FOOTER_H = 10;
  const FOOTER_Y = PH - FOOTER_H - 4;

  // Pre-fetch all prescription data before drawing
  const prescriptions = {};
  for (const b of bookings) {
    if (b.referral_uploaded) {
      prescriptions[b.id] = await fetchPrescriptionUrl(b);
    }
  }

  // Prefetch QR codes
  const qrImages = {};
  for (const b of bookings) {
    const p = prescriptions[b.id];
    if (p?.found && p.url) {
      qrImages[b.id] = await buildQRDataUrl(p.url);
    }
  }

  // ── Page helpers ──────────────────────────────────────────────────────────

  let pageNum = 1;

  const drawFooter = () => {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(ML, FOOTER_Y - 2, PW - MR, FOOTER_Y - 2);
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.text(DROP_OFF, ML, FOOTER_Y + 2);
    doc.text(`Page ${pageNum}`, PW - MR, FOOTER_Y + 2, { align: 'right' });
  };

  const drawHeader = () => {
    // Navy header bar
    doc.setFillColor(...hexToRgb(NAVY));
    doc.rect(0, 0, PW, 22, 'F');

    // "nura" wordmark
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('nura', ML, 14.5);

    // Collector name (right aligned)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(collectorName, PW - MR, 9.5, { align: 'right' });

    // Date
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(fmtDateBrisbane(date), PW - MR, 16, { align: 'right' });

    // Mint accent sub-bar
    doc.setFillColor(...hexToRgb(MINT));
    doc.rect(0, 22, PW, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...hexToRgb(BLACK));
    const summary = `${bookings.length} stop${bookings.length !== 1 ? 's' : ''}  ·  Est. ${estDuration(bookings.length)} (30 min/stop)  ·  Run Sheet`;
    doc.text(summary, ML, 27.2);

    drawFooter();
  };

  // ── First page header ─────────────────────────────────────────────────────
  drawHeader();
  let y = 34; // content starts here

  const ensureSpace = (needed) => {
    if (y + needed > FOOTER_Y - 4) {
      doc.addPage();
      pageNum++;
      drawHeader();
      y = 34;
    }
  };

  // ── Stop blocks ───────────────────────────────────────────────────────────

  for (let i = 0; i < bookings.length; i++) {
    const b = bookings[i];
    const stopNum = i + 1;
    const pres = prescriptions[b.id];
    const hasQR = pres?.found && qrImages[b.id];
    const showScriptWarning = pres && !pres.found;

    // Estimate block height
    let blockH = 34; // base: stop row + time/service + address + ref
    if (b.date_of_birth) blockH += 4;
    if (b.special_notes) blockH += 10;
    if (hasQR) blockH += 30;
    if (showScriptWarning) blockH += 8;

    ensureSpace(blockH + 4);

    const blockY = y;

    // Stop number pill + time
    doc.setFillColor(...hexToRgb(NAVY));
    doc.roundedRect(ML, blockY, 7, 7, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(String(stopNum), ML + 3.5, blockY + 5, { align: 'center' });

    // Scheduled time
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...hexToRgb(BLACK));
    const timeStr = b.scheduled_time || '—';
    doc.text(timeStr, ML + 10, blockY + 5.5);

    // Service badge
    const svcLabel = SERVICE_LABELS[b.service_type] || b.service_type || '—';
    const [bgHex, fgHex] = SERVICE_BADGE[b.service_type] || ['#6B7280', '#FFFFFF'];
    const badgeX = ML + 10 + doc.getTextWidth(timeStr) + 4;
    const badgeW = doc.getTextWidth(svcLabel) * (8 / 10) + 5; // rough at 8pt
    doc.setFontSize(8);
    const badgeTempW = doc.getTextWidth(svcLabel) + 5;
    doc.setFillColor(...hexToRgb(bgHex));
    doc.roundedRect(badgeX, blockY + 0.5, badgeTempW, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...hexToRgb(fgHex));
    doc.text(svcLabel, badgeX + 2.5, blockY + 5);

    y = blockY + 10;

    // Patient name + DOB
    const fullName = `${b.first_name || ''} ${b.last_name || ''}`.trim();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...hexToRgb(BLACK));
    doc.text(fullName, ML, y);
    y += 5;

    if (b.date_of_birth) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(80, 80, 80);
      doc.text(`DOB: ${fmtDOB(b.date_of_birth)}`, ML, y);
      y += 4.5;
    }

    // Phone — "Phone:" label in bold navy, number in regular dark text
    if (b.phone) {
      const phoneLabel = 'Phone:';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...hexToRgb(NAVY));
      doc.text(phoneLabel, ML, y);
      const labelW = doc.getTextWidth(phoneLabel);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      doc.text(` ${b.phone}`, ML + labelW, y);
      // Clickable tel link for digital viewers
      doc.link(ML, y - 4, 80, 5, { url: `tel:${b.phone.replace(/\s/g, '')}` });
      y += 5;
    }

    // Address — render booking.address as-is (already includes suburb/state/postcode)
    if (b.address) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      doc.text(b.address, ML, y);
      y += 5;
    }

    // Booking ref
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Ref: ${b.booking_ref || b.id}`, ML, y);
    y += 5;

    // Special notes — yellow highlight box
    if (b.special_notes) {
      const noteLines = doc.splitTextToSize(`NOTE: ${b.special_notes}`, CW - 4);
      const noteH = noteLines.length * 4.5 + 4;
      doc.setFillColor(255, 245, 180);
      doc.roundedRect(ML, y, CW, noteH, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 70, 0);
      doc.text(noteLines, ML + 2, y + 4);
      y += noteH + 3;
    }

    // Prescription QR
    if (hasQR) {
      doc.setFillColor(...hexToRgb(MINT));
      doc.roundedRect(ML, y, 32, 7, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...hexToRgb(BLACK));
      doc.text('SCRIPT ATTACHED', ML + 2, y + 4.8);
      y += 9;
      doc.addImage(qrImages[b.id], 'PNG', ML, y, 25, 25);
      y += 27;
    } else if (showScriptWarning) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(180, 60, 60);
      doc.text('Script marked uploaded but file not found — check Supabase Prescriptions bucket', ML, y);
      y += 6;
    }

    // Divider between stops
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.25);
    doc.line(ML, y + 1, PW - MR, y + 1);
    y += 5;
  }

  const firstName = collectorName.split(' ')[0] || collectorName;
  doc.save(`RunSheet_${firstName}_${date}.pdf`);
}

// ─── ExportRunSheetButton ─────────────────────────────────────────────────────

export function ExportRunSheetButton({ collectorId, collectorName, date, bookings }) {
  const [loading, setLoading] = useState(false);

  const dayBookings = bookings
    .filter(b => b.collector_id === collectorId && b.scheduled_date === date)
    .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''));

  const disabled = dayBookings.length === 0;

  const handleClick = async () => {
    if (disabled || loading) return;
    setLoading(true);
    try {
      await generateRunSheet(collectorName, date, dayBookings);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      title={disabled ? 'No bookings for this day' : `Export run sheet for ${collectorName}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 5,
        border: '1px solid var(--border)',
        background: disabled ? 'transparent' : 'var(--primary)',
        color: disabled ? 'var(--muted)' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        transition: 'opacity 0.15s, background 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      <Download size={12} strokeWidth={2} />
      {loading ? 'Generating…' : 'Export'}
    </button>
  );
}

// ─── ExportAllRunSheetsButton ─────────────────────────────────────────────────

export function ExportAllRunSheetsButton({ collectors, date, bookings }) {
  const [loading, setLoading] = useState(false);

  // Only collectors with at least one booking on this date
  const eligible = collectors.filter(c =>
    bookings.some(b => b.collector_id === c.id && b.scheduled_date === date)
  );

  const disabled = eligible.length === 0;

  const handleClick = async () => {
    if (disabled || loading) return;
    setLoading(true);
    let exported = 0;
    try {
      for (const c of eligible) {
        const dayBookings = bookings
          .filter(b => b.collector_id === c.id && b.scheduled_date === date)
          .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''));

        if (dayBookings.length === 0) continue;

        const name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
        await generateRunSheet(name, date, dayBookings);
        exported++;

        // 300ms gap between downloads to avoid browser blocking
        if (exported < eligible.length) {
          await new Promise(r => setTimeout(r, 300));
        }
      }
    } finally {
      setLoading(false);
      if (exported > 0) {
        // Lightweight toast — no dependency needed, just a console note.
        // Replace with your preferred toast library if desired.
        const msg = `Exported ${exported} run sheet${exported !== 1 ? 's' : ''} for ${fmtDateBrisbane(date)}`;
        // Try sonner if available, else alert fallback
        try {
          const { toast } = await import('sonner');
          toast.success(msg);
        } catch {
          // eslint-disable-next-line no-console
          console.info(msg);
        }
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      title={
        disabled
          ? 'No collectors with bookings on this date'
          : `Export run sheets for all ${eligible.length} collector${eligible.length !== 1 ? 's' : ''}`
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 14px',
        fontSize: 12,
        fontWeight: 500,
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: disabled ? 'transparent' : 'var(--primary)',
        color: disabled ? 'var(--muted)' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        transition: 'opacity 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      <Download size={13} strokeWidth={2} />
      {loading
        ? 'Generating…'
        : `Export All Run Sheets${eligible.length > 0 ? ` (${eligible.length})` : ''}`}
    </button>
  );
}
