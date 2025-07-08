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
- **Client-side Data Loading**: All forms use client-side data fetching to work with Row Level Security (RLS)
- **Mobile-first Design**: Responsive design with Tailwind CSS optimized for mobile usage
- **Immutable Audit Trail**: Transaction history provides complete audit trail for compliance
- **Automatic Inventory Updates**: Stock levels automatically calculated from transaction history via database triggers
- **PWA Ready**: Progressive Web App features configured for offline capability
- **Real-time Sync**: Multiple users can work simultaneously with instant updates

## Testing

Use the comprehensive testing guide in `TESTING_GUIDE.md` to systematically test all features including:
- Authentication flows
- CRUD operations (add, remove, transfer)
- Real-time updates
- Data validation
- Mobile responsiveness

## Development Workflow Notes

- Let me, the user run the development server and check for bugs instead of you. Because you need to wait for a bash command to finish which will not happen when you run the development server. This means dont run `npm run dev`
- **Data Loading Strategy**: Client-side data fetching in all operation pages (add/remove/transfer) to work with Supabase Row Level Security
- **Authentication Flow**: Global auth guard in `+layout.svelte` handles route protection
- **Form Submissions**: SvelteKit's progressive enhancement with proper error handling
- **Real-time Subscriptions**: Set up in `+layout.svelte` for global inventory state management
- **RLS Compatibility**: All data access uses authenticated Supabase client for proper permissions


# Bash commands
- npm run build: Build the project
- npm run check: Run the typechecker
- npm run start: Start production server