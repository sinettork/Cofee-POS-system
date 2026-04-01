import express from 'express'
import { randomBytes } from 'node:crypto'
import {
  createOrder,
  createProduct,
  deleteProduct,
  getBootstrapData,
  getInventoryMovements,
  getProductById,
  getProductCatalog,
  getReportSummary,
  getUserByUsername,
  updateOrderStatus,
  updateProduct,
  verifyUserCredentials,
} from './db.js'

const app = express()
const port = 4000
const EXCHANGE_RATE_KHR = 4100
const ORDER_TYPES = new Set(['Dine In', 'Take Away'])
const ORDER_STATUSES = new Set(['Active', 'Closed', 'Done', 'Canceled'])
const PAYMENT_STATUSES = new Set(['Paid', 'Unpaid'])
const PAYMENT_METHODS = new Set(['Cash', 'KHQR', 'Card'])
const ROLE_CATALOG_MANAGER = ['admin', 'manager']
const ROLE_OPERATOR = ['admin', 'manager', 'cashier']
const SESSION_TTL_MS = 1000 * 60 * 60 * 12
const sessionStore = new Map()

app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/auth/login', (req, res) => {
  const username = String(req.body?.username ?? '').trim()
  const password = String(req.body?.password ?? '')
  if (!username || !password) {
    res.status(400).json({ error: 'username and password are required.' })
    return
  }
  const user = verifyUserCredentials(username, password)
  if (!user) {
    res.status(401).json({ error: 'Invalid username or password.' })
    return
  }
  const token = createSessionToken()
  const expiresAt = Date.now() + SESSION_TTL_MS
  sessionStore.set(token, {
    token,
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    expiresAt,
  })
  res.status(200).json({
    token,
    expiresAt,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  })
})

app.use('/api', requireAuth)

app.get('/api/auth/me', (req, res) => {
  const user = getUserByUsername(req.auth.username)
  if (!user || !user.active) {
    sessionStore.delete(req.auth.token)
    res.status(401).json({ error: 'Session is no longer valid.' })
    return
  }
  res.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
    expiresAt: req.auth.expiresAt,
  })
})

app.post('/api/auth/logout', (req, res) => {
  sessionStore.delete(req.auth.token)
  res.json({ ok: true })
})

app.get('/api/bootstrap', requireRoles(ROLE_OPERATOR), (_req, res) => {
  try {
    res.json(getBootstrapData())
  } catch (error) {
    res.status(500).json({ error: 'Unable to load bootstrap data.', details: String(error.message) })
  }
})

app.get('/api/inventory/movements', requireRoles(ROLE_CATALOG_MANAGER), (req, res) => {
  const limit = Number(req.query.limit ?? 80)
  const safeLimit = Number.isFinite(limit) ? Math.min(300, Math.max(1, Math.floor(limit))) : 80
  try {
    res.json({ movements: getInventoryMovements(safeLimit) })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load inventory movements.', details: String(error.message) })
  }
})

app.get('/api/products', requireRoles(ROLE_OPERATOR), (_req, res) => {
  try {
    res.json(getProductCatalog())
  } catch (error) {
    res.status(500).json({ error: 'Unable to load products.', details: String(error.message) })
  }
})

app.post('/api/products', requireRoles(ROLE_CATALOG_MANAGER), (req, res) => {
  const payload = sanitizeProductPayload(req.body ?? {})
  if (!payload.ok) {
    res.status(400).json({ error: payload.error })
    return
  }
  try {
    const created = createProduct(payload.value)
    res.status(201).json(created)
  } catch (error) {
    if (String(error.message).includes('FOREIGN KEY')) {
      res.status(400).json({ error: 'Invalid product category.' })
      return
    }
    res.status(500).json({ error: 'Unable to create product.', details: String(error.message) })
  }
})

