import path from 'node:path'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { CATEGORY_SEED, ORDER_SEED, PRODUCT_SEED, TABLE_SEED } from './seeds.js'

const DB_PATH = path.resolve(process.cwd(), 'server', 'pos.sqlite')

export const db = new DatabaseSync(DB_PATH)

const ORDER_STATUSES = new Set(['Active', 'Closed', 'Done', 'Canceled'])
const PAYMENT_STATUSES = new Set(['Paid', 'Unpaid'])
const ORDER_TRANSITIONS = {
  Active: new Set(['Active', 'Closed', 'Done', 'Canceled']),
  Closed: new Set(['Closed', 'Done', 'Canceled']),
  Done: new Set(['Done']),
  Canceled: new Set(['Canceled']),
}
const AUTH_PEPPER = process.env.POS_AUTH_PEPPER || 'tenant-pos-auth-pepper'
const DEFAULT_USERS = [
  { username: 'manager', displayName: 'Store Manager', role: 'manager', password: 'manager123' },
  { username: 'cashier', displayName: 'Front Cashier', role: 'cashier', password: 'cashier123' },
]

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category_id TEXT NOT NULL,
    label TEXT NOT NULL,
    base_price REAL NOT NULL,
    stock_qty REAL NOT NULL DEFAULT 50,
    stock_threshold REAL NOT NULL DEFAULT 10,
    image TEXT NOT NULL,
    description TEXT NOT NULL,
    customizable INTEGER NOT NULL DEFAULT 0,
    options_json TEXT,
    FOREIGN KEY(category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS dining_tables (
    id TEXT PRIMARY KEY,
    group_title TEXT NOT NULL,
    guest_name TEXT NOT NULL,
    pax INTEGER NOT NULL DEFAULT 0,
    time_label TEXT NOT NULL,
    status TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    order_type TEXT NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    currency TEXT NOT NULL DEFAULT 'USD',
    payment_currency TEXT NOT NULL DEFAULT '',
    amount_received REAL NOT NULL DEFAULT 0,
    change_amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    kitchen_status TEXT NOT NULL,
    delivery_status TEXT DEFAULT 'pending',
    delivery_address TEXT DEFAULT '',
    delivery_phone TEXT DEFAULT '',
    delivery_note TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL UNIQUE,
    driver_name TEXT DEFAULT '',
    driver_phone TEXT DEFAULT '',
    assigned_at TEXT,
    picked_up_at TEXT,
    delivered_at TEXT,
    delivery_note TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_deliveries_order_id
    ON deliveries(order_id);

  CREATE INDEX IF NOT EXISTS idx_orders_delivery_status
    ON orders(delivery_status);

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    options_json TEXT,
    notes TEXT,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    order_id INTEGER,
    movement_type TEXT NOT NULL,
    quantity REAL NOT NULL,
    before_qty REAL NOT NULL,
    after_qty REAL NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id
    ON inventory_movements(product_id);

  CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at
    ON inventory_movements(created_at);

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    password_digest TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_users_role
    ON users(role);

  CREATE TABLE IF NOT EXISTS customer_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT NOT NULL DEFAULT '',
    password_digest TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    last_login_at TEXT
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_accounts_email
    ON customer_accounts(email)
    WHERE email IS NOT NULL AND email != '';

  CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_accounts_phone
    ON customer_accounts(phone)
    WHERE phone IS NOT NULL AND phone != '';

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS khqr_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_number TEXT NOT NULL UNIQUE,
    md5 TEXT NOT NULL UNIQUE,
    qr_string TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'UNPAID',
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    paid_at TEXT,
    last_checked_at TEXT,
    check_response_json TEXT NOT NULL DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_khqr_transactions_md5
    ON khqr_transactions(md5);

  CREATE INDEX IF NOT EXISTS idx_khqr_transactions_status
    ON khqr_transactions(status);
`)

ensureOrderColumns()
ensureProductColumns()
seedIfEmpty()
ensureOpeningInventoryMovements()
ensureDefaultUsers()
ensureLegacyAdminUsersAreManagers()
ensureDefaultSettings()
ensureCustomerAccountColumns()

function seedIfEmpty() {
  const categoryCount = db.prepare('SELECT COUNT(*) AS count FROM categories').get().count
  if (categoryCount > 0) {
    ensureCatalogSeedExists()
    return
  }

  const insertCategory = db.prepare('INSERT INTO categories (id, name) VALUES (?, ?)')
  CATEGORY_SEED.forEach((item) => {
    insertCategory.run(item.id, item.name)
  })

  const insertProduct = db.prepare(`
    INSERT INTO products (
      id, name, category_id, label, base_price, stock_qty, stock_threshold,
      image, description, customizable, options_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  PRODUCT_SEED.forEach((item) => {
    insertProduct.run(
      item.id,
      item.name,
      item.category,
      item.label,
      item.basePrice,
      Number.isFinite(Number(item.stockQty)) ? Number(item.stockQty) : 50,
      Number.isFinite(Number(item.stockThreshold)) ? Number(item.stockThreshold) : 10,
      item.image,
      item.description,
      item.customizable,
      item.options ? JSON.stringify(item.options) : null,
    )
  })

  const insertTable = db.prepare(`
    INSERT INTO dining_tables (id, group_title, guest_name, pax, time_label, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  TABLE_SEED.forEach((item) => {
    insertTable.run(item.id, item.groupTitle, item.guest, item.pax, item.time, item.status)
  })

  const insertOrder = db.prepare(`
    INSERT INTO orders (
      order_number, customer_name, table_name, order_type, payment_method, currency, payment_currency,
      amount_received, change_amount, status, payment_status, kitchen_status, created_at,
      subtotal, tax, discount, total
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (
      order_id, product_id, product_name, quantity, unit_price, total_price, options_json, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const findProductName = db.prepare('SELECT name FROM products WHERE id = ?')

  ORDER_SEED.forEach((order) => {
    const result = insertOrder.run(
      order.orderNumber,
      order.customerName,
      order.tableName,
      order.orderType,
      order.paymentMethod ?? 'Cash',
      order.currency ?? 'USD',
      order.paymentCurrency ?? order.currency ?? 'USD',
      order.amountReceived ?? order.total ?? 0,
      order.changeAmount ?? 0,
      order.status,
      order.paymentStatus,
      order.kitchenStatus,
      order.createdAt,
      order.subtotal,
      order.tax,
      0,
      order.total,
    )

    order.items.forEach((item) => {
      const product = findProductName.get(item.productId)
      insertOrderItem.run(
        Number(result.lastInsertRowid),
        item.productId,
        product?.name ?? item.productId,
        item.quantity,
        item.unitPrice,
        item.totalPrice,
        null,
        '',
      )
    })
  })
}

function ensureOrderColumns() {
  const columns = db.prepare('PRAGMA table_info(orders)').all()
  const hasPaymentMethod = columns.some((column) => column.name === 'payment_method')
  const hasCurrency = columns.some((column) => column.name === 'currency')
  const hasPaymentCurrency = columns.some((column) => column.name === 'payment_currency')
  const hasAmountReceived = columns.some((column) => column.name === 'amount_received')
  const hasChangeAmount = columns.some((column) => column.name === 'change_amount')
  if (!hasPaymentMethod) {
    db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'Cash'")
  }
  if (!hasCurrency) {
    db.exec("ALTER TABLE orders ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'")
  }
  if (!hasPaymentCurrency) {
    db.exec("ALTER TABLE orders ADD COLUMN payment_currency TEXT NOT NULL DEFAULT ''")
  }
  if (!hasAmountReceived) {
    db.exec('ALTER TABLE orders ADD COLUMN amount_received REAL NOT NULL DEFAULT 0')
  }
  if (!hasChangeAmount) {
    db.exec('ALTER TABLE orders ADD COLUMN change_amount REAL NOT NULL DEFAULT 0')
  }
  db.exec("UPDATE orders SET payment_currency = currency WHERE payment_currency IS NULL OR payment_currency = ''")
}

function ensureProductColumns() {
  const columns = db.prepare('PRAGMA table_info(products)').all()
  const hasStockQty = columns.some((column) => column.name === 'stock_qty')
  const hasStockThreshold = columns.some((column) => column.name === 'stock_threshold')
  if (!hasStockQty) {
    db.exec('ALTER TABLE products ADD COLUMN stock_qty REAL NOT NULL DEFAULT 50')
  }
  if (!hasStockThreshold) {
    db.exec('ALTER TABLE products ADD COLUMN stock_threshold REAL NOT NULL DEFAULT 10')
  }
}

function ensureCustomerAccountColumns() {
  const columns = db.prepare('PRAGMA table_info(customer_accounts)').all()
  if (columns.length === 0) return
  const hasAddress = columns.some((column) => column.name === 'address')
  if (!hasAddress) {
    db.exec("ALTER TABLE customer_accounts ADD COLUMN address TEXT NOT NULL DEFAULT ''")
  }
}

function ensureCatalogSeedExists() {
  const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)')
  CATEGORY_SEED.forEach((item) => {
    insertCategory.run(item.id, item.name)
  })

  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (
      id, name, category_id, label, base_price, stock_qty, stock_threshold,
      image, description, customizable, options_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  PRODUCT_SEED.forEach((item) => {
    insertProduct.run(
      item.id,
      item.name,
      item.category,
      item.label,
      item.basePrice,
      Number.isFinite(Number(item.stockQty)) ? Number(item.stockQty) : 50,
      Number.isFinite(Number(item.stockThreshold)) ? Number(item.stockThreshold) : 10,
      item.image,
      item.description,
      item.customizable,
      item.options ? JSON.stringify(item.options) : null,
    )
  })
}

function ensureOpeningInventoryMovements() {
  const movementCount = Number(
    db.prepare('SELECT COUNT(*) AS count FROM inventory_movements').get()?.count ?? 0,
  )
  if (movementCount > 0) return
  const products = db
    .prepare(
      `
      SELECT id, name, stock_qty
      FROM products
      ORDER BY id
    `,
    )
    .all()
  if (products.length === 0) return
  const insertMovement = db.prepare(`
    INSERT INTO inventory_movements (
      product_id, order_id, movement_type, quantity, before_qty, after_qty, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const now = new Date().toISOString()
  products.forEach((product) => {
    const qty = Number(product.stock_qty ?? 0)
    insertMovement.run(
      product.id,
      null,
      'opening',
      qty,
      0,
      qty,
      `Opening stock balance (${product.name ?? product.id})`,
      now,
    )
  })
}

function mapProductRow(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    label: row.label,
    basePrice: row.basePrice,
    stockQty: Number(row.stockQty ?? 0),
    stockThreshold: Number(row.stockThreshold ?? 0),
    image: row.image,
    description: row.description,
    customizable: Boolean(row.customizable),
    options: row.options_json ? JSON.parse(row.options_json) : undefined,
  }
}

function mapInventoryMovementRow(row) {
  return {
    id: Number(row.id),
    productId: row.product_id,
    productName: row.product_name ?? row.product_id,
    orderId: row.order_id == null ? null : Number(row.order_id),
    orderNumber: row.order_number ?? null,
    movementType: String(row.movement_type ?? 'adjustment'),
    quantity: Number(row.quantity ?? 0),
    beforeQty: Number(row.before_qty ?? 0),
    afterQty: Number(row.after_qty ?? 0),
    note: row.note ?? '',
    createdAt: row.created_at,
  }
}

function mapUserRow(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    active: Boolean(row.active),
  }
}

function mapCustomerAccountRow(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    fullName: row.full_name,
    email: row.email || '',
    phone: row.phone || '',
    address: row.address || '',
    active: Boolean(row.active),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at ?? null,
  }
}

export function getProductCatalog() {
  const categories = db
    .prepare(
      `
      SELECT id, name
      FROM categories
      WHERE id != 'all'
      ORDER BY id
    `,
    )
    .all()

  const products = db
    .prepare(
      `
      SELECT
        id, name, category_id AS category, label, base_price AS basePrice,
        stock_qty AS stockQty, stock_threshold AS stockThreshold,
        image, description, customizable, options_json
      FROM products
      ORDER BY name
    `,
    )
    .all()
    .map((row) => mapProductRow(row))

  return { categories, products }
}

export function getCatalogSnapshot() {
  const products = db
    .prepare(
      `
      SELECT
        id, name, category_id AS category, label, base_price AS basePrice,
        stock_qty AS stockQty, stock_threshold AS stockThreshold,
        image, description, customizable, options_json
      FROM products
      ORDER BY id
    `,
    )
    .all()
    .map((row) => mapProductRow(row))

  const categories = db
    .prepare(
      `
      SELECT c.id, c.name, COUNT(p.id) AS count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id, c.name
      ORDER BY c.id
    `,
    )
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      count: row.id === 'all' ? products.length : Number(row.count),
    }))

  return { categories, products }
}

export function getProductById(productId) {
  const row = db
    .prepare(
      `
      SELECT
        id, name, category_id AS category, label, base_price AS basePrice,
        stock_qty AS stockQty, stock_threshold AS stockThreshold,
        image, description, customizable, options_json
      FROM products
      WHERE id = ?
    `,
    )
    .get(productId)
  if (!row) return null
  return mapProductRow(row)
}

export function getInventoryMovements(limit = 80) {
  const safeLimit = Number.isFinite(Number(limit))
    ? Math.min(300, Math.max(1, Math.floor(Number(limit))))
    : 80
  return db
    .prepare(
      `
      SELECT
        im.id,
        im.product_id,
        p.name AS product_name,
        im.order_id,
        o.order_number,
        im.movement_type,
        im.quantity,
        im.before_qty,
        im.after_qty,
        im.note,
        im.created_at
      FROM inventory_movements im
      LEFT JOIN products p ON p.id = im.product_id
      LEFT JOIN orders o ON o.id = im.order_id
      ORDER BY datetime(im.created_at) DESC, im.id DESC
      LIMIT ?
    `,
    )
    .all(safeLimit)
    .map((row) => mapInventoryMovementRow(row))
}

export function getUserByUsername(username) {
  const normalized = String(username ?? '').trim().toLowerCase()
  if (!normalized) return null
  const row = db
    .prepare(
      `
      SELECT id, username, display_name, role, active
      FROM users
      WHERE LOWER(username) = ?
      LIMIT 1
    `,
    )
    .get(normalized)
  return mapUserRow(row)
}

export function verifyUserCredentials(username, password) {
  const normalized = String(username ?? '').trim().toLowerCase()
  if (!normalized) return null
  const row = db
    .prepare(
      `
      SELECT id, username, display_name, role, active, password_digest
      FROM users
      WHERE LOWER(username) = ?
      LIMIT 1
    `,
    )
    .get(normalized)
  if (!row || !row.active) return null
  const digest = hashPassword(password, row.username)
  if (digest !== row.password_digest) return null
  return mapUserRow(row)
}

export function getCustomerAccountById(id) {
  const numericId = Number(id)
  if (!Number.isFinite(numericId) || numericId <= 0) return null
  const row = db
    .prepare(
      `
      SELECT id, full_name, email, phone, active, created_at, last_login_at
           , address
      FROM customer_accounts
      WHERE id = ?
      LIMIT 1
    `,
    )
    .get(Math.floor(numericId))
  return mapCustomerAccountRow(row)
}

export function createCustomerAccount(payload) {
  const fullName = String(payload?.fullName ?? '').trim()
  const email = normalizeCustomerEmail(payload?.email)
  const phone = normalizeCustomerPhone(payload?.phone)
  const address = String(payload?.address ?? '').trim().slice(0, 300)
  const password = String(payload?.password ?? '')
  if (!fullName) {
    throw createDomainError('CUSTOMER_NAME_REQUIRED', 'fullName is required.')
  }
  if (!email && !phone) {
    throw createDomainError('CUSTOMER_CONTACT_REQUIRED', 'email or phone is required.')
  }
  if (password.length < 6) {
    throw createDomainError('CUSTOMER_PASSWORD_TOO_SHORT', 'Password must be at least 6 characters.')
  }
  const createdAt = new Date().toISOString()
  const identity = email || phone
  try {
    const result = db
      .prepare(
        `
        INSERT INTO customer_accounts (
          full_name, email, phone, address, password_digest, active, created_at
        ) VALUES (?, ?, ?, ?, ?, 1, ?)
      `,
      )
      .run(
        fullName.slice(0, 80),
        email || null,
        phone || null,
        address,
        hashCustomerPassword(password, identity),
        createdAt,
      )
    return getCustomerAccountById(Number(result.lastInsertRowid))
  } catch (error) {
    const message = String(error?.message ?? '')
    if (message.includes('idx_customer_accounts_email') || message.includes('customer_accounts.email')) {
      throw createDomainError('CUSTOMER_EMAIL_EXISTS', 'Email is already registered.')
    }
    if (message.includes('idx_customer_accounts_phone') || message.includes('customer_accounts.phone')) {
      throw createDomainError('CUSTOMER_PHONE_EXISTS', 'Phone number is already registered.')
    }
    throw error
  }
}

export function verifyCustomerCredentials(login, password) {
  const normalizedEmail = normalizeCustomerEmail(login)
  const normalizedPhone = normalizeCustomerPhone(login)
  if (!normalizedEmail && !normalizedPhone) return null
  const row = db
    .prepare(
      `
      SELECT id, full_name, email, phone, active, created_at, last_login_at, password_digest
           , address
      FROM customer_accounts
      WHERE (LOWER(email) = ? AND ? != '')
         OR (phone = ? AND ? != '')
      LIMIT 1
    `,
    )
    .get(normalizedEmail, normalizedEmail, normalizedPhone, normalizedPhone)
  if (!row || !row.active) return null
  const identity = normalizedEmail || normalizedPhone
  const digest = hashCustomerPassword(password, identity)
  if (digest !== row.password_digest) return null
  const now = new Date().toISOString()
  db.prepare('UPDATE customer_accounts SET last_login_at = ? WHERE id = ?').run(now, row.id)
  return {
    ...mapCustomerAccountRow({
      ...row,
      last_login_at: now,
    }),
  }
}

export function updateCustomerAccount(customerId, payload) {
  const existing = getCustomerAccountById(customerId)
  if (!existing) return null

  const nextFullName = String(payload?.fullName ?? existing.fullName).trim().slice(0, 80)
  const nextEmail = normalizeCustomerEmail(payload?.email ?? existing.email)
  const nextPhone = normalizeCustomerPhone(payload?.phone ?? existing.phone)
  const nextAddress = String(payload?.address ?? existing.address ?? '').trim().slice(0, 300)
  if (!nextFullName) {
    throw createDomainError('CUSTOMER_NAME_REQUIRED', 'fullName is required.')
  }
  if (!nextEmail && !nextPhone) {
    throw createDomainError('CUSTOMER_CONTACT_REQUIRED', 'email or phone is required.')
  }

  try {
    db.prepare(
      `
      UPDATE customer_accounts
      SET full_name = ?, email = ?, phone = ?, address = ?
      WHERE id = ?
    `,
    ).run(nextFullName, nextEmail || null, nextPhone || null, nextAddress, Number(customerId))
  } catch (error) {
    const message = String(error?.message ?? '')
    if (message.includes('idx_customer_accounts_email') || message.includes('customer_accounts.email')) {
      throw createDomainError('CUSTOMER_EMAIL_EXISTS', 'Email is already registered.')
    }
    if (message.includes('idx_customer_accounts_phone') || message.includes('customer_accounts.phone')) {
      throw createDomainError('CUSTOMER_PHONE_EXISTS', 'Phone number is already registered.')
    }
    throw error
  }

  return getCustomerAccountById(customerId)
}

export function createProduct(payload) {
  const nextId =
    String(payload.id ?? '').trim() ||
    `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

  db.prepare(
    `
    INSERT INTO products (
      id, name, category_id, label, base_price, stock_qty, stock_threshold,
      image, description, customizable, options_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    nextId,
    payload.name,
    payload.category,
    payload.label,
    payload.basePrice,
    payload.stockQty ?? 50,
    payload.stockThreshold ?? 10,
    payload.image,
    payload.description,
    payload.customizable ? 1 : 0,
    payload.options ? JSON.stringify(payload.options) : null,
  )

  return getProductById(nextId)
}

export function createCategory(payload) {
  db.prepare(
    `
    INSERT INTO categories (id, name)
    VALUES (?, ?)
  `,
  ).run(payload.id, payload.name)

  return db.prepare('SELECT id, name FROM categories WHERE id = ?').get(payload.id)
}

export function updateProduct(productId, payload) {
  const existing = db.prepare('SELECT id, stock_qty, name FROM products WHERE id = ?').get(productId)
  if (!existing) return false

  const nextStockQty = Number(payload.stockQty ?? 50)
  const beforeQty = Number(existing.stock_qty ?? 0)
  const stockDiff = nextStockQty - beforeQty
  const insertMovement = db.prepare(`
    INSERT INTO inventory_movements (
      product_id, order_id, movement_type, quantity, before_qty, after_qty, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  db.exec('BEGIN IMMEDIATE TRANSACTION')
  try {
    const result = db
      .prepare(
        `
        UPDATE products
        SET
          name = ?,
          category_id = ?,
          label = ?,
          base_price = ?,
          stock_qty = ?,
          stock_threshold = ?,
          image = ?,
          description = ?,
          customizable = ?,
          options_json = ?
        WHERE id = ?
      `,
      )
      .run(
        payload.name,
        payload.category,
        payload.label,
        payload.basePrice,
        nextStockQty,
        payload.stockThreshold ?? 10,
        payload.image,
        payload.description,
        payload.customizable ? 1 : 0,
        payload.options ? JSON.stringify(payload.options) : null,
        productId,
      )
    if (result.changes > 0 && Math.abs(stockDiff) > 0.000001) {
      insertMovement.run(
        productId,
        null,
        'adjustment',
        stockDiff,
        beforeQty,
        nextStockQty,
        String(payload.stockNote ?? `Manual stock adjustment (${existing.name ?? productId})`),
        new Date().toISOString(),
      )
    }
    db.exec('COMMIT')
    return result.changes > 0
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function deleteProduct(productId) {
  const normalizedId = String(productId ?? '').trim()
  if (!normalizedId) return false

  const existing = db.prepare('SELECT id FROM products WHERE id = ? LIMIT 1').get(normalizedId)
  if (!existing) return false

  const movementCount = Number(
    db.prepare('SELECT COUNT(*) AS count FROM inventory_movements WHERE product_id = ?').get(normalizedId)?.count ?? 0,
  )
  if (movementCount > 0) {
    throw createDomainError(
      'PRODUCT_HAS_MOVEMENTS',
      'Cannot delete product with inventory history. Keep it for audit and set stock to 0 instead.',
    )
  }

  const result = db.prepare('DELETE FROM products WHERE id = ?').run(normalizedId)
  return result.changes > 0
}

export function getBootstrapData() {
  const { categories, products } = getCatalogSnapshot()

  const billingQueue = db
    .prepare(`
      SELECT order_number AS "order", customer_name AS customer, table_name AS "table",
             subtotal AS amount, LOWER(status) AS status, created_at, payment_method, currency,
             payment_currency, amount_received, change_amount
      FROM orders
      WHERE status IN ('Active', 'Closed')
      ORDER BY datetime(created_at) DESC
      LIMIT 20
    `)
    .all()
    .map((row, index) => ({
      id: `q${index + 1}`,
      customer: row.customer,
      order: row.order,
      table: row.table,
      amount: Number(row.amount.toFixed(2)),
      status: row.status,
      time: formatClock(new Date(row.created_at)),
      paymentMethod: row.payment_method,
      currency: row.currency,
      paymentCurrency: row.payment_currency || row.currency,
      amountReceived: Number(row.amount_received ?? 0),
      changeAmount: Number(row.change_amount ?? 0),
    }))

  const trackingOrders = db
    .prepare(`
      SELECT order_number, customer_name, kitchen_status, table_name, order_type, created_at,
             payment_method, currency, payment_currency, amount_received, change_amount
      FROM orders
      WHERE status IN ('Active', 'Closed')
      ORDER BY datetime(created_at) DESC
      LIMIT 8
    `)
    .all()
    .map((row) => ({
      id: row.order_number.replace('#', 't'),
      name: row.customer_name,
      status: row.kitchen_status,
      table: row.table_name,
      type: row.order_type,
      time: formatClock(new Date(row.created_at)),
      paymentMethod: row.payment_method,
      currency: row.currency,
      paymentCurrency: row.payment_currency || row.currency,
      amountReceived: Number(row.amount_received ?? 0),
      changeAmount: Number(row.change_amount ?? 0),
    }))

  const tableRows = db
    .prepare(
      `SELECT id, group_title AS groupTitle, guest_name AS guest, pax, time_label AS time, status
       FROM dining_tables
       ORDER BY id`,
    )
    .all()
  const tableMap = new Map()
  tableRows.forEach((row) => {
    if (!tableMap.has(row.groupTitle)) {
      tableMap.set(row.groupTitle, [])
    }
    tableMap.get(row.groupTitle).push({
      id: row.id,
      guest: row.guest,
      pax: row.pax,
      time: row.time,
      status: row.status,
    })
  })
  const tableGroups = Array.from(tableMap.entries()).map(([title, tables]) => ({ title, tables }))

  const historyRows = db
    .prepare(`
      SELECT order_number, created_at, customer_name, status, subtotal, payment_status, currency
      FROM orders
      WHERE status IN ('Closed', 'Done', 'Canceled')
      ORDER BY datetime(created_at) DESC
      LIMIT 60
    `)
    .all()
    .map((row) => ({
      id: row.order_number.replace('#', ''),
      at: formatLegacyDate(new Date(row.created_at)),
      customer: row.customer_name,
      status: row.status,
      payment: Number(row.subtotal.toFixed(2)),
      paid: row.payment_status === 'Paid',
      currency: row.currency,
    }))

  const reportOrderRows = db
    .prepare(`
      SELECT order_number, created_at, customer_name, status, subtotal, payment_status, currency,
             payment_method, payment_currency, amount_received, change_amount
      FROM orders
      ORDER BY datetime(created_at) DESC
      LIMIT 30
    `)
    .all()
    .map((row) => ({
      id: row.order_number.replace('#', ''),
      date: formatLegacyDate(new Date(row.created_at)),
      customer: row.customer_name,
      state: row.status,
      payment: Number(row.subtotal.toFixed(2)),
      paymentState: row.payment_status,
      currency: row.currency,
      paymentMethod: row.payment_method,
      paymentCurrency: row.payment_currency || row.currency,
      amountReceived: Number(row.amount_received ?? 0),
      changeAmount: Number(row.change_amount ?? 0),
    }))

  const favorites = db
    .prepare(`
      SELECT
        oi.product_id AS id,
        oi.product_name AS name,
        p.label AS category,
        p.image AS image,
        SUM(oi.quantity) AS orderCount
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      GROUP BY oi.product_id, oi.product_name, p.label, p.image
      ORDER BY orderCount DESC
      LIMIT 8
    `)
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      image: row.image,
      orderCount: row.orderCount,
    }))
  const inventoryMovements = getInventoryMovements(80)

  return {
    categories,
    products,
    trackingOrders,
    billingQueue,
    tableGroups,
    historyRows,
    favorites,
    reportOrderRows,
    inventoryMovements,
  }
}

export function createOrder(payload) {
  const nextOrderNumber = getNextOrderNumber()
  const initialStatus = String(payload?.status ?? 'Active').trim() || 'Active'
  const initialKitchenStatus =
    initialStatus === 'Closed' || initialStatus === 'Done'
      ? 'All Done'
      : initialStatus === 'Canceled'
        ? 'Canceled'
        : 'On Kitchen Hand'
  const findProductStock = db.prepare('SELECT id, name, stock_qty FROM products WHERE id = ?')
  const deductStock = db.prepare(`
    UPDATE products
    SET stock_qty = stock_qty - ?
    WHERE id = ?
  `)

  const insertOrder = db.prepare(`
    INSERT INTO orders (
      order_number, customer_name, table_name, order_type, payment_method, currency, payment_currency,
      amount_received, change_amount, status, payment_status, kitchen_status, created_at,
      subtotal, tax, discount, total
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (
      order_id, product_id, product_name, quantity, unit_price, total_price, options_json, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertMovement = db.prepare(`
    INSERT INTO inventory_movements (
      product_id, order_id, movement_type, quantity, before_qty, after_qty, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  db.exec('BEGIN IMMEDIATE TRANSACTION')
  try {
    const stockChecks = payload.items.map((item) => {
      const quantityRequested = Number(item.quantity ?? 0)
      const product = findProductStock.get(item.productId)
      if (!product) {
        throw createDomainError('PRODUCT_NOT_FOUND', `Product ${item.productId} not found.`)
      }
      const available = Number(product.stock_qty ?? 0)
      if (quantityRequested > available + 0.000001) {
        throw createDomainError(
          'INSUFFICIENT_STOCK',
          `Insufficient stock for ${product.name}. Available ${available}, requested ${quantityRequested}.`,
        )
      }
      return {
        productId: item.productId,
        quantityRequested,
        beforeQty: available,
        afterQty: Math.max(0, available - quantityRequested),
        productName: String(product.name ?? item.productId),
      }
    })
    const createdAtIso = new Date().toISOString()

    const insertOrderResult = insertOrder.run(
      nextOrderNumber,
      payload.customerName,
      payload.tableName,
      payload.orderType,
      payload.paymentMethod ?? 'Cash',
      payload.currency ?? 'USD',
      payload.paymentCurrency ?? payload.currency ?? 'USD',
      payload.amountReceived ?? payload.total ?? 0,
      payload.changeAmount ?? 0,
      initialStatus,
      payload.paymentStatus ?? 'Unpaid',
      initialKitchenStatus,
      createdAtIso,
      payload.subtotal,
      payload.tax,
      payload.discount,
      payload.total,
    )
    const orderId = Number(insertOrderResult.lastInsertRowid)

    payload.items.forEach((item) => {
      insertOrderItem.run(
        orderId,
        item.productId,
        item.productName,
        item.quantity,
        item.itemPrice,
        item.totalPrice,
        JSON.stringify(item.selectedOptions ?? {}),
        item.notes ?? '',
      )
    })

    stockChecks.forEach((item) => {
      deductStock.run(item.quantityRequested, item.productId)
      insertMovement.run(
        item.productId,
        orderId,
        'sale',
        -item.quantityRequested,
        item.beforeQty,
        item.afterQty,
        `Order ${nextOrderNumber} (${item.productName})`,
        createdAtIso,
      )
    })

    db.exec('COMMIT')
    return { orderId, orderNumber: nextOrderNumber }
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function updateOrderStatus(orderNumber, status, paymentStatus) {
  const normalizedStatus = String(status ?? '').trim()
  const normalizedPaymentStatus = paymentStatus == null ? null : String(paymentStatus).trim()
  if (!ORDER_STATUSES.has(normalizedStatus)) {
    throw createDomainError('INVALID_ORDER_STATUS', `Invalid order status: ${normalizedStatus || 'unknown'}.`)
  }
  if (normalizedPaymentStatus !== null && !PAYMENT_STATUSES.has(normalizedPaymentStatus)) {
    throw createDomainError(
      'INVALID_PAYMENT_STATUS',
      `Invalid payment status: ${normalizedPaymentStatus || 'unknown'}.`,
    )
  }
  const currentOrder = db
    .prepare(
      `
      SELECT status, payment_status
      FROM orders
      WHERE order_number = ?
    `,
    )
    .get(orderNumber)
  if (!currentOrder) {
    throw createDomainError('ORDER_NOT_FOUND', 'Order not found.')
  }
  const currentStatus = String(currentOrder.status ?? '')
  const transitionSet = ORDER_TRANSITIONS[currentStatus] ?? new Set([currentStatus])
  if (!transitionSet.has(normalizedStatus)) {
    throw createDomainError(
      'INVALID_ORDER_TRANSITION',
      `Cannot move order from ${currentStatus} to ${normalizedStatus}.`,
    )
  }
  const resolvedPaymentStatus = normalizedPaymentStatus ?? String(currentOrder.payment_status ?? 'Unpaid')
  if ((normalizedStatus === 'Closed' || normalizedStatus === 'Done') && resolvedPaymentStatus !== 'Paid') {
    throw createDomainError(
      'PAYMENT_REQUIRED',
      `Order must be Paid before changing status to ${normalizedStatus}.`,
    )
  }

  if (normalizedStatus === 'Canceled' && currentStatus !== 'Canceled') {
    const orderRow = db
      .prepare(
        `
        SELECT id
        FROM orders
        WHERE order_number = ?
      `,
      )
      .get(orderNumber)
    if (!orderRow?.id) {
      throw createDomainError('ORDER_NOT_FOUND', 'Order not found.')
    }

    const orderItems = db
      .prepare(
        `
        SELECT product_id, product_name, quantity
        FROM order_items
        WHERE order_id = ?
      `,
      )
      .all(orderRow.id)

    const findProductStock = db.prepare('SELECT stock_qty FROM products WHERE id = ?')
    const restoreStock = db.prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?')
    const insertMovement = db.prepare(`
      INSERT INTO inventory_movements (
        product_id, order_id, movement_type, quantity, before_qty, after_qty, note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const updateCanceledOrder = db.prepare(`
      UPDATE orders
      SET
        status = ?,
        payment_status = COALESCE(?, payment_status),
        kitchen_status = 'Canceled'
      WHERE order_number = ?
    `)

    db.exec('BEGIN IMMEDIATE TRANSACTION')
    try {
      const now = new Date().toISOString()
      orderItems.forEach((item) => {
        const product = findProductStock.get(item.product_id)
        if (!product) return
        const beforeQty = Number(product.stock_qty ?? 0)
        const quantity = Number(item.quantity ?? 0)
        const afterQty = beforeQty + quantity
        restoreStock.run(quantity, item.product_id)
        insertMovement.run(
          item.product_id,
          orderRow.id,
          'adjustment',
          quantity,
          beforeQty,
          afterQty,
          `Order ${orderNumber} canceled - stock restored (${item.product_name})`,
          now,
        )
      })

      const result = updateCanceledOrder.run('Canceled', normalizedPaymentStatus, orderNumber)
      db.exec('COMMIT')
      return result.changes > 0
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  const update = db.prepare(`
    UPDATE orders
    SET
      status = ?,
      payment_status = COALESCE(?, payment_status),
      kitchen_status = CASE
        WHEN ? = 'Active' THEN 'On Kitchen Hand'
        WHEN ? = 'Closed' THEN 'All Done'
        WHEN ? = 'Done' THEN 'All Done'
        WHEN ? = 'Canceled' THEN 'Canceled'
        ELSE kitchen_status
      END
    WHERE order_number = ?
  `)
  const result = update.run(
    normalizedStatus,
    normalizedPaymentStatus,
    normalizedStatus,
    normalizedStatus,
    normalizedStatus,
    normalizedStatus,
    orderNumber,
  )
  return result.changes > 0
}

export function getReportSummary({ from = null, to = null } = {}) {
  const conditions = []
  const params = []
  if (from) {
    conditions.push('date(created_at) >= date(?)')
    params.push(from)
  }
  if (to) {
    conditions.push('date(created_at) <= date(?)')
    params.push(to)
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const metrics = db.prepare(`
    SELECT
      COALESCE(SUM(
        CASE
          WHEN currency = 'KHR' THEN total / 4100.0
          ELSE total
        END
      ), 0) AS totalSales,
      COALESCE(SUM(CASE WHEN status != 'Canceled' THEN 1 ELSE 0 END), 0) AS totalOrders,
      COUNT(DISTINCT customer_name) AS totalCustomers,
      COALESCE(SUM(
        CASE
          WHEN currency = 'KHR' THEN (total - tax) / 4100.0
          ELSE (total - tax)
        END
      ), 0) AS netProfit
    FROM orders
    ${whereClause}
  `).get(...params)

  return {
    totalSales: Number(metrics.totalSales.toFixed(2)),
    totalOrders: metrics.totalOrders,
    totalCustomers: metrics.totalCustomers,
    netProfit: Number(metrics.netProfit.toFixed(2)),
  }
}

export function createKhqrTransaction(payload) {
  const now = new Date().toISOString()
  const createdAt = String(payload.createdAt ?? now)
  db.prepare(
    `
    INSERT INTO khqr_transactions (
      bill_number,
      md5,
      qr_string,
      amount,
      currency,
      status,
      created_at,
      expires_at,
      check_response_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    String(payload.billNumber),
    String(payload.md5),
    String(payload.qrString),
    Number(payload.amount ?? 0),
    String(payload.currency ?? 'USD'),
    String(payload.status ?? 'UNPAID'),
    createdAt,
    String(payload.expiresAt),
    payload.checkResponseJson ? String(payload.checkResponseJson) : '',
  )
}

export function getKhqrTransactionByMd5(md5) {
  const row = db
    .prepare(
      `
      SELECT
        id,
        bill_number,
        md5,
        qr_string,
        amount,
        currency,
        status,
        created_at,
        expires_at,
        paid_at,
        last_checked_at,
        check_response_json
      FROM khqr_transactions
      WHERE md5 = ?
      LIMIT 1
    `,
    )
    .get(String(md5))
  if (!row) return null
  return {
    id: Number(row.id),
    billNumber: row.bill_number,
    md5: row.md5,
    qrString: row.qr_string,
    amount: Number(row.amount ?? 0),
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    paidAt: row.paid_at ?? null,
    lastCheckedAt: row.last_checked_at ?? null,
    checkResponseJson: row.check_response_json ?? '',
  }
}

export function updateKhqrTransactionStatus(md5, payload) {
  const status = String(payload.status ?? 'UNPAID')
  const paidAt = payload.paidAt == null ? null : String(payload.paidAt)
  const lastCheckedAt = payload.lastCheckedAt == null ? null : String(payload.lastCheckedAt)
  const responseJson = payload.checkResponseJson == null ? '' : String(payload.checkResponseJson)
  const result = db
    .prepare(
      `
      UPDATE khqr_transactions
      SET
        status = ?,
        paid_at = COALESCE(?, paid_at),
        last_checked_at = ?,
        check_response_json = ?
      WHERE md5 = ?
    `,
    )
    .run(status, paidAt, lastCheckedAt, responseJson, String(md5))
  return result.changes > 0
}

// Delivery Management Functions
export function getDeliveryQueue(limit = 50) {
  const rows = db
    .prepare(`
      SELECT
        o.id,
        o.order_number,
        o.customer_name,
        o.delivery_address,
        o.delivery_phone,
        o.delivery_note,
        o.status,
        o.kitchen_status,
        o.delivery_status,
        o.created_at,
        d.id as delivery_id,
        d.driver_name,
        d.driver_phone,
        d.assigned_at,
        d.picked_up_at,
        d.delivered_at
      FROM orders o
      LEFT JOIN deliveries d ON o.id = d.order_id
      WHERE o.order_type = 'Delivery'
      ORDER BY o.created_at DESC
      LIMIT ?
    `)
    .all(limit)
  return rows.map((row) => ({
    ...row,
    created_at: row.created_at ? row.created_at : '',
  }))
}

export function assignDriver(orderId, driverName, driverPhone) {
  const safeDriverName = String(driverName ?? '').trim()
  const safeDriverPhone = String(driverPhone ?? '').trim()
  const assignedAt = new Date().toISOString()

  const existingDelivery = db
    .prepare('SELECT id FROM deliveries WHERE order_id = ?')
    .get(orderId)

  if (existingDelivery) {
    const result = db
      .prepare(`
        UPDATE deliveries
        SET driver_name = ?, driver_phone = ?, assigned_at = ?
        WHERE order_id = ?
      `)
      .run(safeDriverName, safeDriverPhone, assignedAt, orderId)
    return result.changes > 0
  } else {
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO deliveries (
        order_id, driver_name, driver_phone, assigned_at, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `).run(orderId, safeDriverName, safeDriverPhone, assignedAt, now)
    return true
  }
}

export function updateDeliveryStatus(orderId, deliveryStatus) {
  const validStatuses = new Set([
    'pending',
    'ready_for_delivery',
    'out_for_delivery',
    'delivered',
  ])
  const safeStatus = String(deliveryStatus ?? 'pending').trim()

  if (!validStatuses.has(safeStatus)) {
    throw createDomainError('INVALID_DELIVERY_STATUS', `Invalid delivery status: ${safeStatus}`)
  }

  const updates = {
    picked_up_at:
      safeStatus === 'out_for_delivery' ? new Date().toISOString() : null,
    delivered_at:
      safeStatus === 'delivered' ? new Date().toISOString() : null,
  }

  const result = db
    .prepare(`
      UPDATE orders SET delivery_status = ? WHERE id = ?
    `)
    .run(safeStatus, orderId)

  if (safeStatus !== 'pending') {
    db.prepare(`
      UPDATE deliveries
      SET
        picked_up_at = COALESCE(?, picked_up_at),
        delivered_at = COALESCE(?, delivered_at)
      WHERE order_id = ?
    `).run(updates.picked_up_at, updates.delivered_at, orderId)
  }

  return result.changes > 0
}

export function getOrderById(orderId) {
  const row = db
    .prepare(`
      SELECT
        id,
        order_number,
        customer_name,
        table_name,
        order_type,
        payment_method,
        status,
        payment_status,
        kitchen_status,
        delivery_status,
        delivery_address,
        delivery_phone,
        delivery_note,
        created_at,
        subtotal,
        tax,
        discount,
        total
      FROM orders
      WHERE id = ?
    `)
    .get(orderId)
  return row || null
}

function getNextOrderNumber() {
  const row = db
    .prepare(
      `
      SELECT COALESCE(MAX(CAST(SUBSTR(order_number, 2) AS INTEGER)), 0) AS current
      FROM orders
      WHERE order_number GLOB '#[0-9]*'
    `,
    )
    .get()
  const current = Number(row?.current ?? 0)
  return `#${String(current + 1).padStart(3, '0')}`
}

function formatClock(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatLegacyDate(date) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year} - ${formatClock(date)}`
}

function createDomainError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function normalizeCustomerEmail(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized) return ''
  if (!normalized.includes('@')) return ''
  return normalized.slice(0, 120)
}

function normalizeCustomerPhone(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^\d+]/g, '')
    .slice(0, 25)
  return normalized
}

function hashPassword(password, username = '') {
  const safePassword = String(password ?? '')
  const safeUsername = String(username ?? '').trim().toLowerCase()
  return createHash('sha256')
    .update(`${safeUsername}|${safePassword}|${AUTH_PEPPER}`)
    .digest('hex')
}

function hashCustomerPassword(password, identity = '') {
  const safePassword = String(password ?? '')
  const safeIdentity = String(identity ?? '').trim().toLowerCase()
  return createHash('sha256')
    .update(`customer|${safeIdentity}|${safePassword}|${AUTH_PEPPER}`)
    .digest('hex')
}

function ensureDefaultUsers() {
  const userCount = Number(db.prepare('SELECT COUNT(*) AS count FROM users').get()?.count ?? 0)
  if (userCount > 0) return
  const insertUser = db.prepare(`
    INSERT INTO users (
      username, display_name, role, password_digest, active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `)
  const now = new Date().toISOString()
  DEFAULT_USERS.forEach((user) => {
    insertUser.run(
      user.username,
      user.displayName,
      user.role,
      hashPassword(user.password, user.username),
      1,
      now,
    )
  })
}

function ensureLegacyAdminUsersAreManagers() {
  db.prepare(`
    UPDATE users
    SET role = 'manager'
    WHERE LOWER(role) = 'admin'
  `).run()
}

function ensureDefaultSettings() {
  const currentCount = Number(db.prepare('SELECT COUNT(*) AS count FROM settings').get()?.count ?? 0)
  if (currentCount > 0) return
  const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
  insertSetting.run('taxRate', '10')
  insertSetting.run('receiptFooter', 'true')
  insertSetting.run('defaultService', 'Dine In')
}
