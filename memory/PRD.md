# Nura Health Admin Dashboard

## Problem Statement
Host a standalone admin dashboard HTML file as-is without modification, replacing the existing dashboard. Then integrate with Supabase as live data source with authentication.

## What's Been Implemented
- **Date**: January 2026
- Hosted standalone HTML dashboard at `/admin-dashboard.html`
- React app redirects to the static HTML dashboard
- **Supabase Integration** (March 2026):
  - Connected to Supabase project: `yxoqvzypgvkdabqnwacs.supabase.co`
  - Live queries for: collectors, jobs, leave_requests, availability, v_document_alerts
  - Real-time subscriptions for jobs and leave_requests tables
  - Fallback data mechanism when tables are empty or queries fail
  - Loading states with skeleton rows and pulsing animation
  - Connection status indicator in topbar
- **Supabase Auth** (March 2026):
  - Email/password authentication via Supabase Auth
  - Login screen with branding
  - Session persistence (stay logged in)
  - Sign out functionality
  - Password reset via email
  - Dynamic user info in sidebar and greeting

## Architecture
- Static HTML file served from `/app/frontend/public/admin-dashboard.html`
- React App.js redirects to dashboard on load
- Self-contained CSS and JavaScript
- Supabase JS SDK v2 loaded via CDN
- All data fetched via Supabase REST API
- Authentication via Supabase Auth

## Setup Instructions

### Create Admin User in Supabase:
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User" → "Create new user"
3. Enter email and password for your admin account
4. The user will be able to log in immediately

### Alternative - Enable Email Signup:
1. Go to Supabase Dashboard → Authentication → Providers
2. Enable "Email" provider
3. Users can sign up directly from the login page (add signup form if needed)

## Supabase Tables Expected
- `collectors` - id, first_name, last_name, email, phone, employment_type, status, joined_date
- `jobs` - id, status, scheduled_date, collector_id
- `patient_stops` - id, job_id, location_name, status
- `leave_requests` - id, collector_id, leave_type, start_date, end_date, days, status, submitted_at, reviewed_at
- `availability` - collector_id, available_date, slot
- `v_document_alerts` (view) - collector_name, document_type, alert_type, message

## Core Features
- Password-protected admin dashboard
- Dashboard overview with live KPIs (from Supabase)
- Collector profiles with document status tracking
- Availability grid view with week navigation
- Leave request management with approve/decline actions (writes to Supabase)
- Real-time updates via Supabase subscriptions
- **Sprint Board** - 4-day launch checklist with task tracking (persisted in localStorage)

## Backlog
- Phase 2: Documents module
- Phase 3: Analytics + Job scheduler
- Phase 4: Finance module (Invoices & Payslips)
- Settings configuration
