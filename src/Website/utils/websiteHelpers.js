const ADDRESS_BOOK_STORAGE_KEY = 'eloise-public-address-book-v1'

const PRODUCT_EMOJI_BY_CATEGORY = {
  coffee: '\u2615',
  pastries: '\u{1F950}',
  pastry: '\u{1F950}',
  cake: '\u{1F370}',
  cakes: '\u{1F370}',
  breads: '\u{1F35E}',
  bread: '\u{1F35E}',
  donut: '\u{1F369}',
  donuts: '\u{1F369}',
  sandwich: '\u{1F96A}',
  sandwiches: '\u{1F96A}',
}

export function normalizePositiveInteger(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.floor(parsed))
}

export function toSafeCurrency(value) {
  return String(value ?? '').toUpperCase() === 'KHR' ? 'KHR' : 'USD'
}

export function isAbortRequestError(error) {
  if (!error) return false
  if (error.name === 'AbortError') return true
  return /aborted/i.test(String(error.message ?? ''))
}

export function deriveProductEmoji(category, index) {
  const key = String(category ?? '').trim().toLowerCase()
  if (PRODUCT_EMOJI_BY_CATEGORY[key]) return PRODUCT_EMOJI_BY_CATEGORY[key]
  if (index % 4 === 0) return '\u2615'
  if (index % 4 === 1) return '\u{1F950}'
  if (index % 4 === 2) return '\u{1F370}'
  return '\u{1F35E}'
}

export function hydrateCartLines(products = [], rawLines = []) {
  const productMap = new Map(products.map((product) => [String(product.id), product]))
  return rawLines
    .map((line) => {
      const productId = String(line?.productId ?? '')
      const product = productMap.get(productId)
      if (!product) return null
      const maxQty = normalizePositiveInteger(product.stockQty)
      if (maxQty <= 0) return null
      const quantity = Math.min(maxQty, normalizePositiveInteger(line.quantity))
      if (quantity <= 0) return null
      return { product, quantity }
    })
    .filter(Boolean)
}

export function parseCoordinatesFromText(text) {
  const source = String(text ?? '')
  if (!source) return null

  const queryMatch = source.match(/q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i)
  if (queryMatch) {
    const lat = Number(queryMatch[1])
    const lng = Number(queryMatch[2])
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  }

  const coordinateMatch = source.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/)
  if (!coordinateMatch) return null
  const lat = Number(coordinateMatch[1])
  const lng = Number(coordinateMatch[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

export function readAddressBook() {
  if (typeof window === 'undefined') return { home: '', work: '' }
  try {
    const raw = window.localStorage.getItem(ADDRESS_BOOK_STORAGE_KEY)
    if (!raw) return { home: '', work: '' }
    const parsed = JSON.parse(raw)
    return {
      home: String(parsed?.home ?? '').trim(),
      work: String(parsed?.work ?? '').trim(),
    }
  } catch {
    return { home: '', work: '' }
  }
}

export function writeAddressBook(next) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    ADDRESS_BOOK_STORAGE_KEY,
    JSON.stringify({
      home: String(next?.home ?? '').trim(),
      work: String(next?.work ?? '').trim(),
    }),
  )
}
