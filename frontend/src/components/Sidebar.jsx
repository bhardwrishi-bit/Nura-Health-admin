import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard, Calendar, Users, UserCircle, CalendarDays,
  Clock, FileText, CreditCard, Receipt, TrendingUp,
  Settings, Zap, LogOut
} from 'lucide-react';

const NAV = [
  {
    label: 'Operations',
    items: [
      { to: '/',            icon: LayoutDashboard, label: 'Overview' },
      { to: '/bookings',    icon: Calendar,        label: 'Bookings' },
      { to: '/collectors',  icon: Users,           label: 'Collectors' },
      { to: '/patients',    icon: UserCircle,      label: 'Patients' },
      { to: '/availability',icon: CalendarDays,    label: 'Availability' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { to: '/leave',     icon: Clock,    label: 'Leave Requests' },
      { to: '/documents', icon: FileText, label: 'Documents' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/invoices',  icon: CreditCard, label: 'Invoices & Pay' },
      { to: '/payslips',  icon: Receipt,    label: 'Payslips' },
      { to: '/analytics', icon: TrendingUp, label: 'Analytics' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
  {
    label: 'Build',
    items: [
      { to: '/sprint', icon: Zap, label: 'Sprint Board', disabled: true },
    ],
  },
];

export default function Sidebar({ user }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <nav className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <svg width="28" height="28" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="20" fill="var(--primary)" />
          <path d="M12 28V12l8 10 8-10v16" stroke="var(--accent)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div>
          <div className="sidebar-logo-text">Nura Health</div>
          <div className="sidebar-logo-sub">Admin</div>
        </div>
      </div>

      {/* Nav sections */}
      {NAV.map(section => (
        <div className="sidebar-section" key={section.label}>
          <div className="sidebar-section-label">{section.label}</div>
          {section.items.map(item => (
            item.disabled ? (
              <div key={item.to} className="sidebar-item" style={{ opacity: 0.35, cursor: 'default' }}>
                <item.icon />
                {item.label}
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
              >
                <item.icon />
                {item.label}
              </NavLink>
            )
          ))}
        </div>
      ))}

      {/* Footer */}
      <div className="sidebar-footer">
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.email}
        </div>
        <button className="btn-ghost" onClick={handleLogout} style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}>
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </nav>
  );
}
