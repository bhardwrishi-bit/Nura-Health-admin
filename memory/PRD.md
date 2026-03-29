# Nura Health Admin Dashboard

## Problem Statement
Host a standalone admin dashboard HTML file as-is without modification, replacing the existing dashboard.

## What's Been Implemented
- **Date**: January 2026
- Hosted standalone HTML dashboard at `/admin-dashboard.html`
- React app redirects to the static HTML dashboard
- Dashboard features:
  - Overview with live runs, alerts, and availability snapshot
  - Collectors management page with filtering and search
  - Availability planner with 4-week view
  - Leave requests management with approve/decline actions
  - Responsive sidebar navigation
  - Toast notifications

## Architecture
- Static HTML file served from `/app/frontend/public/admin-dashboard.html`
- React App.js redirects to dashboard on load
- Self-contained CSS and JavaScript (no external dependencies except Google Font)

## Core Features
- Dashboard overview with KPIs
- Collector profiles with document status tracking
- Availability grid view
- Leave request management

## Backlog
- Phase 2: Documents module
- Phase 3: Analytics + Job scheduler
- Phase 4: Finance module (Invoices & Payslips)
- Settings configuration
