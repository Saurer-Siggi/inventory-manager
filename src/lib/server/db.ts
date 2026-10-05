import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type {
	Product,
	Storage,
	InventoryReport,
	StockAlertWithJoins,
	TransactionType,
	RecentCombo
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
	// client_id = idempotency key from the client (double taps / offline replays); reverts_id = undo link
	addColumnIfMissing(db, 'transactions', 'client_id', 'TEXT')
	addColumnIfMissing(db, 'transactions', 'reverts_id', 'TEXT')
	db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_client_id ON transactions(client_id) WHERE client_id IS NOT NULL')
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

		CREATE TABLE IF NOT EXISTS sessions (
			token_hash TEXT PRIMARY KEY,
			created_at TEXT NOT NULL,
			expires_at TEXT NOT NULL
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

// Additive column migrations (CREATE TABLE IF NOT EXISTS won't touch existing tables).
function addColumnIfMissing(db: DatabaseSync, table: string, column: string, ddl: string) {
	const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
	if (!cols.some(c => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`)
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
	reverts_id: string | null
	reverted: number
	product_name: string
	storage_name: string
	from_storage_name: string | null
	to_storage_name: string | null
}

export function getTransactions(limit = 80): HistoryRow[] {
	return (db
		.prepare(
			`SELECT t.id, t.created_at, t.transaction_type, t.quantity, t.user_email, t.notes, t.reverts_id,
				EXISTS (SELECT 1 FROM transactions r WHERE r.reverts_id = t.id) AS reverted,
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
	/** Idempotency key: a repeated key returns the original transaction instead of booking twice. */
	client_id?: string | null
	/** Allow stock to go below zero (otherwise rejected with InsufficientStockError). */
	force?: boolean
	reverts_id?: string | null
}

export class InsufficientStockError extends Error {
	constructor(
		public available: number,
		public requested: number
	) {
		super(`Nicht genug Bestand (${available} vorhanden, ${requested} angefragt)`)
	}
}

export function getStock(productId: string, storageId: string): number {
	const row = db
		.prepare('SELECT quantity FROM inventory WHERE product_id = ? AND storage_id = ?')
		.get(productId, storageId) as { quantity: number } | undefined
	return row?.quantity ?? 0
}

export function applyTransaction(input: TransactionInput): { id: string; duplicate: boolean } {
	if (input.client_id) {
		const existing = db.prepare('SELECT id FROM transactions WHERE client_id = ?').get(input.client_id) as
			| { id: string }
			| undefined
		if (existing) return { id: existing.id, duplicate: true }
	}

	const now = new Date().toISOString()
	const id = randomUUID()
	const upsert = (productId: string, storageId: string, delta: number) => {
		db.prepare(
			`INSERT INTO inventory (id, product_id, storage_id, quantity, updated_at)
			 VALUES (?, ?, ?, MAX(0, ?), ?)
			 ON CONFLICT(product_id, storage_id)
			 DO UPDATE SET quantity = MAX(0, quantity + ?), updated_at = ?`
		).run(randomUUID(), productId, storageId, delta, now, delta, now)
	}

	db.prepare('BEGIN IMMEDIATE').run()
	try {
		// A transfer can never move more than the source holds — not even with `force`. The source is
		// clamped at 0 but the destination would still get the full amount, which creates stock from nothing.
		// (Forcing a plain remove is fine: it can only lose phantom stock, never invent any.)
		if (input.transaction_type === 'transfer') {
			const available = getStock(input.product_id, input.from_storage_id!)
			if (available < input.quantity) throw new InsufficientStockError(available, input.quantity)
		} else if (!input.force && input.transaction_type === 'remove') {
			const available = getStock(input.product_id, input.storage_id)
			if (available < input.quantity) throw new InsufficientStockError(available, input.quantity)
		}

		db.prepare(
			`INSERT INTO transactions
				(id, product_id, storage_id, transaction_type, quantity, from_storage_id, to_storage_id, user_email, notes, created_at, client_id, reverts_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`
		).run(
			id,
			input.product_id,
			input.storage_id,
			input.transaction_type,
			input.quantity,
			input.from_storage_id ?? null,
			input.to_storage_id ?? null,
			input.notes ?? null,
			now,
			input.client_id ?? null,
			input.reverts_id ?? null
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
		return { id, duplicate: false }
	} catch (err) {
		db.prepare('ROLLBACK').run()
		throw err
	}
}

/** Undo = book the opposite transaction (the audit trail stays immutable). Only once per transaction. */
export function undoTransaction(id: string): { id: string } {
	const t = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any
	if (!t) throw new Error('Buchung nicht gefunden')
	if (t.reverts_id) throw new Error('Eine Rückbuchung kann nicht erneut rückgängig gemacht werden')
	if (db.prepare('SELECT 1 FROM transactions WHERE reverts_id = ?').get(id)) {
		throw new Error('Buchung wurde bereits rückgängig gemacht')
	}
	const note = 'Rückgängig gemacht' + (t.notes ? `: ${t.notes}` : '')
	const base = { product_id: t.product_id, quantity: t.quantity, notes: note, force: true, reverts_id: id }
	if (t.transaction_type === 'transfer') {
		return applyTransaction({
			...base,
			storage_id: t.to_storage_id,
			transaction_type: 'transfer',
			from_storage_id: t.to_storage_id,
			to_storage_id: t.from_storage_id
		})
	}
	return applyTransaction({
		...base,
		storage_id: t.storage_id,
		transaction_type: t.transaction_type === 'add' ? 'remove' : 'add'
	})
}

/** Most frequent recent bookings (last 60 days) — drives the one-tap "Zuletzt / Häufig" buttons. */
export function getRecentCombos(limit = 6): RecentCombo[] {
	return (db
		.prepare(
			`SELECT t.transaction_type,
				t.product_id,
				CASE WHEN t.transaction_type = 'transfer' THEN t.from_storage_id ELSE t.storage_id END AS storage_id,
				t.to_storage_id,
				t.quantity,
				COUNT(*) AS uses
			 FROM transactions t
			 JOIN products p ON p.id = t.product_id AND p.active = 1
			 WHERE t.reverts_id IS NULL
				AND t.created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-60 days')
				AND NOT EXISTS (SELECT 1 FROM transactions r WHERE r.reverts_id = t.id)
			 GROUP BY 1, 2, 3, 4, 5
			 ORDER BY uses DESC, MAX(t.created_at) DESC
			 LIMIT ?`
		)
		.all(limit) as any[]).map(r => ({ ...r })) as RecentCombo[]
}

/** Recent distinct notes of removals (e.g. delivery targets), most recent first. */
export function getRecentNotes(limit = 8): string[] {
	return (db
		.prepare(
			`SELECT notes FROM transactions
			 WHERE transaction_type = 'remove' AND reverts_id IS NULL AND notes IS NOT NULL AND TRIM(notes) != ''
				AND notes NOT LIKE 'Rückgängig%'
			 GROUP BY notes
			 ORDER BY MAX(created_at) DESC
			 LIMIT ?`
		)
		.all(limit) as { notes: string }[]).map(r => r.notes)
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
