import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Save } from 'lucide-react';

const DEFAULT_SETTINGS = {
  business_name: 'Nura Health',
  abn: '80 126 969 531',
  contact_email: 'hello@nurahealth.com.au',
  contact_phone: '',
  service_area: '',
  pricing: { 'home-visit': 59, 'corporate': 59, 'aged-care': 59, 'ndis': 55 },
  revenue_monthly_goal: 5000,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsId, setSettingsId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('settings').select('*').limit(1).single();
      if (data) {
        // Merge DB values over defaults; fall back to default for null/0 fields
        const dbPricing = data.pricing || {};
        const mergedPricing = {};
        for (const key of Object.keys(DEFAULT_SETTINGS.pricing)) {
          mergedPricing[key] = dbPricing[key] || DEFAULT_SETTINGS.pricing[key];
        }
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data,
          abn: data.abn || DEFAULT_SETTINGS.abn,
          pricing: mergedPricing,
          revenue_monthly_goal: data.revenue_monthly_goal != null
            ? parseFloat(data.revenue_monthly_goal)
            : DEFAULT_SETTINGS.revenue_monthly_goal,
        });
        setSettingsId(data.id);
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...settings, updated_at: new Date().toISOString() };
    if (settingsId) {
      await supabase.from('settings').update(payload).eq('id', settingsId);
    } else {
      const { data } = await supabase.from('settings').insert(payload).select().single();
      if (data) setSettingsId(data.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const updatePricing = (service, value) => {
    setSettings(p => ({ ...p, pricing: { ...p.pricing, [service]: parseFloat(value)||0 } }));
  };

  if (loading) return <div className="empty-state">Loading…</div>;

  const PRICING_SERVICES = [
    { key:'home-visit',  label:'Home Visit' },
    { key:'corporate',   label:'Corporate' },
    { key:'aged-care',   label:'Aged Care' },
    { key:'ndis',        label:'NDIS' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">Business configuration and pricing</div>
        </div>
        {saved && <span className="badge badge-success" style={{ fontSize:13 }}>✓ Saved</span>}
      </div>

      <form onSubmit={handleSave}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          {/* Business details */}
          <div className="nura-card">
            <div style={{ fontSize:14, fontWeight:600, marginBottom:18, color:'var(--accent)' }}>Business Details</div>

            <div style={{ marginBottom:14 }}>
              <label className="nura-label">Business Name</label>
              <input className="nura-input" value={settings.business_name} onChange={e=>setSettings(p=>({...p,business_name:e.target.value}))} />
            </div>
            <div style={{ marginBottom:14 }}>
              <label className="nura-label">ABN</label>
              <input className="nura-input" placeholder="XX XXX XXX XXX" value={settings.abn} onChange={e=>setSettings(p=>({...p,abn:e.target.value}))} />
            </div>
            <div style={{ marginBottom:14 }}>
              <label className="nura-label">Contact Email</label>
              <input className="nura-input" type="email" value={settings.contact_email} onChange={e=>setSettings(p=>({...p,contact_email:e.target.value}))} />
            </div>
            <div style={{ marginBottom:14 }}>
              <label className="nura-label">Contact Phone</label>
              <input className="nura-input" value={settings.contact_phone} onChange={e=>setSettings(p=>({...p,contact_phone:e.target.value}))} />
            </div>
            <div>
              <label className="nura-label">Service Area</label>
              <input className="nura-input" placeholder="e.g. Melbourne Metro" value={settings.service_area} onChange={e=>setSettings(p=>({...p,service_area:e.target.value}))} />
            </div>
          </div>

          {/* Pricing */}
          <div className="nura-card">
            <div style={{ fontSize:14, fontWeight:600, marginBottom:18, color:'var(--accent)' }}>Service Pricing</div>
            <div style={{ fontSize:12, color:'var(--muted)', marginBottom:16 }}>
              Set the default price for each service type. These are used for reference only — actual pricing is set per booking.
            </div>
            {PRICING_SERVICES.map(({ key, label }) => (
              <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border2)' }}>
                <label style={{ fontSize:13, color:'var(--text)' }}>{label}</label>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ color:'var(--muted)', fontSize:13 }}>$</span>
                  <input
                    className="nura-input"
                    type="number"
                    min="0"
                    step="0.01"
                    style={{ width:90 }}
                    value={settings.pricing?.[key] ?? 0}
                    onChange={e => updatePricing(key, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Goal */}
        <div className="nura-card" style={{ marginTop:20 }}>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:6, color:'var(--accent)' }}>Revenue Goal</div>
          <div style={{ fontSize:12, color:'var(--muted)', marginBottom:16 }}>
            Set a monthly revenue target to track progress on the Overview page.
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <label style={{ fontSize:13, color:'var(--text)', whiteSpace:'nowrap' }}>Monthly Revenue Target ($)</label>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ color:'var(--muted)', fontSize:13 }}>$</span>
              <input
                className="nura-input"
                type="number"
                min="0"
                step="100"
                style={{ width:120 }}
                value={settings.revenue_monthly_goal ?? 5000}
                onChange={e => setSettings(p => ({ ...p, revenue_monthly_goal: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>
        </div>

        <div style={{ marginTop:24, display:'flex', justifyContent:'flex-end' }}>
          <button type="submit" className="btn-mint" disabled={saving}>
            <Save size={14} /> {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