app.post('/api/products/bulk', requireRoles(ROLE_CATALOG_MANAGER), (req, res) => {
  const sourceProducts = Array.isArray(req.body?.products) ? req.body.products : []
  const mode = String(req.body?.mode ?? 'skip_duplicates').trim().toLowerCase()
  if (sourceProducts.length === 0) {
    res.status(400).json({ error: 'products array is required.' })
    return
  }

  const created = []
  const skipped = []
  const errors = []

  sourceProducts.forEach((source, index) => {
    const payload = sanitizeProductPayload(source ?? {})
    if (!payload.ok) {
      errors.push({ index, error: payload.error })
      return
    }
    try {
      const product = createProduct(payload.value)
      created.push(product)
    } catch (error) {
      const message = String(error.message)
      const duplicateId = message.includes('UNIQUE constraint failed: products.id')
      const invalidCategory = message.includes('FOREIGN KEY')

      if (duplicateId && mode !== 'strict') {
        skipped.push({
          index,
          id: payload.value.id ?? null,
          reason: 'Duplicate product id',
        })
        return
      }
      errors.push({
        index,
        id: payload.value.id ?? null,
        error: invalidCategory ? 'Invalid product category.' : message,
      })
    }
  })

  const response = {
    total: sourceProducts.length,
    createdCount: created.length,
    skippedCount: skipped.length,
    errorCount: errors.length,
    created,
    skipped,
    errors,
  }

  if (created.length === 0 && errors.length > 0) {
    res.status(400).json({
      ...response,
      error: errors[0]?.error || 'Failed to import products.',
    })
    return
  }
  res.status(200).json(response)
})

app.patch('/api/products/:productId', requireRoles(ROLE_CATALOG_MANAGER), (req, res) => {
  const productId = String(req.params.productId ?? '')
  if (!productId) {
    res.status(400).json({ error: 'productId is required.' })
    return
  }
  const payload = sanitizeProductPayload(req.body ?? {})
  if (!payload.ok) {
    res.status(400).json({ error: payload.error })
    return
  }
  try {
    const updated = updateProduct(productId, payload.value)
    if (!updated) {
      res.status(404).json({ error: 'Product not found.' })
      return
    }
    res.json(getProductById(productId))
  } catch (error) {
    if (String(error.message).includes('FOREIGN KEY')) {
      res.status(400).json({ error: 'Invalid product category.' })
      return
    }
    res.status(500).json({ error: 'Unable to update product.', details: String(error.message) })
  }
})

app.delete('/api/products/:productId', requireRoles(ROLE_CATALOG_MANAGER), (req, res) => {
  const productId = String(req.params.productId ?? '')
  if (!productId) {
    res.status(400).json({ error: 'productId is required.' })
    return
  }
  try {
    const deleted = deleteProduct(productId)
    if (!deleted) {
      res.status(404).json({ error: 'Product not found.' })
      return
    }
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ error: 'Unable to delete product.', details: String(error.message) })
  }
})

app.post('/api/orders', requireRoles(ROLE_OPERATOR), (req, res) => {
  const payload = parseCreateOrderPayload(req.body ?? {})
  if (!payload.ok) {
    res.status(400).json({ error: payload.error })
    return
  }

  try {
    const result = createOrder(payload.value)
    res.status(201).json(result)
  } catch (error) {
    if (error?.code === 'PRODUCT_NOT_FOUND' || error?.code === 'INSUFFICIENT_STOCK') {
      res.status(400).json({ error: String(error.message || 'Unable to create order.') })
      return
    }
    res.status(500).json({ error: 'Failed to create order.', details: String(error.message) })
  }
})

app.patch('/api/orders/:orderNumber/status', requireRoles(ROLE_OPERATOR), (req, res) => {
  const orderNumber = `#${String(req.params.orderNumber).replace('#', '')}`
  const nextStatus = sanitizeOrderStatus(req.body?.status)
  const nextPaymentStatus = sanitizePaymentStatus(req.body?.paymentStatus, { optional: true })
  if (!nextStatus) {
    res.status(400).json({ error: 'Valid status is required.' })
    return
  }
  if (req.body?.paymentStatus != null && !nextPaymentStatus) {
    res.status(400).json({ error: 'Invalid paymentStatus.' })
    return
  }

  try {
    const updated = updateOrderStatus(orderNumber, nextStatus, nextPaymentStatus)
    if (!updated) {
      res.status(404).json({ error: 'Order not found.' })
      return
    }
    res.json({ ok: true })
  } catch (error) {
    const code = String(error?.code ?? '')
    if (code === 'ORDER_NOT_FOUND') {
      res.status(404).json({ error: 'Order not found.' })
      return
    }
    if (
      code === 'INVALID_ORDER_STATUS' ||
      code === 'INVALID_PAYMENT_STATUS' ||
      code === 'INVALID_ORDER_TRANSITION' ||
      code === 'PAYMENT_REQUIRED'
    ) {
      res.status(400).json({ error: String(error.message || 'Invalid order update.') })
      return
    }
    res.status(500).json({ error: 'Failed to update order.', details: String(error.message) })
  }
})

