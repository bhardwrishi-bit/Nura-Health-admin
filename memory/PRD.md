# Nura Health Admin Dashboard - PRD

## Original Problem Statement
Replace the existing dashboard with a standalone HTML file. Host it as-is with all CSS and JS included in a single file. Integrate with Supabase for live data, authentication, and real-time updates.

## Architecture
- **Frontend**: Single standalone HTML file (`/app/frontend/public/admin-dashboard.html`) containing all CSS, JS, and Supabase integration
- **Backend**: Minimal FastAPI server (`/app/backend/server.py`)
- **React App.js**: Redirects to `/admin-dashboard.html`
- **Database**: Supabase (PostgreSQL, Realtime, Auth)

## Key Files
- `/app/frontend/public/admin-dashboard.html` - Core app (all logic, styles, markup)
- `/app/frontend/src/App.js` - Redirect to HTML file
- `/app/backend/server.py` - FastAPI backend

## Completed Features
- Standalone HTML dashboard hosted in React public folder
- Supabase live data integration (Overview, Collectors, Leave Requests, Availability Planner)
- Supabase real-time subscriptions for `jobs` and `leave_requests`
- Supabase Auth with login UI gate
- Sprint Board page merged from v2 file
- Nura Health PNG logo (base64 embedded) in sidebar and login screen

## Status: ALL TASKS COMPLETE
No pending tasks or issues.
