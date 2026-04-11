import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const SLOTS = ['full', 'am', 'pm', 'off'];
const SLOT_LABELS = { full:'FULL', am:'AM', pm:'PM', off:'OFF', null:'–' };
const SLOT_CLASS = { full:'avail-full', am:'avail-am', pm:'avail-pm', off:'avail-off' };

function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function fmtDate(d) { return d.toISOString().split('T')[0]; }
function dayLabel(d) { return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]; }

export default function AvailabilityPage() {
  const [collectors, setCollectors] = useState([]);
  const [avail, setAvail] = useState({}); // { 'collectorId-date': slot }
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); const day = d.getDay();
    d.setDate(d.getDate() - day + (day===0?-6:1)); d.setHours(0,0,0,0); return d;
  });
  const [loading, setLoading] = useState(true);

  const dates = Array.from({ length: 28 }, (_, i) => addDays(weekStart, i));

  const fetchData = useCallback(async () => {
    const startStr = fmtDate(weekStart);
    const endStr   = fmtDate(addDays(weekStart, 27));

    const [cRes, aRes] = await Promise.all([
      supabase.from('collectors').select('id, name').eq('status','active').order('name'),
      supabase.from('collector_availability').select('*').gte('date', startStr).lte('date', endStr),
    ]);

    setCollectors(cRes.data || []);

    const map = {};
    (aRes.data || []).forEach(r => { map[`${r.collector_id}-${r.date}`] = r.slot; });
    setAvail(map);
    setLoading(false);
  }, [weekStart]);

  useEffect(() => {
    fetchData();
    const ch = supabase.channel('avail-page')
      .on('postgres_changes', { event:'*', schema:'public', table:'collector_availability' }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetchData]);

  const cycleSlot = async (collectorId, date) => {
    const key = `${collectorId}-${date}`;
    const current = avail[key] || null;
    const next = SLOTS[(SLOTS.indexOf(current ?? 'off') + 1) % SLOTS.length];

    setAvail(prev => ({ ...prev, [key]: next }));

    await supabase.from('collector_availability').upsert(
      { collector_id: collectorId, date, slot: next },
      { onConflict: 'collector_id,date' }
    );
  };

  const weeks = [0,1,2,3].map(w => dates.slice(w*7, w*7+7));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Availability</div>
          <div className="page-subtitle">4-week forward view — click any cell to change</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn-ghost" onClick={() => setWeekStart(d => addDays(d, -7))}><ChevronLeft size={14} /></button>
          <button className="btn-ghost" onClick={() => setWeekStart(d => addDays(d, 7))}><ChevronRight size={14} /></button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:12, marginBottom:20, fontSize:11 }}>
        {[['avail-full','Full day'],['avail-am','AM only'],['avail-pm','PM only'],['avail-off','Off']].map(([cls,lbl])=>(
          <div key={cls} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:16, height:12, borderRadius:3 }} className={cls} />
            <span style={{ color:'var(--muted)' }}>{lbl}</span>
          </div>
        ))}
      </div>

      {loading ? <div className="empty-state">Loading…</div> : collectors.length === 0 ? (
        <div className="empty-state">No active collectors. Add collectors first.</div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="panel" style={{ marginBottom:16 }}>
              <div className="panel-header">
                <span style={{ fontSize:12, color:'var(--muted)' }}>
                  Week {wi+1} — {fmtDate(week[0])} to {fmtDate(week[6])}
                </span>
              </div>
              <div style={{ padding:'12px 16px', overflowX:'auto' }}>
                <table style={{ borderCollapse:'collapse', width:'100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign:'left', padding:'6px 12px 10px 0', fontSize:11, color:'var(--muted)', width:160, fontWeight:500 }}>Collector</th>
                      {week.map(d => (
                        <th key={fmtDate(d)} style={{ padding:'6px 4px 10px', textAlign:'center', minWidth:44 }}>
                          <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase' }}>{dayLabel(d)}</div>
                          <div style={{ fontSize:11, fontWeight:600 }}>{d.getDate()}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {collectors.map(c => (
                      <tr key={c.id}>
                        <td style={{ padding:'4px 12px 4px 0', fontSize:12, color:'var(--text)', whiteSpace:'nowrap' }}>{c.name}</td>
                        {week.map(d => {
                          const dateStr = fmtDate(d);
                          const slot = avail[`${c.id}-${dateStr}`] || null;
                          return (
                            <td key={dateStr} style={{ padding:'4px', textAlign:'center' }}>
                              <button
                                className={`avail-cell ${slot ? SLOT_CLASS[slot] : 'avail-null'}`}
                                onClick={() => cycleSlot(c.id, dateStr)}
                                title={SLOT_LABELS[slot] || '–'}
                              >
                                {SLOT_LABELS[slot] || '–'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
