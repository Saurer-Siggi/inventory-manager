# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Saurer Siggi Inventory Manager, a Progressive Web App (PWA) for managing inventory of Saurer Siggi Likör and Klopfer products across multiple storage locations.

**Key Product Lines:**
- Saurer Siggi Likör (SSL-001): 500ml bottles in 6-packs for bars and retail
- Saurer Siggi Klopfer (SSK-001): Single-serve shot bottles

**Storage Locations:**
- MyPlace Abteil 9073 (Warehouse)
- MyPlace Abteil 9128 (Warehouse)
- Aron Zuhause (Home)
- Nacho Zuhause (Home)
- Aiko Zuhause (Home)

## Common Development Commands

**Development Server:**
```bash
npm run dev                    # Start development server on http://localhost:3000
npm run dev -- --open         # Start dev server and open browser
```

**Build & Preview:**
```bash
npm run build                  # Build for production
npm run preview               # Preview production build on http://localhost:3000
npm run start                 # Start production server (requires build first)
```

**Type Checking:**
```bash
npm run check                  # Type check with svelte-check
npm run check:watch           # Type check in watch mode
```

**Setup:**
```bash
npm install                   # Install dependencies
npm run prepare              # Sync SvelteKit (runs automatically)
```

## Architecture

**Frontend:** SvelteKit PWA with Tailwind CSS
- Shared-password authentication (one access password, cookie session)
- Data refreshed via `invalidateAll()` after mutations (no realtime)
- Progressive Web App with Service Worker
- Mobile-first responsive design

**Backend:** SvelteKit server (adapter-node)
- Local SQLite database via Node's built-in `node:sqlite` (`DatabaseSync`)
- All DB access in `src/lib/server/db.ts`; auth in `src/lib/server/auth.ts`
- Reads via server `load` functions; mutations via JSON API routes under `/api/*`

**Tech Stack:**
- SvelteKit 2.x with TypeScript
- Tailwind CSS 4.x for styling
- Vite PWA plugin for offline support
- SQLite (`node:sqlite`) — single local file, no external services

## Project Structure

```
src/
├── lib/
│   ├── server/
│   │   ├── db.ts             # SQLite layer: schema (auto-created), reads, mutations
│   │   └── auth.ts           # Shared-password / session-cookie helpers
│   ├── stores.ts             # Client stores fed by layout load
│   ├── database.types.ts     # Shared TS types
│   └── index.ts              # Shared utilities
├── hooks.server.ts           # Auth guard (redirects to /login)
├── routes/
│   ├── +layout.server.ts     # Loads products/storages/inventory/alerts
│   ├── +layout.svelte        # Main layout (pushes data into stores)
│   ├── +page.svelte          # Dashboard (protected)
│   ├── login/                # Password login (form action)
│   ├── logout/+server.ts     # Clears session cookie
│   ├── api/                  # JSON mutation endpoints (transactions/products/storages/alerts)
│   ├── add/ remove/ transfer/  # Stock operations
│   ├── history/ alerts/      # Read views
│   └── admin/ locations/     # Product & location management
└── app.html                  # HTML template
```

## Database Schema

The core tables are:
- `products`: Product catalog (id, sku, name, description, active, created_at)
- `storages`: Storage locations (id, name, type, location_details, active, created_at)
- `inventory`: Current stock levels (id, product_id, storage_id, quantity, updated_at)
- `transactions`: Complete transaction history (id, product_id, storage_id, transaction_type, quantity, from_storage_id, to_storage_id, user_email, notes, created_at)
- `stock_alerts`: Low-stock notifications (id, product_id, storage_id, threshold, active)

## Core Operations

The app is designed around these primary operations (all fully implemented):
1. **✅ Remove Bottles** - Most common operation for deliveries to customers/bars
2. **✅ Add Bottles** - New deliveries and restocking  
3. **✅ Transfer Bottles** - Moving stock between storage locations

Each operation includes:
- Form validation and error handling
- Real-time inventory updates
- Transaction history logging
- User email tracking for audit trail
- Notes field for additional context

## Authentication & Security

- Single shared password (`APP_PASSWORD`) gates the whole app — no user accounts
- `hooks.server.ts` verifies the signed session cookie and redirects to `/login` when missing
- No per-user identity: `user_email` on transactions is always null; every logged-in user can
  manage products, locations, and alerts (`isAdmin` is always true once authenticated)
- API routes under `/api/*` also check `locals.authed`

## Data Refresh

- No realtime. After a mutation the client calls `invalidateAll()` to re-run server loads
- `inventory` is recomputed from transactions inside `applyTransaction()` (mirrors the old
  Postgres trigger) within a single SQLite transaction

## Environment Variables

Set in `.env` (see `.env.example`):
- `APP_PASSWORD`: shared access password
- `SESSION_SECRET`: secret for signing the session cookie
- `DATABASE_PATH`: SQLite file path (default `data/inventory.db`)
- `ORIGIN`: public URL in production (behind a TLS proxy) for CSRF on form POSTs

## Development Status

**Current Phase:** ✅ **FULLY FUNCTIONAL MVP** - Authentication, CRUD operations, and real-time updates all working

**✅ Features Completed:**
- **Authentication System**: Complete user auth with sign up, sign in, sign out
- **Dashboard**: Real-time inventory display with live updates
- **Core Operations**: All three primary operations fully implemented and working:
  - ✅ **Add Bottles**: New deliveries and restocking with form validation
  - ✅ **Remove Bottles**: Delivery tracking with customer notes
  - ✅ **Transfer Bottles**: Stock movement between storage locations
- **Data Management**: Complete transaction history tracking and audit trail
- **Real-time Updates**: Live inventory updates across all connected clients
- **Mobile-responsive Design**: Optimized for mobile-first usage
- **PWA Configuration**: Progressive Web App with offline capability

**🎯 Current Status**: Ready for production use - all core functionality working correctly

## Development Notes

- **Fully Functional MVP**: All core features implemented and tested
- **Server-side Data Loading**: Reads happen in `load` functions; the client never touches the DB
- **Mobile-first Design**: Responsive design with Tailwind CSS optimized for mobile usage
- **Immutable Audit Trail**: Transaction history provides complete audit trail for compliance
- **Automatic Inventory Updates**: `applyTransaction()` recomputes stock from each transaction
- **PWA Ready**: Progressive Web App features configured for offline capability

## Development Workflow Notes

- Let me, the user run the development server and check for bugs instead of you. Because you need to wait for a bash command to finish which will not happen when you run the development server. This means dont run `npm run dev`
- **Data Loading Strategy**: Server `load` functions return DB data; mutations go through `/api/*` then `invalidateAll()`
- **Authentication Flow**: `hooks.server.ts` enforces the session cookie; `/login` is the only public route
- **Form Submissions**: SvelteKit form action for login; JSON `fetch` for in-app mutations
- **Database**: `node:sqlite` file managed entirely in `src/lib/server/db.ts` (schema auto-created on first run; starts empty — populate via `npm run migrate:supabase`)


# Bash commands
- npm run build: Build the project
- npm run check: Run the typechecker
- npm run start: Start production server