import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type {
	Product,
	Storage,
	InventoryReport,
	StockAlertWithJoins,
	TransactionType
} from '$lib/database.types.js'

const DB_PATH = process.env.DATABASE_PATH ?? 'data/inventory.db'

// Cache the handle across SvelteKit dev HMR reloads so we don't leak connections.
const globalForDb = globalThis as unknown as { __siggiDb?: DatabaseSync }

function openDb(): DatabaseSync {
	mkdirSync(dirname(DB_PATH), { recursive: true })
	const db = new DatabaseSync(DB_PATH)
	db.exec('PRAGMA journal_mode = WAL;')
	db.exec('PRAGMA foreign_keys = ON;')
	migrate(db)
	return db
}

export const db: DatabaseSync = globalForDb.__siggiDb ?? (globalForDb.__siggiDb = openDb())

function migrate(db: DatabaseSync) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS products (
			id TEXT PRIMARY KEY,
			sku TEXT UNIQUE NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			unit_size TEXT NOT NULL,
			pack_size INTEGER NOT NULL DEFAULT 1,
			active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS storages (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			type TEXT NOT NULL CHECK (type IN ('warehouse', 'home')),
			location_details TEXT,
			active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS inventory (
			id TEXT PRIMARY KEY,
			product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
			storage_id TEXT NOT NULL REFERENCES storages(id) ON DELETE CASCADE,
			quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
			updated_at TEXT NOT NULL,
			UNIQUE(product_id, storage_id)
		);

		CREATE TABLE IF NOT EXISTS transactions (
			id TEXT PRIMARY KEY,
			product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
			storage_id TEXT NOT NULL REFERENCES storages(id) ON DELETE CASCADE,
			transaction_type TEXT NOT NULL CHECK (transaction_type IN ('add', 'remove', 'transfer')),
			quantity INTEGER NOT NULL CHECK (quantity > 0),
			from_storage_id TEXT REFERENCES storages(id) ON DELETE CASCADE,
			to_storage_id TEXT REFERENCES storages(id) ON DELETE CASCADE,
			user_email TEXT,
			notes TEXT,
			created_at TEXT NOT NULL,
			CHECK (
				(transaction_type = 'transfer' AND from_storage_id IS NOT NULL AND to_storage_id IS NOT NULL) OR
				(transaction_type != 'transfer' AND from_storage_id IS NULL AND to_storage_id IS NULL)
			)
		);

		CREATE TABLE IF NOT EXISTS stock_alerts (
			id TEXT PRIMARY KEY,
			product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
			storage_id TEXT NOT NULL REFERENCES storages(id) ON DELETE CASCADE,
			threshold INTEGER NOT NULL CHECK (threshold >= 0),
			active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL,
			UNIQUE(product_id, storage_id)
		);

		CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
		CREATE INDEX IF NOT EXISTS idx_inventory_product_storage ON inventory(product_id, storage_id);

		CREATE VIEW IF NOT EXISTS inventory_report AS
			SELECT
				i.product_id,
				i.storage_id,
				p.sku,
				p.name AS product_name,
				s.name AS storage_name,
				s.type AS storage_type,
				i.quantity,
				i.updated_at
			FROM inventory i
			JOIN products p ON i.product_id = p.id
			JOIN storages s ON i.storage_id = s.id
			WHERE p.active = 1 AND s.active = 1
			ORDER BY p.sku, s.name;
	`)
}

// ─── Row mapping ───────────────────────────────────────────────────────────────
// SQLite has no boolean type; `active` comes back as 0/1. Convert to real booleans
// so the rest of the app (typed as `boolean`) behaves as before.
const toProduct = (r: any): Product => ({ ...r, active: !!r.active })
const toStorage = (r: any): Storage => ({ ...r, active: !!r.active })

// ─── Reads ───────────────────────────────────────────────────────────────────
export function getProducts(): Product[] {
	return (db.prepare('SELECT * FROM products ORDER BY sku').all() as any[]).map(toProduct)
}

export function getStorages(): Storage[] {
	return (db.prepare('SELECT * FROM storages ORDER BY name').all() as any[]).map(toStorage)
}

export function getInventoryReport(): InventoryReport[] {
	// node:sqlite rows have a null prototype; spread into plain objects so SvelteKit
	// can serialise them through devalue when returned from `load`.
	return (db.prepare('SELECT * FROM inventory_report ORDER BY product_name, storage_name').all() as any[]).map(
		r => ({ ...r })
	) as InventoryReport[]
}

export function getAlerts(activeOnly = false): StockAlertWithJoins[] {
	const rows = db
		.prepare(
			`SELECT a.*, p.name AS product_name, p.sku AS product_sku, s.name AS storage_name, s.type AS storage_type
			 FROM stock_alerts a
			 JOIN products p ON a.product_id = p.id
			 JOIN storages s ON a.storage_id = s.id
			 ${activeOnly ? 'WHERE a.active = 1' : ''}
			 ORDER BY a.created_at DESC`
		)
		.all() as any[]
	return rows.map(r => ({
		id: r.id,
		product_id: r.product_id,
		storage_id: r.storage_id,
		threshold: r.threshold,
		active: !!r.active,
		products: { name: r.product_name, sku: r.product_sku },
		storages: { name: r.storage_name, type: r.storage_type }
	}))
}

export type HistoryRow = {
	id: string
	created_at: string
	transaction_type: string
	quantity: number
	user_email: string | null
	notes: string | null
	product_name: string
	storage_name: string
	from_storage_name: string | null
	to_storage_name: string | null
}

export function getTransactions(limit = 80): HistoryRow[] {
	return (db
		.prepare(
			`SELECT t.id, t.created_at, t.transaction_type, t.quantity, t.user_email, t.notes,
				p.name AS product_name,
				s.name AS storage_name,
				fs.name AS from_storage_name,
				ts.name AS to_storage_name
			 FROM transactions t
			 LEFT JOIN products p ON t.product_id = p.id
			 LEFT JOIN storages s ON t.storage_id = s.id
			 LEFT JOIN storages fs ON t.from_storage_id = fs.id
			 LEFT JOIN storages ts ON t.to_storage_id = ts.id
			 ORDER BY t.created_at DESC
			 LIMIT ?`
		)
		.all(limit) as any[]).map(r => ({ ...r })) as HistoryRow[]
}

// ─── Transactions (mutate inventory, mirrors the old Postgres trigger) ──────────
export type TransactionInput = {
	product_id: string
	storage_id: string
	transaction_type: TransactionType
	quantity: number
	from_storage_id?: string | null
	to_storage_id?: string | null
	notes?: string | null
}

export function applyTransaction(input: TransactionInput) {
	const now = new Date().toISOString()
	const upsert = (productId: string, storageId: string, delta: number) => {
		db.prepare(
			`INSERT INTO inventory (id, product_id, storage_id, quantity, updated_at)
			 VALUES (?, ?, ?, MAX(0, ?), ?)
			 ON CONFLICT(product_id, storage_id)
			 DO UPDATE SET quantity = MAX(0, quantity + ?), updated_at = ?`
		).run(randomUUID(), productId, storageId, delta, now, delta, now)
	}

	db.prepare('BEGIN').run()
	try {
		db.prepare(
			`INSERT INTO transactions
				(id, product_id, storage_id, transaction_type, quantity, from_storage_id, to_storage_id, user_email, notes, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
		).run(
			randomUUID(),
			input.product_id,
			input.storage_id,
			input.transaction_type,
			input.quantity,
			input.from_storage_id ?? null,
			input.to_storage_id ?? null,
			input.notes ?? null,
			now
		)

		if (input.transaction_type === 'add') {
			upsert(input.product_id, input.storage_id, input.quantity)
		} else if (input.transaction_type === 'remove') {
			upsert(input.product_id, input.storage_id, -input.quantity)
		} else {
			upsert(input.product_id, input.from_storage_id!, -input.quantity)
			upsert(input.product_id, input.to_storage_id!, input.quantity)
		}
		db.prepare('COMMIT').run()
	} catch (err) {
		db.prepare('ROLLBACK').run()
		throw err
	}
}

