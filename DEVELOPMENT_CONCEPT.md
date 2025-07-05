## Final Concept: Saurer Siggi Inventory PWA

### Product Catalog
```
1. Saurer Siggi Likör (SSL-001)
   - 500ml bottles in 6-packs
   - Main product for bars and retail

2. Saurer Siggi Klopfer (SSK-001) 
   - Single-serve bottles
   - Shot-sized for individual consumption
```

### Storage Locations
```
1. MyPlace Abteil 9073 (Warehouse)
2. MyPlace Abteil 9128 (Warehouse) 
3. Aron Zuhause (Home)
4. Nacho Zuhause (Home)
5. Aiko Zuhause (Home)
```

### Core Features

**Dashboard:**
- Real-time inventory overview across all locations
- Color-coded stock levels (green/yellow/red)
- Quick action buttons for common operations

**Primary Operations:**
- **Remove Bottles:** Most common - delivery to customers/bars
- **Add Bottles:** New deliveries and restocking
- **Transfer Bottles:** Between storage locations
- **Quick Corrections:** Admin panel for mistakes

**Advanced Features:**
- Transaction history with user attribution
- Low-stock alerts (configurable thresholds)
- CSV export for backup/analysis
- PWA with offline capability
- iOS Siri shortcuts integration

### Database Schema (Supabase)

```sql
-- Products
products: id, sku, name, description, active, created_at

-- Storage locations  
storages: id, name, type, location_details, active, created_at

-- Current inventory
inventory: id, product_id, storage_id, quantity, updated_at

-- Transaction log
transactions: id, product_id, storage_id, transaction_type, 
             quantity, from_storage_id, to_storage_id, 
             user_email, notes, created_at

-- Stock alerts (future)
stock_alerts: id, product_id, storage_id, threshold, active
```

### User Interface Flow

**Mobile-First Design:**
1. **Login** → Supabase Auth
2. **Dashboard** → Overview of all locations
3. **Quick Actions** → Large buttons for remove/add/transfer
4. **Transaction** → Simple forms with quantity presets
5. **History** → Filterable transaction log
6. **Admin** → Corrections and bulk operations

### Technical Architecture

```
Frontend (SvelteKit PWA)
├── Authentication (Supabase Auth)
├── Real-time updates (Supabase Realtime)
├── Offline support (Service Worker)
└── Mobile optimized UI

Backend (Supabase)
├── PostgreSQL database
├── Row Level Security
├── Real-time subscriptions
└── REST API

Deployment (Docker)
├── SvelteKit container
├── Nginx reverse proxy
└── SSL termination
```

### Development Phases

**MVP:** Core inventory operations + dashboard
**Enhancement:** History tracking + user attribution  
**Advanced:** Alerts + export + Siri integration
**Optimization:** Performance + offline features

### Migration Strategy
- Export current Google Sheets data
- Bulk import into Supabase
- Parallel testing before full switch