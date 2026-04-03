import express from 'express'
import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { CURRENCY as KHQRCurrency, KHQR, TAG } from 'ts-khqr'
import {
  createCustomerAccount,
  createCategory,
  createKhqrTransaction,
  createOrder,
  createProduct,
  db,
  deleteProduct,
  getKhqrTransactionByMd5,
  getBootstrapData,
  getCatalogSnapshot,
  getInventoryMovements,
  getProductById,
  getProductCatalog,
  getReportSummary,
  getCustomerAccountById,
  getUserByUsername,
  updateCustomerAccount,
  updateKhqrTransactionStatus,
  updateOrderStatus,
  updateProduct,
  verifyCustomerCredentials,
  verifyUserCredentials,
} from './database/db.js'

const app = express()
const port = Number(process.env.PORT ?? 4000)
const EXCHANGE_RATE_KHR = 4100
const ORDER_TYPES = new Set(['Dine In', 'Take Away'])
const ORDER_STATUSES = new Set(['Active', 'Closed', 'Done', 'Canceled'])
const PAYMENT_STATUSES = new Set(['Paid', 'Unpaid'])
const PAYMENT_METHODS = new Set(['Cash', 'KHQR', 'Card'])
const USER_ROLES = new Set(['manager', 'cashier'])
const SETTING_KEYS = new Set(['taxRate', 'receiptFooter', 'defaultService'])
const ROLE_CATALOG_MANAGER = ['manager']
const ROLE_OPERATOR = ['manager', 'cashier']
const ROLE_USER_MANAGER = ['manager']
const SESSION_TTL_MS = 1000 * 60 * 60 * 12
const CUSTOMER_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14
const sessionStore = new Map()
const customerSessionStore = new Map()
const ENV_FILE_PATH = path.resolve(process.cwd(), '.env')

reloadEnvFromDotFile()

const BAKONG_CHECK_BY_MD5_ENDPOINT =
  process.env.BAKONG_CHECK_BY_MD5_ENDPOINT ?? 'https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5'
const KHQR_EXPIRE_MS = 10 * 60 * 1000

app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/public/catalog', (_req, res) => {
  try {
    const { categories, products } = getCatalogSnapshot()
    const taxRateValue = db.prepare("SELECT value FROM settings WHERE key = 'taxRate' LIMIT 1").get()?.value
    const parsedTaxRate = Number(taxRateValue ?? 10)
    const taxRate = Number.isFinite(parsedTaxRate) ? Math.max(0, parsedTaxRate) : 10
    res.json({
      categories,
      products,
      currency: 'USD',
      taxRate,
    })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load public product catalog.', details: String(error.message) })
  }
})

app.get('/api/public/payment-config', (_req, res) => {
  reloadEnvFromDotFile()
  const accountID = readEnvValue(['BAKONG_ACCOUNT_ID', 'BAKONG_ACCOUNTID', 'accountID', 'accountId'])
  const merchantName = readEnvValue(['BAKONG_MERCHANT_NAME'], 'Bakehouse POS')
  const merchantCity = readEnvValue(['BAKONG_MERCHANT_CITY'], 'Phnom Penh')
  const merchantTag = readEnvValue(['BAKONG_MERCHANT_TAG'], 'INDIVIDUAL').toUpperCase()
  const staticQrFromEnv = readEnvValue(['PUBLIC_KHQR_QR', 'WEBSITE_KHQR_QR'])
  let qr = staticQrFromEnv

  if (!qr && accountID) {
    const generated = KHQR.generate({
      tag: merchantTag === 'MERCHANT' ? TAG.MERCHANT : TAG.INDIVIDUAL,
      accountID,
      merchantName,
      merchantCity,
      currency: KHQRCurrency.USD,
      additionalData: {
        storeLabel: String(process.env.BAKONG_STORE_LABEL ?? 'Bakehouse'),
      },
    })
    if (generated?.data?.qr && Number(generated?.status?.code ?? -1) === 0) {
      qr = String(generated.data.qr)
    }
  }

  res.json({
    cashLabel: 'Cash on Delivery',
    khqr: {
      enabled: Boolean(qr),
      qr: qr || '',
      merchantName,
      merchantCity,
      accountId: accountID || '',
    },
  })
})

