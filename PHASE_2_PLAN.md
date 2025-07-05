# Phase 2: Supabase Integration & Core Operations

## Overview
Integrate Supabase backend and implement the core inventory operations (add, remove, transfer bottles) with real-time synchronization.

## Goals
- Set up Supabase project with PostgreSQL database
- Implement authentication system
- Create database schema for inventory management
- Build core inventory operations with real-time updates
- Test end-to-end functionality

## Tasks

### 1. Supabase Setup & Configuration
- [ ] Create Supabase project and obtain API keys
- [ ] Install Supabase client library
- [ ] Configure environment variables
- [ ] Set up database connection

### 2. Database Schema Implementation
- [ ] Create `products` table (SSL-001 Likör, SSK-001 Klopfer)
- [ ] Create `storages` table (5 storage locations)
- [ ] Create `inventory` table (current stock levels)
- [ ] Create `transactions` table (complete audit trail)
- [ ] Create `stock_alerts` table (low-stock notifications)
- [ ] Set up Row Level Security (RLS) policies

### 3. Authentication System
- [ ] Configure Supabase Auth
- [ ] Create login/logout functionality
- [ ] Implement user session management
- [ ] Add protected routes

### 4. Core Inventory Operations
- [ ] **Remove Bottles** - Primary operation for deliveries
  - [ ] Select product and storage location
  - [ ] Enter quantity to remove
  - [ ] Record transaction with notes
  - [ ] Update inventory levels
- [ ] **Add Bottles** - New deliveries and restocking
  - [ ] Select product and storage location
  - [ ] Enter quantity to add
  - [ ] Record transaction with notes
  - [ ] Update inventory levels
- [ ] **Transfer Bottles** - Move stock between locations
  - [ ] Select product and from/to storage locations
  - [ ] Enter quantity to transfer
  - [ ] Record transaction with notes
  - [ ] Update inventory levels for both locations

### 5. Real-time Updates
- [ ] Configure Supabase Realtime subscriptions
- [ ] Implement live inventory updates across all users
- [ ] Handle connection states and offline scenarios

### 6. Dashboard Integration
- [ ] Connect dashboard to real inventory data
- [ ] Display current stock levels by product and location
- [ ] Show recent transactions
- [ ] Add quick action buttons

## Success Criteria
- [ ] User can authenticate and access the app
- [ ] All three core operations (add/remove/transfer) work correctly
- [ ] Inventory levels update in real-time across all users
- [ ] Transaction history is maintained accurately
- [ ] Stock calculations are correct and audit-compliant
- [ ] Mobile interface remains responsive and user-friendly

## Phase 2 Status: 🟡 PLANNING

### Database Schema Preview
```sql
-- Products table
CREATE TABLE products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sku varchar(10) UNIQUE NOT NULL,
    name varchar(100) NOT NULL,
    description text,
    active boolean DEFAULT true,
    created_at timestamp DEFAULT now()
);

-- Storage locations table
CREATE TABLE storages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,
    type varchar(20) NOT NULL, -- 'warehouse' or 'home'
    location_details text,
    active boolean DEFAULT true,
    created_at timestamp DEFAULT now()
);

-- Current inventory levels (calculated from transactions)
CREATE TABLE inventory (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid REFERENCES products(id),
    storage_id uuid REFERENCES storages(id),
    quantity integer DEFAULT 0,
    updated_at timestamp DEFAULT now(),
    UNIQUE(product_id, storage_id)
);

-- Complete transaction history (immutable audit trail)
CREATE TABLE transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid REFERENCES products(id),
    storage_id uuid REFERENCES storages(id),
    transaction_type varchar(20) NOT NULL, -- 'add', 'remove', 'transfer'
    quantity integer NOT NULL,
    from_storage_id uuid REFERENCES storages(id), -- for transfers
    to_storage_id uuid REFERENCES storages(id), -- for transfers
    user_email varchar(255) NOT NULL,
    notes text,
    created_at timestamp DEFAULT now()
);
```

## Dependencies Needed
- @supabase/supabase-js
- Environment variables for Supabase connection
- Supabase project with PostgreSQL database

## Security Considerations
- Row Level Security (RLS) enabled on all tables
- User authentication required for all operations
- Audit trail maintains complete transaction history
- Input validation for all operations

## Notes
- Keep operations simple and intuitive
- Focus on mobile-first user experience
- Maintain transaction integrity
- Plan for offline functionality in future phases