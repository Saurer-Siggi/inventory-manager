# Saurer Siggi Inventory PWA - Project Summary

## Problem Statement
Current Google Sheets inventory tracking is tedious on mobile devices. Need a streamlined, mobile-first solution for tracking liquor inventory across multiple storage locations.

## Core Goals
- **Simplicity First**: Must be easier than Google Sheets or project fails
- **Mobile Optimized**: PWA for app-like experience on phones
- **Quick Operations**: Focus on most common task - removing bottles for deliveries
- **Multi-location**: Track inventory across 5 storage locations
- **Team Collaboration**: 3 users (Aron, Nacho, Aiko) with operation attribution

## Business Context
- Liquor business with Shopify sales
- 2 products: Saurer Siggi Likör (SSL-001) and Klopfer (SSK-001)
- Typical operations: 3-20 bottles per transaction
- Delivery to bars and direct customers
- Home storage for quick shipments

## Technical Philosophy
- **Plug-in existing solutions**: Minimize custom development
- **Progressive enhancement**: Start simple, add features incrementally
- **Self-hosted**: Deploy on existing Hetzner infrastructure
- **Containerized**: Docker for clean deployment alongside vaultwarden/n8n

## Key Features by Priority

### MVP (Essential)
- Dashboard with real-time inventory overview
- Add/Remove/Transfer operations
- Multi-product and multi-location support
- Supabase auth integration

### Phase 2 (Important)
- Transaction history with user attribution
- Admin panel for corrections
- PWA offline capability

### Phase 3 (Nice-to-have)
- Low-stock alerts
- CSV export functionality
- iOS Siri shortcuts integration

## Technology Stack
- **Frontend**: SvelteKit + PWA
- **Backend**: Supabase (auth + database + API)
- **Deployment**: Docker on Hetzner servers
- **Database**: PostgreSQL via Supabase

## Success Criteria
The app succeeds if the team consistently uses it instead of reverting to Google Sheets. This requires the interface to be faster and more convenient than opening Drive on mobile.