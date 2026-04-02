const PUBLIC_CART_STORAGE_KEY = 'grill-coffee-public-cart-v1'
export const PUBLIC_CART_EVENT = 'public-cart-changed'

function normalizeCartLine(line) {
  const productId = String(line?.productId ?? '').trim()
  const quantity = Math.max(0, Math.floor(Number(line?.quantity ?? 0)))
  if (!productId || quantity <= 0) return null
  return { productId, quantity }
}

export function readPublicCart() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(PUBLIC_CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeCartLine).filter(Boolean)
  } catch {
    return []
  }
}

export function writePublicCart(lines) {
  if (typeof window === 'undefined') return
  const normalized = Array.isArray(lines) ? lines.map(normalizeCartLine).filter(Boolean) : []
  window.localStorage.setItem(PUBLIC_CART_STORAGE_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new CustomEvent(PUBLIC_CART_EVENT))
}

export function getPublicCartCount() {
  return readPublicCart().reduce((sum, line) => sum + line.quantity, 0)
}

export function addPublicCartItem(productId, quantity = 1, options = {}) {
  const safeId = String(productId ?? '').trim()
  const delta = Math.max(1, Math.floor(Number(quantity ?? 1)))
  if (!safeId) return readPublicCart()

  const maxQty = Number.isFinite(Number(options.maxQty))
    ? Math.max(0, Math.floor(Number(options.maxQty)))
    : Number.POSITIVE_INFINITY

  const current = readPublicCart()
  const existing = current.find((line) => line.productId === safeId)
  const existingQty = existing ? existing.quantity : 0
  const nextQty = Math.min(maxQty, existingQty + delta)

  let next
  if (existing) {
    next = current.map((line) =>
      line.productId === safeId ? { ...line, quantity: nextQty } : line,
    )
  } else {
    next = [...current, { productId: safeId, quantity: nextQty }]
  }

  next = next.filter((line) => line.quantity > 0)
  writePublicCart(next)
  return next
}
