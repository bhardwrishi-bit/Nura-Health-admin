import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import Layout from '@/components/Layout';
import LoginScreen from '@/components/LoginScreen';
import OverviewPage from '@/pages/OverviewPage';
import BookingsPage from '@/pages/BookingsPage';
import CollectorsPage from '@/pages/CollectorsPage';
import PatientsPage from '@/pages/PatientsPage';
import AvailabilityPage from '@/pages/AvailabilityPage';
import LeaveRequestsPage from '@/pages/LeaveRequestsPage';
import DocumentsPage from '@/pages/DocumentsPage';
import InvoicesPage from '@/pages/InvoicesPage';
import PayslipsPage from '@/pages/PayslipsPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import SettingsPage from '@/pages/SettingsPage';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</span>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {!user ? (
          <Route path="*" element={<LoginScreen />} />
        ) : (
          <Route path="/" element={<Layout user={user} />}>
            <Route index element={<OverviewPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="collectors" element={<CollectorsPage />} />
            <Route path="patients" element={<PatientsPage />} />
            <Route path="availability" element={<AvailabilityPage />} />
            <Route path="leave" element={<LeaveRequestsPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="payslips" element={<PayslipsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
