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
npm run dev                    # Start development server on http://localhost:5173
npm run dev -- --open         # Start dev server and open browser
```

**Build & Preview:**
```bash
npm run build                  # Build for production
npm run preview               # Preview production build
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
- Authentication via Supabase Auth
- Real-time updates via Supabase Realtime
- Progressive Web App with Service Worker
- Mobile-first responsive design

**Backend:** Supabase
- PostgreSQL database with Row Level Security
- Real-time subscriptions for live updates
- REST API via Supabase client

**Tech Stack:**
- SvelteKit 2.x with TypeScript
- Tailwind CSS 4.x for styling
- Vite PWA plugin for offline support
- Supabase client for backend integration

## Project Structure

```
src/
├── lib/
│   ├── supabaseClient.js     # Supabase client configuration
│   ├── auth.js               # Authentication helpers
│   └── index.ts              # Shared utilities
├── routes/
│   ├── +layout.svelte        # Main layout with auth
│   ├── +page.svelte          # Dashboard (protected)
│   ├── +page.server.js       # Server-side data loading
│   ├── login/+page.svelte    # Login page
│   ├── add/                  # Add bottles operation
│   ├── remove/               # Remove bottles operation
│   └── transfer/             # Transfer bottles operation
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

The app is designed around these primary operations:
1. **Remove Bottles** - Most common operation for deliveries to customers/bars
2. **Add Bottles** - New deliveries and restocking  
3. **Transfer Bottles** - Moving stock between storage locations
4. **Quick Corrections** - Admin panel for fixing mistakes

## Authentication & Security

- Uses Supabase Auth for user management
- Protected routes redirect to `/login` when not authenticated
- Row Level Security (RLS) policies enforce data access
- User sessions persist across browser refreshes
- All operations require authentication

## Real-time Features

- Inventory updates appear instantly across all connected clients
- Uses Supabase Realtime subscriptions on the `inventory` table
- Transaction history updates in real-time
- Multiple users can work simultaneously without conflicts

## Environment Variables

Required environment variables (set in `.env`):
- `PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon public key

## Development Status

**Current Phase:** MVP fully implemented with authentication, CRUD operations, and real-time updates
**Features Completed:**
- User authentication (sign up, sign in, sign out)
- Dashboard with real-time inventory display
- Add, remove, and transfer bottle operations
- Transaction history tracking
- Mobile-responsive design
- PWA configuration

## Development Notes

- This is a fully implemented MVP with authentication, CRUD operations, and real-time updates
- Focus on mobile-first responsive design with Tailwind CSS
- Transaction history is immutable for audit purposes
- Stock level calculations are derived from transaction history
- PWA features are configured for offline capability

## Testing

Use the comprehensive testing guide in `TESTING_GUIDE.md` to systematically test all features including:
- Authentication flows
- CRUD operations (add, remove, transfer)
- Real-time updates
- Data validation
- Mobile responsiveness

## Development Workflow Notes

- Let me run the development server and check for bugs instead of you. Because you need to wait for a bash command to finish which will not happen when you run the development server
- The app uses server-side rendering with `+page.server.js` files for data loading
- Form submissions use SvelteKit's progressive enhancement
- Real-time subscriptions are set up in `+layout.svelte` for global state management