// ─── Product CRUD ──────────────────────────────────────────────────────────────
export type ProductInput = {
	sku: string
	name: string
	description?: string | null
	unit_size: string
	pack_size: number
	active: boolean
}

export function createProduct(p: ProductInput): Product {
	const id = randomUUID()
	db.prepare(
		'INSERT INTO products (id, sku, name, description, unit_size, pack_size, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
	).run(id, p.sku, p.name, p.description ?? null, p.unit_size, p.pack_size, p.active ? 1 : 0, new Date().toISOString())
	return toProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id))
}

export function updateProduct(id: string, p: ProductInput) {
	db.prepare(
		'UPDATE products SET sku = ?, name = ?, description = ?, unit_size = ?, pack_size = ?, active = ? WHERE id = ?'
	).run(p.sku, p.name, p.description ?? null, p.unit_size, p.pack_size, p.active ? 1 : 0, id)
}

export function deleteProduct(id: string) {
	db.prepare('DELETE FROM products WHERE id = ?').run(id)
}

// ─── Storage CRUD ──────────────────────────────────────────────────────────────
export type StorageInput = {
	name: string
	type: string
	location_details?: string | null
	active: boolean
}

export function createStorage(s: StorageInput): Storage {
	const id = randomUUID()
	db.prepare(
		'INSERT INTO storages (id, name, type, location_details, active, created_at) VALUES (?, ?, ?, ?, ?, ?)'
	).run(id, s.name, s.type, s.location_details ?? null, s.active ? 1 : 0, new Date().toISOString())
	return toStorage(db.prepare('SELECT * FROM storages WHERE id = ?').get(id))
}