app.post('/api/public/orders', (req, res) => {
  const customerSession = readCustomerSession(req)
  if (!customerSession) {
    res.status(401).json({ error: 'Customer login is required before checkout.' })
    return
  }
  const payload = parsePublicOnlineOrderPayload({
    ...(req.body ?? {}),
    customerName: String(req.body?.customerName ?? customerSession.fullName ?? '').trim(),
  })
  if (!payload.ok) {
    res.status(400).json({ error: payload.error })
    return
  }

  try {
    const result = createOrder(payload.value)
    res.status(201).json({
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      status: 'Active',
      paymentMethod: payload.value.paymentMethod,
      paymentStatus: payload.value.paymentStatus,
      message:
        payload.value.paymentStatus === 'Paid'
          ? 'Payment processed and order received.'
          : 'Order received. Please wait for shop confirmation.',
    })
  } catch (error) {
    if (error?.code === 'PRODUCT_NOT_FOUND' || error?.code === 'INSUFFICIENT_STOCK') {
      res.status(400).json({ error: String(error.message || 'Unable to create order.') })
      return
    }
    res.status(500).json({ error: 'Failed to create public order.', details: String(error.message) })
  }
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

app.post('/api/public/khqr/generate', (req, res) => {
  handleKhqrGenerateRequest(req, res)
})

app.get('/api/public/khqr/status/:md5', async (req, res) => {
  await handleKhqrStatusRequest(req, res)
})

app.post('/api/public/customers/register', (req, res) => {
  const fullName = String(req.body?.fullName ?? '').trim()
  const email = String(req.body?.email ?? '').trim()
  const phone = String(req.body?.phone ?? '').trim()
  const address = String(req.body?.address ?? '').trim()
  const password = String(req.body?.password ?? '')
  if (!fullName) {
    res.status(400).json({ error: 'fullName is required.' })
    return
  }
  if (!email && !phone) {
    res.status(400).json({ error: 'email or phone is required.' })
    return
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' })
    return
  }
  try {
    const customer = createCustomerAccount({
      fullName,
      email,
      phone,
      address,
      password,
    })
    const { token, expiresAt } = createCustomerSession(customer)
    res.status(201).json({
      token,
      expiresAt,
      customer: {
        id: customer.id,
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        address: customer.address || '',
      },
    })
  } catch (error) {
    const code = String(error?.code ?? '')
    if (
      code === 'CUSTOMER_NAME_REQUIRED' ||
      code === 'CUSTOMER_CONTACT_REQUIRED' ||
      code === 'CUSTOMER_PASSWORD_TOO_SHORT'
    ) {
      res.status(400).json({ error: String(error.message) })
      return
    }
    if (code === 'CUSTOMER_EMAIL_EXISTS' || code === 'CUSTOMER_PHONE_EXISTS') {
      res.status(409).json({ error: String(error.message) })
      return
    }
    res.status(500).json({ error: 'Unable to register customer account.', details: String(error.message) })
  }
})

app.post('/api/public/customers/login', (req, res) => {
  const login = String(req.body?.login ?? '').trim()
  const password = String(req.body?.password ?? '')
  if (!login || !password) {
    res.status(400).json({ error: 'login and password are required.' })
    return
  }
  const customer = verifyCustomerCredentials(login, password)
  if (!customer) {
    res.status(401).json({ error: 'Invalid phone/email or password.' })
    return
  }
  const { token, expiresAt } = createCustomerSession(customer)
  res.status(200).json({
    token,
    expiresAt,
    customer: {
      id: customer.id,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      address: customer.address || '',
    },
  })
})

app.get('/api/public/customers/me', (req, res) => {
  const session = readCustomerSession(req)
  if (!session) {
    res.status(401).json({ error: 'Customer session not found.' })
    return
  }
  const customer = getCustomerAccountById(session.customerId)
  if (!customer || !customer.active) {
    customerSessionStore.delete(session.token)
    res.status(401).json({ error: 'Customer session is no longer valid.' })
    return
  }
  res.json({
    customer: {
      id: customer.id,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      address: customer.address || '',
    },
    expiresAt: session.expiresAt,
  })
})

app.patch('/api/public/customers/me', (req, res) => {
  const session = readCustomerSession(req)
  if (!session) {
    res.status(401).json({ error: 'Customer session not found.' })
    return
  }
  try {
    const customer = updateCustomerAccount(session.customerId, {
      fullName: req.body?.fullName,
      email: req.body?.email,
      phone: req.body?.phone,
      address: req.body?.address,
    })
    if (!customer) {
      customerSessionStore.delete(session.token)
      res.status(404).json({ error: 'Customer account not found.' })
      return
    }
    customerSessionStore.set(session.token, {
      ...session,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
    })
    res.json({
      customer: {
        id: customer.id,
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        address: customer.address || '',
      },
    })
  } catch (error) {
    const code = String(error?.code ?? '')
    if (
      code === 'CUSTOMER_NAME_REQUIRED' ||
      code === 'CUSTOMER_CONTACT_REQUIRED'
    ) {
      res.status(400).json({ error: String(error.message) })
      return
    }
    if (code === 'CUSTOMER_EMAIL_EXISTS' || code === 'CUSTOMER_PHONE_EXISTS') {
      res.status(409).json({ error: String(error.message) })
      return
    }
    res.status(500).json({ error: 'Unable to update customer profile.', details: String(error.message) })
  }
})

app.post('/api/public/customers/logout', (req, res) => {
  const token = readCustomerSessionToken(req)
  if (token) customerSessionStore.delete(token)
  res.json({ ok: true })
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

app.post('/api/categories', requireRoles(ROLE_CATALOG_MANAGER), (req, res) => {
  const payload = sanitizeCategoryPayload(req.body ?? {})
  if (!payload.ok) {
    res.status(400).json({ error: payload.error })
    return
  }
  try {
    const created = createCategory(payload.value)
    res.status(201).json(created)
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed: categories.id')) {
      res.status(409).json({ error: 'Category id already exists.' })
      return
    }
    res.status(500).json({ error: 'Unable to create category.', details: String(error.message) })
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
    if (error?.code === 'PRODUCT_HAS_MOVEMENTS') {
      res.status(409).json({ error: String(error.message || 'Product cannot be deleted.') })
      return
    }
    if (String(error?.message ?? '').includes('FOREIGN KEY')) {
      res.status(409).json({ error: 'Product cannot be deleted because it is referenced by related records.' })
      return
    }
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

app.post('/api/khqr/generate', requireRoles(ROLE_OPERATOR), (req, res) => {
  handleKhqrGenerateRequest(req, res)
})

app.get('/api/khqr/status/:md5', requireRoles(ROLE_OPERATOR), async (req, res) => {
  await handleKhqrStatusRequest(req, res)
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

app.get('/api/orders/:orderNumber', requireRoles(ROLE_OPERATOR), (req, res) => {
  const orderNumber = `#${String(req.params.orderNumber).replace('#', '')}`
  try {
    const order = db
      .prepare(
        `
        SELECT
          id,
          order_number,
          customer_name,
          table_name,
          order_type,
          payment_method,
          payment_status,
          currency,
          payment_currency,
          amount_received,
          change_amount,
          status,
          kitchen_status,
          created_at,
          subtotal,
          tax,
          discount,
          total
        FROM orders
        WHERE order_number = ?
      `,
      )
      .get(orderNumber)
    if (!order) {
      res.status(404).json({ error: 'Order not found.' })
      return
    }
    const items = db
      .prepare(
        `
        SELECT product_id, product_name, quantity, unit_price, total_price, options_json, notes
        FROM order_items
        WHERE order_id = ?
      `,
      )
      .all(order.id)
      .map((row) => ({
        productId: row.product_id,
        productName: row.product_name,
        quantity: Number(row.quantity ?? 0),
        unitPrice: Number(row.unit_price ?? 0),
        totalPrice: Number(row.total_price ?? 0),
        options: parseJsonObject(row.options_json),
        notes: row.notes ?? '',
      }))

    res.json({
      order: order.order_number,
      customer: order.customer_name,
      table: order.table_name,
      orderType: order.order_type,
      status: order.status,
      kitchenStatus: order.kitchen_status,
      payment: Number(order.subtotal ?? 0),
      subtotal: Number(order.subtotal ?? 0),
      tax: Number(order.tax ?? 0),
      discount: Number(order.discount ?? 0),
      total: Number(order.total ?? 0),
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      currency: order.currency ?? 'USD',
      paymentCurrency: order.payment_currency || order.currency || 'USD',
      amountReceived: Number(order.amount_received ?? 0),
      changeAmount: Number(order.change_amount ?? 0),
      createdAt: order.created_at,
      items,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load order detail.', details: String(error.message) })
  }
})

app.patch('/api/tables/:tableId', requireRoles(ROLE_OPERATOR), (req, res) => {
  const tableId = String(req.params.tableId ?? '').trim()
  const status = String(req.body?.status ?? '').trim().toLowerCase()
  const guest = String(req.body?.guest ?? '0 Guest').trim()
  const pax = Number(req.body?.pax ?? 0)
  const timeLabel = String(req.body?.time ?? '--:--').trim()
  const validStatuses = new Set(['available', 'reserved', 'served'])
  if (!tableId || !validStatuses.has(status)) {
    res.status(400).json({ error: 'Invalid tableId or status.' })
    return
  }
  if (!Number.isFinite(pax) || pax < 0) {
    res.status(400).json({ error: 'Invalid pax value.' })
    return
  }
  try {
    const result = db
      .prepare(
        `
        UPDATE dining_tables
        SET status = ?, guest_name = ?, pax = ?, time_label = ?
        WHERE id = ?
      `,
      )
      .run(status, guest || '0 Guest', Math.floor(pax), timeLabel || '--:--', tableId)
    if (result.changes === 0) {
      res.status(404).json({ error: 'Table not found.' })
      return
    }
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to update table.', details: String(error.message) })
  }
})

app.post('/api/tables', requireRoles(ROLE_OPERATOR), (req, res) => {
  const groupTitle = String(req.body?.groupTitle ?? '').trim()
  if (!groupTitle) {
    res.status(400).json({ error: 'groupTitle is required.' })
    return
  }
  try {
    const rows = db.prepare('SELECT id FROM dining_tables').all()
    const nextNumber =
      rows
        .map((row) => Number(String(row.id ?? '').replace('T-', '')))
        .filter((value) => Number.isFinite(value))
        .reduce((max, value) => Math.max(max, value), 0) + 1
    const tableId = `T-${String(nextNumber).padStart(2, '0')}`
    db.prepare(
      `
      INSERT INTO dining_tables (id, group_title, guest_name, pax, time_label, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    ).run(tableId, groupTitle, '0 Guest', 0, '--:--', 'available')
    res.status(201).json({ ok: true, id: tableId })
  } catch (error) {
    res.status(500).json({ error: 'Failed to create table.', details: String(error.message) })
  }
})

app.get('/api/settings', requireRoles(ROLE_OPERATOR), (_req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings ORDER BY key').all()
    const result = {}
    rows.forEach((row) => {
      result[row.key] = row.value
    })
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: 'Failed to load settings.', details: String(error.message) })
  }
})

app.patch('/api/settings', requireRoles(ROLE_CATALOG_MANAGER), (req, res) => {
  const updates = req.body && typeof req.body === 'object' ? req.body : {}
  const entries = Object.entries(updates).filter(([key]) => SETTING_KEYS.has(String(key)))
  if (entries.length === 0) {
    res.json({ ok: true })
    return
  }
  const upsert = db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `)
  try {
    db.exec('BEGIN IMMEDIATE TRANSACTION')
    entries.forEach(([key, value]) => {
      upsert.run(String(key), String(value ?? ''))
    })
    db.exec('COMMIT')
    res.json({ ok: true })
  } catch (error) {
    db.exec('ROLLBACK')
    res.status(500).json({ error: 'Failed to save settings.', details: String(error.message) })
  }
})

app.get('/api/users', requireRoles(ROLE_CATALOG_MANAGER), (_req, res) => {
  try {
    const rows = db
      .prepare(
        `
        SELECT id, username, display_name, role, active, created_at
        FROM users
        ORDER BY id
      `,
      )
      .all()
      .map((row) => ({
        id: Number(row.id),
        username: row.username,
        displayName: row.display_name,
        role: row.role,
        active: Boolean(row.active),
        createdAt: row.created_at,
      }))
    res.json({ users: rows })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load users.', details: String(error.message) })
  }
})

app.post('/api/users', requireRoles(ROLE_USER_MANAGER), (req, res) => {
  const username = String(req.body?.username ?? '').trim().toLowerCase()
  const displayName = String(req.body?.displayName ?? '').trim()
  const role = String(req.body?.role ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')
  if (!username || !displayName || !password || !USER_ROLES.has(role)) {
    res.status(400).json({ error: 'username, displayName, role, and password are required.' })
    return
  }
  try {
    db.prepare(
      `
      INSERT INTO users (username, display_name, role, password_digest, active, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `,
    ).run(username, displayName, role, hashPassword(password, username), new Date().toISOString())
    res.status(201).json({ ok: true })
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed: users.username')) {
      res.status(409).json({ error: 'Username already exists.' })
      return
    }
    res.status(500).json({ error: 'Failed to create user.', details: String(error.message) })
  }
})

app.patch('/api/users/:userId', requireRoles(ROLE_USER_MANAGER), (req, res) => {
  const userId = Number(req.params.userId)
  if (!Number.isFinite(userId) || userId <= 0) {
    res.status(400).json({ error: 'Invalid userId.' })
    return
  }

  const fields = []
  const values = []
  if (req.body?.active !== undefined) {
    fields.push('active = ?')
    values.push(req.body.active ? 1 : 0)
  }
  if (req.body?.role !== undefined) {
    const role = String(req.body.role).trim().toLowerCase()
    if (!USER_ROLES.has(role)) {
      res.status(400).json({ error: 'Invalid role.' })
      return
    }
    fields.push('role = ?')
    values.push(role)
  }
  if (req.body?.displayName !== undefined) {
    const displayName = String(req.body.displayName ?? '').trim()
    if (!displayName) {
      res.status(400).json({ error: 'displayName cannot be empty.' })
      return
    }
    fields.push('display_name = ?')
    values.push(displayName)
  }
  if (req.body?.password !== undefined) {
    const password = String(req.body.password ?? '')
    if (!password) {
      res.status(400).json({ error: 'password cannot be empty.' })
      return
    }
    const usernameRow = db.prepare('SELECT username FROM users WHERE id = ?').get(userId)
    if (!usernameRow) {
      res.status(404).json({ error: 'User not found.' })
      return
    }
    fields.push('password_digest = ?')
    values.push(hashPassword(password, usernameRow.username))
  }
  if (fields.length === 0) {
    res.json({ ok: true })
    return
  }

  values.push(userId)
  try {
    const result = db
      .prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`)
      .run(...values)
    if (result.changes === 0) {
      res.status(404).json({ error: 'User not found.' })
      return
    }
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user.', details: String(error.message) })
  }
})

app.get('/api/reports/summary', requireRoles(ROLE_OPERATOR), (req, res) => {
  const from = req.query?.from ? String(req.query.from) : null
  const to = req.query?.to ? String(req.query.to) : null
  try {
    res.json(getReportSummary({ from, to }))
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

function sanitizeCategoryPayload(source) {
  const name = String(source.name ?? '').trim()
  if (!name) return { ok: false, error: 'Category name is required.' }

  const categoryIdSource = String(source.id ?? '').trim()
  const slugBase = slugifyCategoryId(categoryIdSource || name)
  if (!slugBase) return { ok: false, error: 'Category id is invalid.' }
  if (slugBase === 'all') return { ok: false, error: 'Category id "all" is reserved.' }

  return {
    ok: true,
    value: {
      id: slugBase,
      name,
    },
  }
}

function slugifyCategoryId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
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

function normalizeKhqrAmount(value, currency) {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount)) return Number.NaN
  if (currency === 'KHR') {
    return Math.round(amount)
  }
  return Number(amount.toFixed(2))
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

function handleKhqrGenerateRequest(req, res) {
  reloadEnvFromDotFile()
  const currency = sanitizeCurrency(req.body?.currency)
  const rawAmount = Number(req.body?.amount ?? 0)
  const amount = normalizeKhqrAmount(rawAmount, currency)
  const incomingBillNumber = String(req.body?.billNumber ?? '').trim()
  const billNumber = incomingBillNumber || createBillNumber()
  const accountID = readEnvValue(['BAKONG_ACCOUNT_ID', 'BAKONG_ACCOUNTID', 'accountID', 'accountId'])
  const merchantName = readEnvValue(['BAKONG_MERCHANT_NAME'], 'Bakehouse POS')
  const merchantCity = readEnvValue(['BAKONG_MERCHANT_CITY'], 'Phnom Penh')
  const merchantTag = readEnvValue(['BAKONG_MERCHANT_TAG'], 'INDIVIDUAL').toUpperCase()

  if (!accountID) {
    res.status(500).json({
      error: 'Bakong account id is missing. Set BAKONG_ACCOUNT_ID (or accountID/accountId) in .env or server environment.',
    })
    return
  }
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    res.status(400).json({ error: 'amount must be a positive number.' })
    return
  }

  const expiresAt = new Date(Date.now() + KHQR_EXPIRE_MS)
  const generation = KHQR.generate({
    tag: merchantTag === 'MERCHANT' ? TAG.MERCHANT : TAG.INDIVIDUAL,
    accountID,
    merchantName,
    merchantCity,
    currency: currency === 'KHR' ? KHQRCurrency.KHR : KHQRCurrency.USD,
    amount,
    expirationTimestamp: expiresAt.getTime(),
    additionalData: {
      billNumber,
      storeLabel: String(process.env.BAKONG_STORE_LABEL ?? 'Bakehouse'),
    },
  })

  if (!generation || Number(generation.status?.code ?? -1) !== 0 || !generation.data?.qr || !generation.data?.md5) {
    res.status(400).json({
      error: String(generation?.status?.message ?? 'Unable to generate KHQR payload.'),
      details: generation?.status ?? null,
    })
    return
  }

  try {
    createKhqrTransaction({
      billNumber,
      md5: generation.data.md5,
      qrString: generation.data.qr,
      amount,
      currency,
      status: 'UNPAID',
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed: khqr_transactions.bill_number')) {
      res.status(409).json({ error: `billNumber "${billNumber}" already exists.` })
      return
    }
    if (String(error.message).includes('UNIQUE constraint failed: khqr_transactions.md5')) {
      res.status(409).json({ error: 'Generated md5 is duplicated. Please retry.' })
      return
    }
    res.status(500).json({ error: 'Failed to store KHQR transaction.', details: String(error.message) })
    return
  }

  res.json({
    billNumber,
    qr: generation.data.qr,
    md5: generation.data.md5,
    amount,
    currency,
    merchantName,
    merchantCity,
    accountId: accountID,
    expiresAt: expiresAt.toISOString(),
  })
}

async function handleKhqrStatusRequest(req, res) {
  reloadEnvFromDotFile()
  const md5 = String(req.params.md5 ?? '').trim()
  if (!md5) {
    res.status(400).json({ error: 'md5 is required.' })
    return
  }
  const transaction = getKhqrTransactionByMd5(md5)
  if (!transaction) {
    res.status(404).json({ error: 'KHQR transaction not found.' })
    return
  }
  if (transaction.status === 'PAID') {
    res.json({
      paid: true,
      status: 'PAID',
      billNumber: transaction.billNumber,
      md5: transaction.md5,
      amount: transaction.amount,
      currency: transaction.currency,
      paidAt: transaction.paidAt,
    })
    return
  }

  const now = new Date()
  const expiresAt = new Date(transaction.expiresAt)
  if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime()) {
    updateKhqrTransactionStatus(md5, {
      status: 'EXPIRED',
      lastCheckedAt: now.toISOString(),
      checkResponseJson: transaction.checkResponseJson || '{}',
    })
    res.json({
      paid: false,
      status: 'EXPIRED',
      billNumber: transaction.billNumber,
      md5: transaction.md5,
      amount: transaction.amount,
      currency: transaction.currency,
      expired: true,
    })
    return
  }

  const token = readEnvValue(['BAKONG_TOKEN'])
  if (!token) {
    res.status(500).json({ error: 'BAKONG_TOKEN is missing in server environment.' })
    return
  }

  let rawStatus
  try {
    const response = await fetch(BAKONG_CHECK_BY_MD5_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ md5 }),
    })
    rawStatus = await response.json()
  } catch (error) {
    res.status(502).json({ error: 'Failed to reach Bakong status API.', details: String(error.message) })
    return
  }

  const responseCode = Number(rawStatus?.responseCode ?? rawStatus?.status?.code ?? -1)
  const paid = responseCode === 0
  const nextStatus = paid ? 'PAID' : 'UNPAID'
  const checkedAt = new Date().toISOString()
  updateKhqrTransactionStatus(md5, {
    status: nextStatus,
    paidAt: paid ? checkedAt : null,
    lastCheckedAt: checkedAt,
    checkResponseJson: safeJsonStringify(rawStatus),
  })

  res.json({
    paid,
    status: nextStatus,
    billNumber: transaction.billNumber,
    md5: transaction.md5,
    amount: transaction.amount,
    currency: transaction.currency,
    data: rawStatus,
  })
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

function parsePublicOnlineOrderPayload(source) {
  const customerName = String(source.customerName ?? '').trim()
  const phone = String(source.phone ?? '').trim()
  const address = String(source.address ?? '').trim()
  const note = String(source.note ?? '').trim()
  const khqrMd5 = String(source.khqrMd5 ?? '').trim()
  const selectedPaymentMethod = sanitizePaymentMethod(source.paymentMethod)
  if (!customerName) {
    return { ok: false, error: 'customerName is required.' }
  }
  if (!Array.isArray(source.items) || source.items.length === 0) {
    return { ok: false, error: 'At least one order item is required.' }
  }

  const groupedItems = new Map()
  for (const rawItem of source.items) {
    const productId = String(rawItem?.productId ?? '').trim()
    const quantity = Number(rawItem?.quantity ?? 0)
    if (!productId) return { ok: false, error: 'Each item requires productId.' }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false, error: `Invalid quantity for ${productId}.` }
    }
    groupedItems.set(productId, Number(groupedItems.get(productId) ?? 0) + Math.floor(quantity))
  }

  const findProduct = db.prepare(`
    SELECT id, name, base_price, stock_qty
    FROM products
    WHERE id = ?
  `)
  const settingsTaxRate = Number(
    db.prepare("SELECT value FROM settings WHERE key = 'taxRate' LIMIT 1").get()?.value ?? 10,
  )
  const taxRate = Number.isFinite(settingsTaxRate) ? Math.max(0, settingsTaxRate) / 100 : 0.1

  let subtotal = 0
  const items = []
  for (const [productId, quantity] of groupedItems.entries()) {
    const product = findProduct.get(productId)
    if (!product) {
      return { ok: false, error: `Product ${productId} not found.` }
    }
    const available = Number(product.stock_qty ?? 0)
    if (quantity > available + 0.000001) {
      return {
        ok: false,
        error: `Insufficient stock for ${product.name}. Available ${available}, requested ${quantity}.`,
      }
    }
    const itemPrice = Number(product.base_price ?? 0)
    const totalPrice = Number((itemPrice * quantity).toFixed(2))
    subtotal += totalPrice
    items.push({
      productId: String(product.id),
      productName: String(product.name),
      quantity,
      itemPrice,
      totalPrice,
      selectedOptions: {},
      notes: '',
    })
  }

  const normalizedSubtotal = Number(subtotal.toFixed(2))
  const tax = Number((normalizedSubtotal * taxRate).toFixed(2))
  const total = Number((normalizedSubtotal + tax).toFixed(2))
  const normalizedPhone = phone.replace(/\s+/g, ' ').slice(0, 30)
  const normalizedAddress = address.replace(/\s+/g, ' ').slice(0, 220)
  const firstItemNoteParts = []
  if (note) firstItemNoteParts.push(`Online note: ${note.slice(0, 120)}`)
  if (normalizedAddress) firstItemNoteParts.push(`Address: ${normalizedAddress}`)
  if (normalizedPhone) firstItemNoteParts.push(`Phone: ${normalizedPhone}`)
  if (items.length > 0 && firstItemNoteParts.length > 0) {
    items[0].notes = firstItemNoteParts.join(' | ').slice(0, 240)
  }

  let paymentStatus = 'Unpaid'
  let amountReceived = 0
  let changeAmount = 0
  if (selectedPaymentMethod === 'KHQR' && khqrMd5) {
    const khqrTransaction = getKhqrTransactionByMd5(khqrMd5)
    if (!khqrTransaction) {
      return { ok: false, error: 'KHQR transaction not found.' }
    }
    if (String(khqrTransaction.status ?? '').toUpperCase() !== 'PAID') {
      return { ok: false, error: 'KHQR payment is not completed yet.' }
    }
    const khqrAmount = Number(khqrTransaction.amount ?? 0)
    if (!Number.isFinite(khqrAmount) || Math.abs(khqrAmount - total) > 0.01) {
      return { ok: false, error: 'KHQR amount does not match order total.' }
    }
    paymentStatus = 'Paid'
    amountReceived = total
  }

  return {
    ok: true,
    value: {
      customerName: customerName.slice(0, 80),
      tableName: normalizedPhone ? `Delivery (${normalizedPhone})` : 'Delivery',
      orderType: 'Take Away',
      paymentMethod: selectedPaymentMethod,
      paymentStatus,
      currency: 'USD',
      paymentCurrency: 'USD',
      amountReceived,
      changeAmount,
      subtotal: normalizedSubtotal,
      tax,
      discount: 0,
      total,
      items,
    },
  }
}

function createSessionToken() {
  return randomBytes(24).toString('hex')
}

function createCustomerSession(customer) {
  const token = randomBytes(24).toString('hex')
  const expiresAt = Date.now() + CUSTOMER_SESSION_TTL_MS
  customerSessionStore.set(token, {
    token,
    customerId: Number(customer.id),
    fullName: String(customer.fullName ?? ''),
    email: String(customer.email ?? ''),
    phone: String(customer.phone ?? ''),
    expiresAt,
  })
  return { token, expiresAt }
}

function readCustomerSessionToken(req) {
  const explicitHeaderToken = String(req.headers?.['x-customer-session'] ?? '').trim()
  if (explicitHeaderToken) return explicitHeaderToken
  return readBearerToken(req.headers?.authorization)
}

function readCustomerSession(req) {
  const token = readCustomerSessionToken(req)
  if (!token) return null
  const session = customerSessionStore.get(token)
  if (!session) return null
  if (Date.now() > Number(session.expiresAt ?? 0)) {
    customerSessionStore.delete(token)
    return null
  }
  return session
}

function requireAuth(req, res, next) {
  const requestPath = String(req.path ?? '')
  if (requestPath.startsWith('/public/')) {
    next()
    return
  }

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

function hashPassword(password, username = '') {
  const pepper = process.env.POS_AUTH_PEPPER || 'tenant-pos-auth-pepper'
  const normalizedUsername = String(username ?? '').trim().toLowerCase()
  return createHash('sha256')
    .update(`${normalizedUsername}|${String(password ?? '')}|${pepper}`)
    .digest('hex')
}

function parseJsonObject(input) {
  if (!input) return {}
  try {
    const parsed = JSON.parse(input)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    return parsed
  } catch {
    return {}
  }
}

function createBillNumber() {
  const stamp = new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14)
  const random = randomBytes(3).toString('hex').toUpperCase()
  return `INV-${stamp}-${random}`
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value ?? {})
  } catch {
    return '{}'
  }
}

function readEnvValue(keys = [], fallback = '') {
  const safeKeys = Array.isArray(keys) ? keys : [keys]
  for (const key of safeKeys) {
    const envKey = String(key ?? '').trim()
    if (!envKey) continue
    const value = String(process.env[envKey] ?? '').trim()
    if (value) return value
  }
  return String(fallback ?? '').trim()
}

function reloadEnvFromDotFile(filePath = ENV_FILE_PATH) {
  let content = ''
  try {
    content = fs.readFileSync(filePath, 'utf8')
  } catch {
    return
  }
  const lines = content.split(/\r?\n/)
  lines.forEach((rawLine) => {
    const line = String(rawLine ?? '').trim()
    if (!line || line.startsWith('#')) return
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) return
    const key = String(match[1] ?? '').trim()
    if (!key) return
    process.env[key] = parseDotEnvValue(match[2] ?? '')
  })
}

function parseDotEnvValue(rawValue) {
  const value = String(rawValue ?? '').trim()
  if (!value) return ''
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  const commentIndex = value.indexOf(' #')
  const cleaned = commentIndex >= 0 ? value.slice(0, commentIndex) : value
  return cleaned.trim()
}
