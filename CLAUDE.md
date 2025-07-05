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

## Architecture

**Frontend:** SvelteKit PWA with mobile-first design
- Authentication via Supabase Auth
- Real-time updates via Supabase Realtime
- Offline support with Service Worker
- iOS Siri shortcuts integration

**Backend:** Supabase
- PostgreSQL database with Row Level Security
- Real-time subscriptions
- REST API

**Deployment:** Docker containers with Nginx reverse proxy and SSL termination

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

## Development Status

**Current Phase:** Project initialization - no code has been written yet
**Next Steps:** Set up SvelteKit project structure, configure Supabase integration, implement MVP features

## Development Notes

- This is a greenfield project following the detailed specification in DEVELOPMENT_CONCEPT.md
- Focus on mobile-first responsive design
- Implement real-time inventory updates across all users
- Plan for offline functionality from the start
- Transaction history must be immutable for audit purposes
- Stock level calculations are derived from transaction history