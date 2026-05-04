export type Product = {
	id: string
	sku: string
	name: string
	description: string | null
	unit_size: string
	pack_size: number
	active: boolean
	created_at: string
}

export type Storage = {
	id: string
	name: string
	type: string
	location_details: string | null
	active: boolean
	created_at: string
}

export type InventoryItem = {
	id: string
	product_id: string
	storage_id: string
	quantity: number
	updated_at: string
}

export type InventoryReport = {
	product_id: string
	storage_id: string
	sku: string
	product_name: string
	storage_name: string
	storage_type: string
	quantity: number
	updated_at: string
}

export type TransactionType = 'add' | 'remove' | 'transfer'

export type Transaction = {
	id: string
	product_id: string
	storage_id: string
	transaction_type: TransactionType
	quantity: number
	from_storage_id: string | null
	to_storage_id: string | null
	user_email: string | null
	notes: string | null
	created_at: string
}

export type StockAlert = {
	id: string
	product_id: string
	storage_id: string
	threshold: number
	active: boolean
}

export type StockAlertWithJoins = StockAlert & {
	products: { name: string; sku: string }
	storages: { name: string; type: string }
}

export type TriggeredAlert = StockAlertWithJoins & {
	current_quantity: number
	product_name: string
	storage_name: string
}
