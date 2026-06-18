#!/usr/bin/env node
// One-off migration: copy all rows from the old Supabase (PostgREST) backend into the
// local SQLite database. Preserves ids, timestamps and quantities exactly.
//
// Usage:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_KEY=<service_role key> \
//   DATABASE_PATH=data/inventory.db \
//   node scripts/migrate-from-supabase.mjs
//
// Use the SERVICE ROLE key (Supabase → Settings → API). The anon key is blocked by the old
// RLS policies (they only allow the `authenticated` role) and will read zero rows.

import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const SUPABASE_URL = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')
const SUPABASE_KEY = process.env.SUPABASE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const DB_PATH = process.env.DATABASE_PATH ?? 'data/inventory.db'

if (!SUPABASE_URL || !SUPABASE_KEY) {
	console.error('Set SUPABASE_URL and SUPABASE_KEY (service_role) env vars.')
	process.exit(1)
}

async function fetchAll(table) {
	const rows = []
	const pageSize = 1000
	for (let from = 0; ; from += pageSize) {
		const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
			headers: {
				apikey: SUPABASE_KEY,
				Authorization: `Bearer ${SUPABASE_KEY}`,
				Range: `${from}-${from + pageSize - 1}`,
				Prefer: 'count=exact'
			}
		})
		if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`)
		const batch = await res.json()
		rows.push(...batch)
		if (batch.length < pageSize) break
	}
	return rows
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
	id TEXT PRIMARY KEY, sku TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT,
	unit_size TEXT NOT NULL, pack_size INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS storages (
	id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL CHECK (type IN ('warehouse','home')),
	location_details TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inventory (
	id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
	storage_id TEXT NOT NULL REFERENCES storages(id) ON DELETE CASCADE,
	quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0), updated_at TEXT NOT NULL, UNIQUE(product_id, storage_id)
);
CREATE TABLE IF NOT EXISTS transactions (
	id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
	storage_id TEXT NOT NULL REFERENCES storages(id) ON DELETE CASCADE,
	transaction_type TEXT NOT NULL CHECK (transaction_type IN ('add','remove','transfer')),
	quantity INTEGER NOT NULL CHECK (quantity > 0),
	from_storage_id TEXT REFERENCES storages(id) ON DELETE CASCADE, to_storage_id TEXT REFERENCES storages(id) ON DELETE CASCADE,
	user_email TEXT, notes TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS stock_alerts (
	id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
	storage_id TEXT NOT NULL REFERENCES storages(id) ON DELETE CASCADE,
	threshold INTEGER NOT NULL CHECK (threshold >= 0), active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, UNIQUE(product_id, storage_id)
);
CREATE VIEW IF NOT EXISTS inventory_report AS
	SELECT i.product_id, i.storage_id, p.sku, p.name AS product_name, s.name AS storage_name,
		s.type AS storage_type, i.quantity, i.updated_at
	FROM inventory i JOIN products p ON i.product_id = p.id JOIN storages s ON i.storage_id = s.id
	WHERE p.active = 1 AND s.active = 1
	ORDER BY p.sku, s.name;
`

const b = (v) => (v ? 1 : 0)
const now = () => new Date().toISOString()

async function main() {
	console.log(`Reading from ${SUPABASE_URL} …`)
	const [products, storages, inventory, transactions, alerts] = await Promise.all([
		fetchAll('products'),
		fetchAll('storages'),
		fetchAll('inventory'),
		fetchAll('transactions'),
		fetchAll('stock_alerts')
	])
	console.log(
		`Fetched: ${products.length} products, ${storages.length} storages, ${inventory.length} inventory, ` +
			`${transactions.length} transactions, ${alerts.length} alerts`
	)
	if (products.length === 0 && storages.length === 0) {
		console.error('\nRead zero products/storages. Almost certainly the anon key + RLS — use the service_role key.')
		process.exit(2)
	}

	// Drop orphan / null-ref rows that would violate FK or NOT NULL constraints.
	const productIds = new Set(products.map((p) => p.id))
	const storageIds = new Set(storages.map((s) => s.id))
	const validRef = (id) => storageIds.has(id)

	const inventoryClean = inventory.filter((i) => productIds.has(i.product_id) && storageIds.has(i.storage_id))
	const transactionsClean = transactions.filter((t) => productIds.has(t.product_id) && storageIds.has(t.storage_id))
	const alertsClean = alerts.filter((a) => productIds.has(a.product_id) && storageIds.has(a.storage_id))
	const skipped =
		inventory.length - inventoryClean.length + (transactions.length - transactionsClean.length) + (alerts.length - alertsClean.length)
	if (skipped > 0) console.log(`Skipped ${skipped} orphan/null rows (missing product/storage reference).`)

	mkdirSync(dirname(DB_PATH), { recursive: true })
	const db = new DatabaseSync(DB_PATH)
	db.exec('PRAGMA foreign_keys = ON;')
	db.exec(SCHEMA)

	db.prepare('BEGIN').run()
	try {
		const insP = db.prepare(
			'INSERT OR REPLACE INTO products (id, sku, name, description, unit_size, pack_size, active, created_at) VALUES (?,?,?,?,?,?,?,?)'
		)
		for (const p of products)
			insP.run(p.id, p.sku, p.name, p.description ?? null, p.unit_size, p.pack_size ?? 1, b(p.active), p.created_at ?? now())

		const insS = db.prepare(
			'INSERT OR REPLACE INTO storages (id, name, type, location_details, active, created_at) VALUES (?,?,?,?,?,?)'
		)
		for (const s of storages)
			insS.run(s.id, s.name, s.type, s.location_details ?? null, b(s.active), s.created_at ?? now())

		const insI = db.prepare(
			'INSERT OR REPLACE INTO inventory (id, product_id, storage_id, quantity, updated_at) VALUES (?,?,?,?,?)'
		)
		for (const i of inventoryClean)
			insI.run(i.id, i.product_id, i.storage_id, i.quantity ?? 0, i.updated_at ?? now())

		const insT = db.prepare(
			'INSERT OR REPLACE INTO transactions (id, product_id, storage_id, transaction_type, quantity, from_storage_id, to_storage_id, user_email, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
		)
		for (const t of transactionsClean)
			insT.run(
				t.id, t.product_id, t.storage_id, t.transaction_type, t.quantity,
				validRef(t.from_storage_id) ? t.from_storage_id : null,
				validRef(t.to_storage_id) ? t.to_storage_id : null,
				t.user_email ?? null, t.notes ?? null, t.created_at ?? now()
			)

		const insA = db.prepare(
			'INSERT OR REPLACE INTO stock_alerts (id, product_id, storage_id, threshold, active, created_at) VALUES (?,?,?,?,?,?)'
		)
		for (const a of alertsClean)
			insA.run(a.id, a.product_id, a.storage_id, a.threshold, b(a.active), a.created_at ?? now())

		db.prepare('COMMIT').run()
	} catch (err) {
		db.prepare('ROLLBACK').run()
		throw err
	}

	console.log(`\nDone → ${DB_PATH}`)
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