app.get('/api/reports/summary', requireRoles(ROLE_OPERATOR), (_req, res) => {
  try {
    res.json(getReportSummary())
  } catch (error) {
    res.status(500).json({ error: 'Failed to load report summary.', details: String(error.message) })
  }
})

app.listen(port, () => {
  console.log(`POS SQLite API running at http://localhost:${port}`)
})

function sanitizeProductPayload(source) {
  const id = String(source.id ?? '').trim()
  const name = String(source.name ?? '').trim()
  const category = String(source.category ?? '').trim()
  const label = String(source.label ?? '').trim()
  const image = String(source.image ?? '').trim()
  const description = String(source.description ?? '').trim()
  const basePrice = Number(source.basePrice ?? 0)
  const stockQty = Number(source.stockQty ?? source.stock_qty ?? 50)
  const stockThreshold = Number(source.stockThreshold ?? source.stock_threshold ?? 10)
  const stockNote = String(source.stockNote ?? source.stock_note ?? '').trim()
  const customizable = Boolean(source.customizable)
  const options =
    source.options && typeof source.options === 'object' && !Array.isArray(source.options)
      ? source.options
      : null

  if (!name) return { ok: false, error: 'Product name is required.' }
  if (!category || category === 'all') return { ok: false, error: 'Valid product category is required.' }
  if (!label) return { ok: false, error: 'Product label is required.' }
  if (!description) return { ok: false, error: 'Product description is required.' }
  if (!image) return { ok: false, error: 'Product image URL is required.' }
  if (!Number.isFinite(basePrice) || basePrice < 0) {
    return { ok: false, error: 'Product basePrice is invalid.' }
  }
  if (!Number.isFinite(stockQty) || stockQty < 0) {
    return { ok: false, error: 'Product stockQty is invalid.' }
  }
  if (!Number.isFinite(stockThreshold) || stockThreshold < 0) {
    return { ok: false, error: 'Product stockThreshold is invalid.' }
  }

  return {
    ok: true,
    value: {
      id: id || undefined,
      name,
      category,
      label,
      basePrice,
      stockQty,
      stockThreshold,
      stockNote: stockNote || undefined,
      image,
      description,
      customizable,
      options,
    },
  }
}

function sanitizePaymentMethod(value) {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (normalized === 'CARD') return 'Card'
  if (normalized === 'KHQR' || normalized === 'QRIS') return 'KHQR'
  return 'Cash'
}

function sanitizePaymentStatus(value, { optional = false } = {}) {
  if (value == null) return optional ? undefined : 'Unpaid'
  const normalized = String(value).trim().toUpperCase()
  if (normalized === 'PAID') return 'Paid'
  if (normalized === 'UNPAID') return 'Unpaid'
  return undefined
}

function sanitizeOrderStatus(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized) return undefined
  if (normalized === 'active') return 'Active'
  if (normalized === 'closed') return 'Closed'
  if (normalized === 'done') return 'Done'
  if (normalized === 'canceled' || normalized === 'cancelled') return 'Canceled'
  return undefined
}

function sanitizeCurrency(value) {
  return String(value ?? '').trim().toUpperCase() === 'KHR' ? 'KHR' : 'USD'
}

function convertCurrency(value, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return value
  if (fromCurrency === 'USD' && toCurrency === 'KHR') return value * EXCHANGE_RATE_KHR
  return value / EXCHANGE_RATE_KHR
}

function roundCurrency(value, currency) {
  const fractionDigits = currency === 'KHR' ? 0 : 2
  return Number(value.toFixed(fractionDigits))
}

