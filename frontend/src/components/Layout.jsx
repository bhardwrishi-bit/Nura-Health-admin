import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';

export default function Layout({ user }) {
  return (
    <div className="app-layout">
      <Sidebar user={user} />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
