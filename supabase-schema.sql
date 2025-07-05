-- Saurer Siggi Inventory Manager Database Schema
-- This script sets up the complete database structure for the inventory management system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Products table - Product catalog
CREATE TABLE products (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku varchar(10) UNIQUE NOT NULL,
    name varchar(100) NOT NULL,
    description text,
    unit_size varchar(20) NOT NULL, -- '500ml', '20ml', etc.
    pack_size integer NOT NULL DEFAULT 1, -- bottles per pack
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Storage locations table
CREATE TABLE storages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name varchar(100) NOT NULL,
    type varchar(20) NOT NULL CHECK (type IN ('warehouse', 'home')),
    location_details text,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Current inventory levels (calculated view, but stored for performance)
CREATE TABLE inventory (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id uuid REFERENCES products(id) ON DELETE CASCADE,
    storage_id uuid REFERENCES storages(id) ON DELETE CASCADE,
    quantity integer DEFAULT 0 CHECK (quantity >= 0),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(product_id, storage_id)
);

-- Complete transaction history (immutable audit trail)
CREATE TABLE transactions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id uuid REFERENCES products(id) ON DELETE CASCADE,
    storage_id uuid REFERENCES storages(id) ON DELETE CASCADE,
    transaction_type varchar(20) NOT NULL CHECK (transaction_type IN ('add', 'remove', 'transfer')),
    quantity integer NOT NULL CHECK (quantity > 0),
    from_storage_id uuid REFERENCES storages(id) ON DELETE CASCADE, -- for transfers
    to_storage_id uuid REFERENCES storages(id) ON DELETE CASCADE, -- for transfers
    user_email varchar(255) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    -- Constraint to ensure transfer operations have both storage IDs
    CONSTRAINT valid_transfer CHECK (
        (transaction_type = 'transfer' AND from_storage_id IS NOT NULL AND to_storage_id IS NOT NULL) OR
        (transaction_type != 'transfer' AND from_storage_id IS NULL AND to_storage_id IS NULL)
    )
);

-- Stock alerts table for low-stock notifications
CREATE TABLE stock_alerts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id uuid REFERENCES products(id) ON DELETE CASCADE,
    storage_id uuid REFERENCES storages(id) ON DELETE CASCADE,
    threshold integer NOT NULL CHECK (threshold >= 0),
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(product_id, storage_id)
);

-- Insert initial products
INSERT INTO products (sku, name, description, unit_size, pack_size) VALUES
    ('SSL-001', 'Saurer Siggi Likör', '500ml bottles of premium Saurer Siggi Likör', '500ml', 6),
    ('SSK-001', 'Saurer Siggi Klopfer', 'Single-serve shot bottles of Saurer Siggi', '20ml', 1);

-- Insert storage locations
INSERT INTO storages (name, type, location_details) VALUES
    ('MyPlace Abteil 9073', 'warehouse', 'Warehouse storage unit 9073'),
    ('MyPlace Abteil 9128', 'warehouse', 'Warehouse storage unit 9128'),
    ('Aron Zuhause', 'home', 'Aron''s home storage'),
    ('Nacho Zuhause', 'home', 'Nacho''s home storage'),
    ('Aiko Zuhause', 'home', 'Aiko''s home storage');

-- Initialize inventory with zero quantities for all product/storage combinations
INSERT INTO inventory (product_id, storage_id, quantity)
SELECT p.id, s.id, 0
FROM products p
CROSS JOIN storages s;

-- Function to update inventory after transactions
CREATE OR REPLACE FUNCTION update_inventory_after_transaction()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle different transaction types
    IF NEW.transaction_type = 'add' THEN
        -- Add to inventory
        INSERT INTO inventory (product_id, storage_id, quantity)
        VALUES (NEW.product_id, NEW.storage_id, NEW.quantity)
        ON CONFLICT (product_id, storage_id)
        DO UPDATE SET 
            quantity = inventory.quantity + NEW.quantity,
            updated_at = now();
            
    ELSIF NEW.transaction_type = 'remove' THEN
        -- Remove from inventory
        UPDATE inventory 
        SET quantity = GREATEST(0, quantity - NEW.quantity),
            updated_at = now()
        WHERE product_id = NEW.product_id AND storage_id = NEW.storage_id;
        
    ELSIF NEW.transaction_type = 'transfer' THEN
        -- Remove from source storage
        UPDATE inventory 
        SET quantity = GREATEST(0, quantity - NEW.quantity),
            updated_at = now()
        WHERE product_id = NEW.product_id AND storage_id = NEW.from_storage_id;
        
        -- Add to destination storage
        INSERT INTO inventory (product_id, storage_id, quantity)
        VALUES (NEW.product_id, NEW.to_storage_id, NEW.quantity)
        ON CONFLICT (product_id, storage_id)
        DO UPDATE SET 
            quantity = inventory.quantity + NEW.quantity,
            updated_at = now();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update inventory after transactions
CREATE TRIGGER trigger_update_inventory
    AFTER INSERT ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_after_transaction();

-- Create indexes for better performance
CREATE INDEX idx_transactions_product_id ON transactions(product_id);
CREATE INDEX idx_transactions_storage_id ON transactions(storage_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_user_email ON transactions(user_email);
CREATE INDEX idx_inventory_product_storage ON inventory(product_id, storage_id);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE storages ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic authenticated user access)
-- Note: These policies allow authenticated users to access all data
-- In production, you might want more restrictive policies

-- Products: Read access for authenticated users
CREATE POLICY "Allow authenticated users to view products" ON products
    FOR SELECT USING (auth.role() = 'authenticated');

-- Storages: Read access for authenticated users
CREATE POLICY "Allow authenticated users to view storages" ON storages
    FOR SELECT USING (auth.role() = 'authenticated');

-- Inventory: Read access for authenticated users
CREATE POLICY "Allow authenticated users to view inventory" ON inventory
    FOR SELECT USING (auth.role() = 'authenticated');

-- Transactions: Read and insert for authenticated users
CREATE POLICY "Allow authenticated users to view transactions" ON transactions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert transactions" ON transactions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Stock alerts: Full access for authenticated users
CREATE POLICY "Allow authenticated users to manage stock alerts" ON stock_alerts
    FOR ALL USING (auth.role() = 'authenticated');

-- Create a view for easy inventory reporting
CREATE VIEW inventory_report AS
SELECT 
    p.sku,
    p.name as product_name,
    s.name as storage_name,
    s.type as storage_type,
    i.quantity,
    i.updated_at
FROM inventory i
JOIN products p ON i.product_id = p.id
JOIN storages s ON i.storage_id = s.id
WHERE p.active = true AND s.active = true
ORDER BY p.sku, s.name;