export function updateStorage(id: string, s: StorageInput) {
	db.prepare('UPDATE storages SET name = ?, type = ?, location_details = ?, active = ? WHERE id = ?').run(
		s.name,
		s.type,
		s.location_details ?? null,
		s.active ? 1 : 0,
		id
	)
}

export function deleteStorage(id: string) {
	db.prepare('DELETE FROM storages WHERE id = ?').run(id)
}

// ─── Alert CRUD ────────────────────────────────────────────────────────────────
export type AlertInput = {
	product_id: string
	storage_id: string
	threshold: number
	active: boolean
}

export function createAlert(a: AlertInput) {
	db.prepare(
		'INSERT INTO stock_alerts (id, product_id, storage_id, threshold, active, created_at) VALUES (?, ?, ?, ?, ?, ?)'
	).run(randomUUID(), a.product_id, a.storage_id, a.threshold, a.active ? 1 : 0, new Date().toISOString())
}

export function updateAlert(id: string, a: AlertInput) {
	db.prepare('UPDATE stock_alerts SET product_id = ?, storage_id = ?, threshold = ?, active = ? WHERE id = ?').run(
		a.product_id,
		a.storage_id,
		a.threshold,
		a.active ? 1 : 0,
		id
	)
}

export function deleteAlert(id: string) {
	db.prepare('DELETE FROM stock_alerts WHERE id = ?').run(id)
}

/** True if the error is a UNIQUE constraint violation (e.g. duplicate alert / sku). */
export function isUniqueViolation(err: unknown): boolean {
	return err instanceof Error && /UNIQUE constraint failed/i.test(err.message)
}

/** True if the error is a FK constraint violation (e.g. deleting a product with history). */
export function isForeignKeyViolation(err: unknown): boolean {
	return err instanceof Error && /FOREIGN KEY constraint failed/i.test(err.message)
}
