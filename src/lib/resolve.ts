import type { Product, Storage } from './database.types.js'

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Deep-link helper: product by id or SKU (case-insensitive). */
export function resolveProductId(param: string, list: Product[]): string | null {
	const p = param.trim()
	if (!p) return null
	if (uuidRe.test(p)) return list.some(x => x.id === p) ? p : null
	return list.find(x => x.sku.toLowerCase() === p.toLowerCase())?.id ?? null
}

/** Deep-link helper: storage by id, exact name or unique name substring ("9073" works). */
export function resolveStorageId(param: string, list: Storage[]): { id: string } | { error: string } {
	const raw = param.trim()
	if (!raw) return { error: 'Leerer Lagerort' }
	let decoded = raw
	try {
		decoded = decodeURIComponent(raw)
	} catch {}
	if (uuidRe.test(decoded)) return list.some(s => s.id === decoded) ? { id: decoded } : { error: 'Unbekannte Lagerort-ID' }
	const lower = decoded.toLowerCase()
	const exact = list.find(s => s.name.toLowerCase() === lower)
	if (exact) return { id: exact.id }
	const subs = list.filter(s => s.name.toLowerCase().includes(lower))
	if (subs.length === 1) return { id: subs[0].id }
	if (subs.length > 1) return { error: `„${decoded}“ passt auf mehrere Lagerorte — bitte genauer angeben` }
	return { error: `Unbekannter Lagerort: ${decoded}` }
}