function parseCreateOrderPayload(source) {
  const customerName = String(source.customerName ?? '').trim()
  const tableName = String(source.tableName ?? '').trim()
  const orderType = String(source.orderType ?? '').trim()
  if (!customerName || !tableName || !orderType) {
    return { ok: false, error: 'Missing customerName, tableName, or orderType.' }
  }
  if (!ORDER_TYPES.has(orderType)) {
    return { ok: false, error: 'orderType must be Dine In or Take Away.' }
  }
  if (!Array.isArray(source.items) || source.items.length === 0) {
    return { ok: false, error: 'Order items are required.' }
  }

  const paymentMethod = sanitizePaymentMethod(source.paymentMethod)
  if (!PAYMENT_METHODS.has(paymentMethod)) {
    return { ok: false, error: 'Invalid paymentMethod.' }
  }
  const paymentStatus = sanitizePaymentStatus(source.paymentStatus)
  if (!paymentStatus || !PAYMENT_STATUSES.has(paymentStatus)) {
    return { ok: false, error: 'Invalid paymentStatus.' }
  }
  const initialStatus = sanitizeOrderStatus(source.status) ?? 'Active'
  if (!ORDER_STATUSES.has(initialStatus)) {
    return { ok: false, error: 'Invalid order status.' }
  }
  if ((initialStatus === 'Closed' || initialStatus === 'Done') && paymentStatus !== 'Paid') {
    return { ok: false, error: `Order with status ${initialStatus} must have paymentStatus Paid.` }
  }

  const currency = sanitizeCurrency(source.currency)
  const paymentCurrency = sanitizeCurrency(source.paymentCurrency ?? currency)

  const sanitizedItems = source.items.map((item) => ({
    productId: String(item.productId ?? '').trim(),
    productName: String(item.productName ?? '').trim(),
    quantity: Number(item.quantity ?? 0),
    itemPrice: Number(item.itemPrice ?? 0),
    totalPrice: Number(item.totalPrice ?? 0),
    selectedOptions:
      item.selectedOptions && typeof item.selectedOptions === 'object' && !Array.isArray(item.selectedOptions)
        ? item.selectedOptions
        : {},
    notes: String(item.notes ?? '').trim(),
  }))
  const hasInvalidItem = sanitizedItems.some(
    (item) =>
      !item.productId ||
      !item.productName ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isFinite(item.itemPrice) ||
      item.itemPrice < 0 ||
      !Number.isFinite(item.totalPrice) ||
      item.totalPrice < 0,
  )
  if (hasInvalidItem) {
    return { ok: false, error: 'One or more items are invalid.' }
  }

  const subtotal = Number(source.subtotal ?? 0)
  const tax = Number(source.tax ?? 0)
  const discount = Number(source.discount ?? 0)
  const total = Number(source.total ?? subtotal + tax - discount)
  if ([subtotal, tax, discount, total].some((value) => !Number.isFinite(value) || value < 0)) {
    return { ok: false, error: 'Totals are invalid.' }
  }

  const totalInPaymentCurrency = roundCurrency(
    convertCurrency(total, currency, paymentCurrency),
    paymentCurrency,
  )
  let amountReceived = Number(source.amountReceived ?? totalInPaymentCurrency)
  let changeAmount = Number(source.changeAmount ?? 0)
  if ([amountReceived, changeAmount].some((value) => !Number.isFinite(value) || value < 0)) {
    return { ok: false, error: 'Payment amounts are invalid.' }
  }

  if (paymentMethod === 'Cash' && amountReceived + 0.000001 < totalInPaymentCurrency) {
    return {
      ok: false,
      error: `amountReceived must be greater than or equal to total in ${paymentCurrency}.`,
    }
  }
  if (paymentMethod === 'Cash') {
    amountReceived = roundCurrency(amountReceived, paymentCurrency)
    changeAmount = roundCurrency(Math.max(0, amountReceived - totalInPaymentCurrency), paymentCurrency)
  } else {
    amountReceived = totalInPaymentCurrency
    changeAmount = 0
  }

  return {
    ok: true,
    value: {
      customerName,
      tableName,
      orderType,
      paymentMethod,
      paymentStatus,
      currency,
      paymentCurrency,
      amountReceived,
      changeAmount,
      subtotal,
      tax,
      discount,
      total,
      items: sanitizedItems,
    },
  }
}

function createSessionToken() {
  return randomBytes(24).toString('hex')
}

function requireAuth(req, res, next) {
  const token = readBearerToken(req.headers?.authorization)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized.' })
    return
  }
  const session = sessionStore.get(token)
  if (!session) {
    res.status(401).json({ error: 'Invalid session.' })
    return
  }
  if (Date.now() > Number(session.expiresAt ?? 0)) {
    sessionStore.delete(token)
    res.status(401).json({ error: 'Session expired.' })
    return
  }
  req.auth = session
  next()
}

function requireRoles(roles = []) {
  const roleSet = new Set(roles)
  return (req, res, next) => {
    const userRole = String(req.auth?.role ?? '').trim()
    if (!roleSet.has(userRole)) {
      res.status(403).json({ error: 'Forbidden.' })
      return
    }
    next()
  }
}

function readBearerToken(headerValue) {
  const value = String(headerValue ?? '').trim()
  if (!value.toLowerCase().startsWith('bearer ')) return ''
  return value.slice(7).trim()
}
