import {
  CalendarDays,
  Coffee,
  Download,
  Menu,
  Package,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createUser, fetchSettings, fetchUsers, saveSettings, updateUser } from '../api/client'
import { HeaderChip } from '../components/common'
import { formatDate } from '../utils/format'

const PAGE_CONFIG = {
  inventory: {
    title: 'Tenant Inventory',
    subtitle: 'Track core coffee stock for daily operations.',
    icon: Package,
  },
  teams: {
    title: 'Teams',
    subtitle: 'Manage staff assignments for the tenant.',
    icon: Users,
  },
  settings: {
    title: 'Tenant Settings',
    subtitle: 'Configure tax, receipt, and coffee shop defaults.',
    icon: Settings,
  },
}

const STORAGE_KEY = 'tenant-pos-manage-v1'
const ADD_CATEGORY_OPTION = '__add_new_category__'

const DEFAULT_INVENTORY = [
  { label: 'Coffee Beans', value: 42, unit: 'kg', threshold: 20 },
  { label: 'Fresh Milk', value: 78, unit: 'L', threshold: 30 },
  { label: 'Cups & Lids', value: 540, unit: 'sets', threshold: 200 },
]

const DEFAULT_TEAMS = [
  { label: 'Cashier', total: 4, onShift: 2 },
  { label: 'Barista', total: 6, onShift: 3 },
  { label: 'Kitchen', total: 3, onShift: 2 },
]

const DEFAULT_SETTINGS = {
  taxRate: 10,
  receiptFooter: true,
  defaultService: 'Dine In',
}

function getInitialManageState() {
  const fallback = {
    inventory: DEFAULT_INVENTORY,
    teams: DEFAULT_TEAMS,
    settings: DEFAULT_SETTINGS,
  }
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return {
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : fallback.inventory,
      teams: Array.isArray(parsed.teams) ? parsed.teams : fallback.teams,
      settings: parsed.settings ? parsed.settings : fallback.settings,
    }
  } catch {
    return fallback
  }
}

function createEmptyProductDraft(categoryId = 'coffee') {
  return {
    name: '',
    category: categoryId,
    label: 'Coffee',
    basePrice: '',
    stockQty: '50',
    stockThreshold: '10',
    image: '',
    description: '',
  }
}

async function resizeImageFileToDataUrl(file, targetSize = 640) {
  const sourceUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Invalid image file.'))
      img.src = sourceUrl
    })

    const sourceWidth = image.naturalWidth
    const sourceHeight = image.naturalHeight
    const sourceSize = Math.min(sourceWidth, sourceHeight)
    const sourceX = Math.floor((sourceWidth - sourceSize) / 2)
    const sourceY = Math.floor((sourceHeight - sourceSize) / 2)

    const canvas = document.createElement('canvas')
    canvas.width = targetSize
    canvas.height = targetSize

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Canvas is not available in this browser.')
    }
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      targetSize,
      targetSize,
    )
    return canvas.toDataURL('image/jpeg', 0.86)
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

function escapeCsvCell(value) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

function toProductsCsv(products) {
  const headers = [
    'id',
    'name',
    'category',
    'label',
    'basePrice',
    'stockQty',
    'stockThreshold',
    'image',
    'description',
    'customizable',
  ]
  const rows = products.map((product) =>
    [
      product.id ?? '',
      product.name ?? '',
      product.category ?? '',
      product.label ?? '',
      product.basePrice ?? 0,
      product.stockQty ?? 50,
      product.stockThreshold ?? 10,
      product.image ?? '',
      product.description ?? '',
      product.customizable ? 'true' : 'false',
    ].map((cell) => escapeCsvCell(cell)),
  )
  return [headers.map((cell) => escapeCsvCell(cell)).join(','), ...rows.map((row) => row.join(','))].join('\n')
}

function parseCsvLine(line) {
  const cells = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
      continue
    }
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === ',' && !quoted) {
      cells.push(current)
      current = ''
      continue
    }
    current += char
  }
  cells.push(current)
  return cells
}

function parseProductsCsv(text) {
  const lines = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0)
  if (lines.length === 0) return []
  const headers = parseCsvLine(lines[0]).map((header) => header.trim())
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const row = {}
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? ''
    })
    return row
  })
}

function formatMovementTimestamp(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSignedQuantity(value) {
  const parsed = Number(value ?? 0)
  if (!Number.isFinite(parsed)) return '0'
  const rounded = Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2)
  return parsed > 0 ? `+${rounded}` : rounded
}

export function ManageScreen({
  now,
  page,
  categories = [],
  products = [],
  inventoryMovements = [],
  canManageCatalog = true,
  onOpenMenu,
  onAction,
  onCreateCategory,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
  onBulkCreateProducts,
  settingsBootstrap,
  currentUserRole = '',
  onSettingsChange,
}) {
  const config = PAGE_CONFIG[page] ?? PAGE_CONFIG.inventory
  const SectionIcon = config.icon
  const [initialState] = useState(() => getInitialManageState())
  const [inventory] = useState(initialState.inventory)
  const [teams] = useState(initialState.teams)
  const [settings, setSettings] = useState(initialState.settings)
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersUpdatingId, setUsersUpdatingId] = useState('')
  const [newUserDraft, setNewUserDraft] = useState({
    username: '',
    displayName: '',
    role: 'cashier',
    password: '',
  })
  const [sectionError, setSectionError] = useState('')
  const categoryOptions = useMemo(() => categories.filter((item) => item.id !== 'all'), [categories])
  const [productSearch, setProductSearch] = useState('')
  const [inventoryFilter, setInventoryFilter] = useState('all')
  const [editingProductId, setEditingProductId] = useState('')
  const [productError, setProductError] = useState('')
  const [savingProduct, setSavingProduct] = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [stockUpdatingId, setStockUpdatingId] = useState('')
  const [importingProducts, setImportingProducts] = useState(false)
  const [movementSearch, setMovementSearch] = useState('')
  const [movementTypeFilter, setMovementTypeFilter] = useState('all')
  const [productDraft, setProductDraft] = useState(() =>
    createEmptyProductDraft(categoryOptions[0]?.id ?? 'coffee'),
  )
  const imageFileInputRef = useRef(null)
  const importFileInputRef = useRef(null)

  useEffect(() => {
    const payload = { inventory, teams, settings }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [inventory, settings, teams])

  useEffect(() => {
    if (!settingsBootstrap) return
    setSettings((previous) => ({
      ...previous,
      taxRate: Number(settingsBootstrap.taxRate ?? previous.taxRate ?? 10),
      receiptFooter: Boolean(settingsBootstrap.receiptFooter ?? previous.receiptFooter),
      defaultService: String(settingsBootstrap.defaultService ?? previous.defaultService ?? 'Dine In'),
    }))
  }, [settingsBootstrap])

  useEffect(() => {
    if (page !== 'settings') return
    const controller = new AbortController()
    fetchSettings(controller.signal)
      .then((result) => {
        setSettings((previous) => ({
          ...previous,
          taxRate: Number(result?.taxRate ?? previous.taxRate ?? 10),
          receiptFooter: String(result?.receiptFooter ?? 'true').toLowerCase() === 'true',
          defaultService: String(result?.defaultService ?? previous.defaultService ?? 'Dine In'),
        }))
      })
      .catch(() => {})
    return () => controller.abort()
  }, [page])

  useEffect(() => {
    if (page !== 'teams') return
    const controller = new AbortController()
    setSectionError('')
    setUsersLoading(true)
    fetchUsers(controller.signal)
      .then((result) => {
        setUsers(Array.isArray(result?.users) ? result.users : [])
      })
      .catch((error) => {
        setSectionError(error.message || 'Failed to load users.')
      })
      .finally(() => setUsersLoading(false))
    return () => controller.abort()
  }, [page])

  useEffect(() => {
    setSectionError('')
  }, [page])

  useEffect(() => {
    if (categoryOptions.length === 0) return
    const hasCategory = categoryOptions.some((item) => item.id === productDraft.category)
    if (hasCategory) return
    setProductDraft((previous) => ({
      ...previous,
      category: categoryOptions[0].id,
    }))
  }, [categoryOptions, productDraft.category])

  const saveCurrentSection = async () => {
    setSectionError('')
    if (page === 'settings') {
      try {
        await saveSettings({
          taxRate: String(settings.taxRate),
          receiptFooter: String(settings.receiptFooter),
          defaultService: settings.defaultService,
        })
        onSettingsChange?.(settings)
      } catch (error) {
        setSectionError(error.message || 'Failed to save settings.')
        return
      }
    }
    onAction?.(`${config.title} saved successfully.`)
  }

  const canCreateUsers = String(currentUserRole).toLowerCase() === 'admin'

  const handleCreateUser = async () => {
    if (!canCreateUsers) return
    const username = newUserDraft.username.trim().toLowerCase()
    const displayName = newUserDraft.displayName.trim()
    const role = newUserDraft.role.trim().toLowerCase()
    const password = newUserDraft.password
    if (!username || !displayName || !role || !password) {
      setSectionError('All new user fields are required.')
      return
    }
    setSectionError('')
    try {
      await createUser({ username, displayName, role, password })
      const refreshed = await fetchUsers()
      setUsers(Array.isArray(refreshed?.users) ? refreshed.users : [])
      setNewUserDraft({ username: '', displayName: '', role: 'cashier', password: '' })
      onAction?.('User created.')
    } catch (error) {
      setSectionError(error.message || 'Failed to create user.')
    }
  }

  const handleToggleUserActive = async (user) => {
    if (!canCreateUsers) return
    setUsersUpdatingId(String(user.id))
    setSectionError('')
    try {
      await updateUser(user.id, { active: !user.active })
      setUsers((previous) =>
        previous.map((item) =>
          item.id === user.id ? { ...item, active: !item.active } : item,
        ),
      )
      onAction?.(`User ${user.username} updated.`)
    } catch (error) {
      setSectionError(error.message || 'Failed to update user.')
    } finally {
      setUsersUpdatingId('')
    }
  }

  const teamStats = users.length
    ? [
        {
          label: 'Admin',
          total: users.filter((item) => String(item.role).toLowerCase() === 'admin').length,
          onShift: users.filter(
            (item) => String(item.role).toLowerCase() === 'admin' && Boolean(item.active),
          ).length,
        },
        {
          label: 'Manager',
          total: users.filter((item) => String(item.role).toLowerCase() === 'manager').length,
          onShift: users.filter(
            (item) => String(item.role).toLowerCase() === 'manager' && Boolean(item.active),
          ).length,
        },
        {
          label: 'Cashier',
          total: users.filter((item) => String(item.role).toLowerCase() === 'cashier').length,
          onShift: users.filter(
            (item) => String(item.role).toLowerCase() === 'cashier' && Boolean(item.active),
          ).length,
        },
      ]
    : teams

  const resetProductForm = () => {
    setEditingProductId('')
    setProductError('')
    setProductDraft(createEmptyProductDraft(categoryOptions[0]?.id ?? 'coffee'))
  }

  const handleCreateCategoryFromDropdown = async () => {
    if (!canManageCatalog) return
    if (!onCreateCategory) {
      setProductError('Category creation is not available.')
      return
    }
    const categoryNameInput = window.prompt('Enter new category name:')
    if (categoryNameInput === null) return
    const name = categoryNameInput.trim()
    if (!name) {
      setProductError('Category name is required.')
      return
    }

    const existingCategory = categoryOptions.find(
      (item) => String(item.name).trim().toLowerCase() === name.toLowerCase(),
    )
    if (existingCategory) {
      setProductDraft((previous) => ({ ...previous, category: existingCategory.id }))
      onAction?.(`Category "${existingCategory.name}" already exists.`)
      return
    }

    setCreatingCategory(true)
    setProductError('')
    try {
      const created = await onCreateCategory({ name })
      if (!created?.id) throw new Error('Category response is invalid.')
      setProductDraft((previous) => ({
        ...previous,
        category: created.id,
      }))
      onAction?.(`Category "${created.name}" created.`)
    } catch (error) {
      setProductError(error.message || 'Failed to create category.')
    } finally {
      setCreatingCategory(false)
    }
  }

  const submitProductForm = async () => {
    if (!canManageCatalog) {
      setProductError('You do not have permission to manage product catalog.')
      return
    }
    const name = productDraft.name.trim()
    const label = productDraft.label.trim()
    const image = productDraft.image.trim()
    const description = productDraft.description.trim()
    const basePrice = Number(productDraft.basePrice)
    const stockQty = Number(productDraft.stockQty)
    const stockThreshold = Number(productDraft.stockThreshold)
    if (!name) {
      setProductError('Product name is required.')
      return
    }
    if (!productDraft.category || productDraft.category === 'all') {
      setProductError('Please select a valid category.')
      return
    }
    if (!categoryOptions.some((item) => item.id === productDraft.category)) {
      setProductError('Please select an existing category.')
      return
    }
    if (!label) {
      setProductError('Label is required.')
      return
    }
    if (!image) {
      setProductError('Image URL is required.')
      return
    }
    if (!description) {
      setProductError('Description is required.')
      return
    }
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      setProductError('Price is invalid.')
      return
    }
    if (!Number.isFinite(stockQty) || stockQty < 0) {
      setProductError('Stock quantity is invalid.')
      return
    }
    if (!Number.isFinite(stockThreshold) || stockThreshold < 0) {
      setProductError('Stock threshold is invalid.')
      return
    }

    setSavingProduct(true)
    setProductError('')
    try {
      const payload = {
        name,
        category: productDraft.category,
        label,
        basePrice,
        stockQty,
        stockThreshold,
        stockNote: editingProductId ? 'Inventory product form update' : undefined,
        image,
        description,
        customizable: false,
        options: null,
      }
      if (editingProductId) {
        await onUpdateProduct?.(editingProductId, payload)
        onAction?.('Product updated.')
      } else {
        await onCreateProduct?.(payload)
        onAction?.('Product created.')
      }
      resetProductForm()
    } catch (error) {
      setProductError(error.message || 'Failed to save product.')
    } finally {
      setSavingProduct(false)
    }
  }

  const startEditProduct = (product) => {
    if (!canManageCatalog) {
      setProductError('You do not have permission to edit products.')
      return
    }
    setProductError('')
    setEditingProductId(product.id)
    setProductDraft({
      name: product.name,
      category: product.category,
      label: product.label,
      basePrice: String(product.basePrice),
      stockQty: String(product.stockQty ?? 50),
      stockThreshold: String(product.stockThreshold ?? 10),
      image: product.image,
      description: product.description,
    })
  }

  const handleSelectImageFile = (event) => {
    if (!canManageCatalog) {
      setProductError('You do not have permission to upload product images.')
      event.target.value = ''
      return
    }
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setProductError('Please choose a valid image file.')
      event.target.value = ''
      return
    }
    setSavingProduct(true)
    setProductError('')
    resizeImageFileToDataUrl(file)
      .then((result) => {
        setProductDraft((previous) => ({ ...previous, image: result }))
        onAction?.('Product image resized and ready.')
      })
      .catch((error) => {
        setProductError(error.message || 'Unable to process selected image.')
      })
      .finally(() => {
        setSavingProduct(false)
      })
    event.target.value = ''
  }

  const removeProduct = async (product) => {
    if (!canManageCatalog) {
      setProductError('You do not have permission to delete products.')
      return
    }
    if (!onDeleteProduct) return
    const confirmed = window.confirm(`Delete "${product.name}"?`)
    if (!confirmed) return
    setSavingProduct(true)
    setProductError('')
    try {
      await onDeleteProduct(product.id)
      onAction?.('Product deleted.')
      if (editingProductId === product.id) {
        resetProductForm()
      }
    } catch (error) {
      setProductError(error.message || 'Failed to delete product.')
    } finally {
      setSavingProduct(false)
    }
  }

  const keyword = productSearch.trim().toLowerCase()
  const filteredProducts = products.filter((item) => {
    if (!keyword) return true
    return (
      item.name.toLowerCase().includes(keyword) ||
      item.label.toLowerCase().includes(keyword) ||
      item.category.toLowerCase().includes(keyword)
    )
  })
  const inventoryRows = products.map((item) => {
    const stockQty = Number(item.stockQty ?? 50)
    const stockThreshold = Number(item.stockThreshold ?? 10)
    let stockState = 'healthy'
    if (stockQty <= 0) {
      stockState = 'out'
    } else if (stockQty <= stockThreshold) {
      stockState = 'low'
    }
    return {
      ...item,
      stockQty,
      stockThreshold,
      stockState,
    }
  })
  const outOfStockProducts = inventoryRows.filter((item) => item.stockState === 'out')
  const lowStockProducts = inventoryRows.filter((item) => item.stockState === 'low')
  const alertProducts = [...outOfStockProducts, ...lowStockProducts].slice(0, 8)
  const totalStockUnits = inventoryRows.reduce((sum, item) => sum + item.stockQty, 0)
  const filteredInventoryProducts = filteredProducts.filter((item) => {
    const qty = Number(item.stockQty ?? 50)
    const threshold = Number(item.stockThreshold ?? 10)
    const isOut = qty <= 0
    const isLow = qty > 0 && qty <= threshold
    if (inventoryFilter === 'low') return isLow
    if (inventoryFilter === 'out') return isOut
    return true
  })
  const validCategoryIds = new Set(categoryOptions.map((item) => item.id))
  const fallbackCategoryId = categoryOptions[0]?.id ?? 'coffee'
  const recentInventoryMovements = inventoryMovements.slice(0, 80)
  const movementKeyword = movementSearch.trim().toLowerCase()
  const filteredInventoryMovements = recentInventoryMovements
    .filter((movement) => {
      if (movementTypeFilter === 'sale') return movement.movementType === 'sale'
      if (movementTypeFilter === 'adjustment') return movement.movementType === 'adjustment'
      if (movementTypeFilter === 'opening') return movement.movementType === 'opening'
      return true
    })
    .filter((movement) => {
      if (!movementKeyword) return true
      return (
        String(movement.productName ?? '')
          .toLowerCase()
          .includes(movementKeyword) ||
        String(movement.orderNumber ?? '')
          .toLowerCase()
          .includes(movementKeyword) ||
        String(movement.note ?? '')
          .toLowerCase()
          .includes(movementKeyword)
      )
    })
    .slice(0, 20)

  const normalizeImportedProduct = (source, index) => {
    const id = String(source.id ?? '').trim()
    const name = String(source.name ?? '').trim()
    const categoryRaw = String(source.category ?? '').trim()
    const category = validCategoryIds.has(categoryRaw) ? categoryRaw : fallbackCategoryId
    const label = String(source.label ?? '').trim() || 'Coffee'
    const image = String(source.image ?? '').trim()
    const description = String(source.description ?? '').trim()
    const basePriceSource =
      source.basePrice ?? source.base_price ?? source.price ?? source.unitPrice ?? source.unit_price
    const basePrice = Number(basePriceSource ?? 0)
    const stockQty = Number(source.stockQty ?? source.stock_qty ?? 50)
    const stockThreshold = Number(source.stockThreshold ?? source.stock_threshold ?? 10)

    if (!name) return { ok: false, error: `Row ${index + 1}: Product name is required.` }
    if (!image) return { ok: false, error: `Row ${index + 1}: Image is required.` }
    if (!description) return { ok: false, error: `Row ${index + 1}: Description is required.` }
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      return { ok: false, error: `Row ${index + 1}: Invalid basePrice.` }
    }
    if (!Number.isFinite(stockQty) || stockQty < 0) {
      return { ok: false, error: `Row ${index + 1}: Invalid stockQty.` }
    }
    if (!Number.isFinite(stockThreshold) || stockThreshold < 0) {
      return { ok: false, error: `Row ${index + 1}: Invalid stockThreshold.` }
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
        image,
        description,
        customizable: Boolean(source.customizable),
        options:
          source.options && typeof source.options === 'object' && !Array.isArray(source.options)
            ? source.options
            : null,
      },
    }
  }

  const downloadFile = (content, filename, contentType) => {
    const blob = new Blob([content], { type: contentType })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleExportProducts = (format) => {
    if (!canManageCatalog) {
      setProductError('You do not have permission to export products.')
      return
    }
    if (products.length === 0) {
      onAction?.('No products to export.')
      return
    }
    const dateSuffix = new Date().toISOString().slice(0, 10)
    if (format === 'json') {
      downloadFile(
        JSON.stringify(products, null, 2),
        `products-export-${dateSuffix}.json`,
        'application/json;charset=utf-8',
      )
      onAction?.('Products exported as JSON.')
      return
    }
    const csv = toProductsCsv(products)
    downloadFile(csv, `products-export-${dateSuffix}.csv`, 'text/csv;charset=utf-8')
    onAction?.('Products exported as CSV.')
  }

  const handleExportMovements = () => {
    if (!canManageCatalog) {
      setProductError('You do not have permission to export stock movements.')
      return
    }
    if (filteredInventoryMovements.length === 0) {
      onAction?.('No stock movement records to export.')
      return
    }
    const header = ['id', 'productName', 'type', 'quantity', 'beforeQty', 'afterQty', 'orderNumber', 'note', 'createdAt']
    const rows = filteredInventoryMovements.map((movement) =>
      [
        movement.id,
        movement.productName,
        movement.movementType,
        movement.quantity,
        movement.beforeQty,
        movement.afterQty,
        movement.orderNumber ?? '',
        movement.note ?? '',
        movement.createdAt ?? '',
      ].map((cell) => escapeCsvCell(cell)),
    )
    const csv = [header.map((cell) => escapeCsvCell(cell)).join(','), ...rows.map((row) => row.join(','))].join('\n')
    const dateSuffix = new Date().toISOString().slice(0, 10)
    downloadFile(csv, `inventory-movements-${dateSuffix}.csv`, 'text/csv;charset=utf-8')
    onAction?.('Inventory movements exported as CSV.')
  }

  const handleImportProducts = async (event) => {
    if (!canManageCatalog) {
      setProductError('You do not have permission to import products.')
      event.target.value = ''
      return
    }
    const file = event.target.files?.[0]
    if (!file) return
    setImportingProducts(true)
    setProductError('')
    try {
      const text = await file.text()
      const lowerName = file.name.toLowerCase()
      const sourceRows =
        lowerName.endsWith('.json') || file.type.includes('json')
          ? (() => {
              const parsed = JSON.parse(text)
              if (Array.isArray(parsed)) return parsed
              if (Array.isArray(parsed?.products)) return parsed.products
              throw new Error('JSON must be an array or { products: [...] }.')
            })()
          : parseProductsCsv(text)

      if (!Array.isArray(sourceRows) || sourceRows.length === 0) {
        throw new Error('Import file has no product rows.')
      }

      const validProducts = []
      const importErrors = []
      sourceRows.forEach((row, rowIndex) => {
        const normalized = normalizeImportedProduct(row, rowIndex)
        if (normalized.ok) {
          validProducts.push(normalized.value)
        } else {
          importErrors.push(normalized.error)
        }
      })

      if (validProducts.length === 0) {
        throw new Error(importErrors[0] || 'No valid products found to import.')
      }

      if (onBulkCreateProducts) {
        const result = await onBulkCreateProducts(validProducts, 'skip_duplicates')
        onAction?.(
          `Import done: ${result.createdCount} created, ${result.skippedCount} skipped, ${result.errorCount} failed.`,
        )
        if (result.errorCount > 0 && Array.isArray(result.errors) && result.errors[0]?.error) {
          setProductError(String(result.errors[0].error))
        }
      } else if (onCreateProduct) {
        let createdCount = 0
        for (const product of validProducts) {
          await onCreateProduct(product)
          createdCount += 1
        }
        onAction?.(`Import done: ${createdCount} products created.`)
      }

      if (importErrors.length > 0) {
        setProductError(importErrors[0])
      }
    } catch (error) {
      setProductError(error.message || 'Failed to import products.')
    } finally {
      setImportingProducts(false)
      event.target.value = ''
    }
  }

  const updateProductStock = async (product, delta) => {
    if (!canManageCatalog) {
      setProductError('You do not have permission to adjust stock.')
      return
    }
    if (!onUpdateProduct || stockUpdatingId) return
    const currentQty = Number(product.stockQty ?? 50)
    const nextQty = Math.max(0, currentQty + delta)
    setStockUpdatingId(product.id)
    setProductError('')
    try {
      await onUpdateProduct(product.id, {
        name: product.name,
        category: product.category,
        label: product.label,
        basePrice: Number(product.basePrice),
        stockQty: nextQty,
        stockThreshold: Number(product.stockThreshold ?? 10),
        stockNote: `Quick stock adjustment (${delta > 0 ? `+${delta}` : String(delta)})`,
        image: product.image,
        description: product.description,
        customizable: Boolean(product.customizable),
        options: product.options ?? null,
      })
      onAction?.(`Stock updated: ${product.name} = ${nextQty}`)
    } catch (error) {
      setProductError(error.message || 'Failed to update stock.')
    } finally {
      setStockUpdatingId('')
    }
  }

  return (
    <div className="grid h-screen w-full grid-cols-1 overflow-hidden">
      <div className="flex min-h-0 h-full flex-col overflow-hidden bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 md:px-6">
          <div className="flex items-center gap-2">
            <button onClick={onOpenMenu} className="ui-btn ui-btn-ghost rounded-xl p-2 text-slate-500">
              <Menu size={18} />
            </button>
            <h1 className="text-xl font-semibold text-slate-900">{config.title}</h1>
          </div>
          <HeaderChip icon={CalendarDays} label={formatDate(now)} />
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <section className="ui-surface-muted p-4 md:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-[#2D71F8]/10 p-2 text-[#2D71F8]">
                <SectionIcon size={20} />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">{config.title}</p>
                <p className="text-sm text-slate-500">{config.subtitle}</p>
              </div>
            </div>

            {page === 'inventory' && (
              <>
                {!canManageCatalog && (
                  <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                    Read-only mode: your role cannot modify inventory catalog or stock.
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <article className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total SKUs</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{inventoryRows.length}</p>
                  </article>
                  <article className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Units</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{totalStockUnits}</p>
                  </article>
                  <article className="rounded-xl border border-[#2D71F8]/20 bg-[#2D71F8]/[0.04] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#2D71F8]/80">Low Stock</p>
                    <p className="mt-2 text-2xl font-black text-[#2D71F8]">{lowStockProducts.length}</p>
                  </article>
                  <article className="rounded-xl border border-slate-300 bg-slate-100/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Out Of Stock</p>
                    <p className="mt-2 text-2xl font-black text-slate-700">{outOfStockProducts.length}</p>
                  </article>
                </div>

                {alertProducts.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-800">Stock Alerts</h3>
                      <p className="text-xs text-slate-400">{alertProducts.length} items need attention</p>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {alertProducts.map((item) => (
                        <article
                          key={`alert-${item.id}`}
                          className={`rounded-xl border p-3 ${
                            item.stockState === 'out'
                              ? 'border-slate-300 bg-slate-100/70'
                              : 'border-[#2D71F8]/20 bg-[#2D71F8]/[0.04]'
                          }`}
                        >
                          <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.stockState === 'out'
                              ? 'Out of stock'
                              : `Low stock (${item.stockQty} / ${item.stockThreshold})`}
                          </p>
                          <div className="mt-2 flex gap-1.5">
                            <button
                              onClick={() => updateProductStock(item, 1)}
                              disabled={!canManageCatalog || stockUpdatingId === item.id}
                              className="ui-btn ui-btn-secondary rounded-md bg-white px-2 py-1 text-[11px] text-slate-600"
                            >
                              +1
                            </button>
                            <button
                              onClick={() => updateProductStock(item, 10)}
                              disabled={!canManageCatalog || stockUpdatingId === item.id}
                              className="ui-btn ui-btn-secondary rounded-md bg-white px-2 py-1 text-[11px] text-slate-600"
                            >
                              +10
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                      <span className="h-2 w-2 rounded-full bg-emerald-600" />
                      All stock healthy
                    </div>
                    <p className="text-xs text-emerald-700/80">No items need attention</p>
                  </div>
                )}

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-800">Stock Movement History</h3>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-slate-400">{filteredInventoryMovements.length} records</p>
                      <button
                        onClick={handleExportMovements}
                        disabled={!canManageCatalog}
                        className="ui-btn ui-btn-secondary px-2.5 py-1.5 text-xs text-slate-600"
                      >
                        <Download size={12} />
                        Export
                      </button>
                    </div>
                  </div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <label className="relative w-full max-w-[280px]">
                      <Search
                        size={14}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        value={movementSearch}
                        onChange={(event) => setMovementSearch(event.target.value)}
                        placeholder="Search product, order, note..."
                        className="ui-input py-2 pl-8 pr-3 text-sm"
                      />
                    </label>
                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                      {[
                        { id: 'all', label: 'All' },
                        { id: 'sale', label: 'Sales' },
                        { id: 'adjustment', label: 'Adjust' },
                        { id: 'opening', label: 'Opening' },
                      ].map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setMovementTypeFilter(option.id)}
                          className={`ui-btn rounded-md px-2.5 py-1 text-xs ${
                            movementTypeFilter === option.id
                              ? 'bg-[#2D71F8] text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="max-h-[220px] overflow-y-auto rounded-xl border border-slate-100">
                    <div className="grid grid-cols-[1.2fr_80px_80px_1fr_1fr] gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <p>Product</p>
                      <p>Type</p>
                      <p>Qty</p>
                      <p>Stock</p>
                      <p>Time</p>
                    </div>
                    {filteredInventoryMovements.map((movement) => {
                      const isSale = movement.movementType === 'sale'
                      const isOpening = movement.movementType === 'opening'
                      const isNegative = Number(movement.quantity ?? 0) < 0
                      return (
                        <div
                          key={`movement-${movement.id}`}
                          className="grid grid-cols-[1.2fr_80px_80px_1fr_1fr] gap-2 border-b border-slate-100 px-3 py-2 text-sm text-slate-700"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{movement.productName}</p>
                            <p className="truncate text-[11px] text-slate-400">
                              {movement.orderNumber ? `Order ${movement.orderNumber}` : movement.note || 'Manual update'}
                            </p>
                          </div>
                          <p>
                            <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                isSale
                                  ? 'bg-[#2D71F8]/10 text-[#2D71F8]'
                                  : isOpening
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {isSale ? 'Sale' : isOpening ? 'Open' : 'Adjust'}
                            </span>
                          </p>
                          <p className={`font-semibold ${isNegative ? 'text-[#FC4A4A]' : 'text-[#1C8370]'}`}>
                            {formatSignedQuantity(movement.quantity)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {Number(movement.beforeQty ?? 0)} -&gt; {Number(movement.afterQty ?? 0)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatMovementTimestamp(movement.createdAt)}
                          </p>
                        </div>
                      )
                    })}
                    {filteredInventoryMovements.length === 0 && (
                      <div className="px-3 py-3 text-sm text-slate-400">
                        No stock movement recorded yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 xl:grid-cols-[340px_1fr]">
                  <section>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-800">
                        {editingProductId ? 'Edit Product' : 'Add Product'}
                      </h3>
                      {editingProductId && (
                        <button
                          onClick={resetProductForm}
                          className="ui-btn ui-btn-secondary px-2.5 py-1 text-xs text-slate-600"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                    <fieldset className="space-y-2 disabled:opacity-70" disabled={!canManageCatalog || creatingCategory}>
                      <input
                        value={productDraft.name}
                        onChange={(event) =>
                          setProductDraft((previous) => ({ ...previous, name: event.target.value }))
                        }
                        placeholder="Product name"
                        className="ui-input px-3 py-2 text-sm"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={
                            categoryOptions.some((item) => item.id === productDraft.category)
                              ? productDraft.category
                              : ''
                          }
                          onChange={(event) => {
                            const nextCategory = event.target.value
                            if (nextCategory === ADD_CATEGORY_OPTION) {
                              void handleCreateCategoryFromDropdown()
                              return
                            }
                            setProductDraft((previous) => ({
                              ...previous,
                              category: nextCategory,
                            }))
                          }}
                          className="ui-input px-3 py-2 text-sm"
                        >
                          {categoryOptions.length === 0 && (
                            <option value="" disabled>
                              No category available
                            </option>
                          )}
                          {categoryOptions.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                          <option value={ADD_CATEGORY_OPTION}>+ Add new category...</option>
                        </select>
                        <input
                          value={productDraft.label}
                          onChange={(event) =>
                            setProductDraft((previous) => ({ ...previous, label: event.target.value }))
                          }
                          placeholder="Label"
                          className="ui-input px-3 py-2 text-sm"
                        />
                      </div>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={productDraft.basePrice}
                        onChange={(event) =>
                          setProductDraft((previous) => ({
                            ...previous,
                            basePrice: event.target.value,
                          }))
                        }
                        placeholder="Base price (USD)"
                        className="ui-input px-3 py-2 text-sm"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={productDraft.stockQty}
                          onChange={(event) =>
                            setProductDraft((previous) => ({
                              ...previous,
                              stockQty: event.target.value,
                            }))
                          }
                          placeholder="Stock qty"
                          className="ui-input px-3 py-2 text-sm"
                        />
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={productDraft.stockThreshold}
                          onChange={(event) =>
                            setProductDraft((previous) => ({
                              ...previous,
                              stockThreshold: event.target.value,
                            }))
                          }
                          placeholder="Low stock threshold"
                          className="ui-input px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <input
                          value={productDraft.image}
                          onChange={(event) =>
                            setProductDraft((previous) => ({
                              ...previous,
                              image: event.target.value,
                            }))
                          }
                          placeholder="Image URL"
                          className="ui-input px-3 py-2 text-sm"
                        />
                        <button
                          onClick={() => imageFileInputRef.current?.click()}
                          type="button"
                          className="ui-btn ui-btn-secondary px-3 py-2 text-sm text-slate-600"
                        >
                          Browse
                        </button>
                        <input
                          ref={imageFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleSelectImageFile}
                          className="hidden"
                        />
                      </div>
                      {productDraft.image && (
                        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          <img
                            src={productDraft.image}
                            alt="Selected product"
                            className="h-28 w-full object-cover"
                          />
                        </div>
                      )}
                      <textarea
                        value={productDraft.description}
                        onChange={(event) =>
                          setProductDraft((previous) => ({
                            ...previous,
                            description: event.target.value,
                          }))
                        }
                        rows={3}
                        placeholder="Description"
                        className="ui-input w-full resize-none px-3 py-2 text-sm"
                      />
                      {productError && (
                        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-[#FC4A4A]">
                          {productError}
                        </p>
                      )}
                      <button
                        onClick={submitProductForm}
                        disabled={!canManageCatalog || savingProduct}
                        className="ui-btn ui-btn-primary inline-flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm disabled:bg-slate-300 disabled:shadow-none"
                      >
                        <Plus size={15} />
                        {savingProduct
                          ? 'Saving...'
                          : editingProductId
                            ? 'Update Product'
                            : 'Create Product'}
                      </button>
                    </fieldset>
                  </section>

                  <section>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-800">
                        Product Catalog ({filteredInventoryProducts.length})
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleExportProducts('csv')}
                          disabled={!canManageCatalog}
                          className="ui-btn ui-btn-secondary inline-flex items-center gap-1 px-2.5 py-2 text-xs text-slate-600"
                        >
                          <Download size={13} />
                          CSV
                        </button>
                        <button
                          onClick={() => handleExportProducts('json')}
                          disabled={!canManageCatalog}
                          className="ui-btn ui-btn-secondary inline-flex items-center gap-1 px-2.5 py-2 text-xs text-slate-600"
                        >
                          <Download size={13} />
                          JSON
                        </button>
                        <button
                          onClick={() => importFileInputRef.current?.click()}
                          disabled={!canManageCatalog || importingProducts}
                          className="ui-btn ui-btn-secondary inline-flex items-center gap-1 border-[#2D71F8]/30 px-2.5 py-2 text-xs text-[#2D71F8] hover:bg-[#2D71F8]/5 disabled:border-slate-200 disabled:text-slate-400"
                        >
                          <Upload size={13} />
                          {importingProducts ? 'Importing...' : 'Import'}
                        </button>
                        <input
                          ref={importFileInputRef}
                          type="file"
                          accept=".csv,.json,application/json,text/csv"
                          onChange={handleImportProducts}
                          className="hidden"
                        />
                        <label className="relative w-[230px]">
                          <Search
                            size={15}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                          />
                          <input
                            value={productSearch}
                            onChange={(event) => setProductSearch(event.target.value)}
                            placeholder="Search product..."
                            className="ui-input py-2 pl-9 pr-3 text-sm"
                          />
                        </label>
                        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                          {[
                            { id: 'all', label: 'All' },
                            { id: 'low', label: 'Low' },
                            { id: 'out', label: 'Out' },
                          ].map((option) => (
                            <button
                              key={option.id}
                              onClick={() => setInventoryFilter(option.id)}
                              className={`ui-btn rounded-md px-2.5 py-1 text-xs ${
                                inventoryFilter === option.id
                                  ? 'bg-[#2D71F8] text-white'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="max-h-[340px] overflow-y-auto rounded-xl border border-slate-100">
                      <div className="grid grid-cols-[1.4fr_90px_90px_90px_90px_130px] gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <p>Name</p>
                        <p>Category</p>
                        <p>Price</p>
                        <p>Stock</p>
                        <p>Status</p>
                        <p>Actions</p>
                      </div>
                      {filteredInventoryProducts.map((item) => {
                        const qty = Number(item.stockQty ?? 50)
                        const threshold = Number(item.stockThreshold ?? 10)
                        const isOut = qty <= 0
                        const isLow = qty > 0 && qty <= threshold
                        return (
                        <div
                          key={item.id}
                          className="grid grid-cols-[1.4fr_90px_90px_90px_90px_130px] gap-2 border-b border-slate-100 px-3 py-2 text-sm text-slate-700"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{item.name}</p>
                            <p className="truncate text-xs text-slate-400">{item.label}</p>
                          </div>
                          <p className="truncate">{item.category}</p>
                          <p>{`$${Number(item.basePrice).toFixed(2)}`}</p>
                          <p>{qty}</p>
                          <p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                isOut
                                  ? 'bg-slate-200 text-slate-700'
                                  : isLow
                                    ? 'bg-[#2D71F8]/10 text-[#2D71F8]'
                                    : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {isOut ? 'Out' : isLow ? 'Low' : 'Healthy'}
                            </span>
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateProductStock(item, -1)}
                              disabled={!canManageCatalog || stockUpdatingId === item.id}
                              className="ui-btn ui-btn-secondary rounded-md px-1.5 py-1 text-[11px] text-slate-600"
                            >
                              -1
                            </button>
                            <button
                              onClick={() => updateProductStock(item, 1)}
                              disabled={!canManageCatalog || stockUpdatingId === item.id}
                              className="ui-btn ui-btn-secondary rounded-md px-1.5 py-1 text-[11px] text-slate-600"
                            >
                              +1
                            </button>
                            <button
                              onClick={() => startEditProduct(item)}
                              disabled={!canManageCatalog}
                              className="ui-btn ui-btn-secondary rounded-md p-1.5 text-slate-600"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => removeProduct(item)}
                              disabled={!canManageCatalog}
                              className="ui-btn ui-btn-danger rounded-md p-1.5 text-[#FC4A4A]"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )})}
                      {filteredInventoryProducts.length === 0 && (
                        <div className="px-3 py-3 text-sm text-slate-400">
                          No products match your search.
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </>
            )}

            {page === 'teams' && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  {teamStats.map((item) => (
                  <article key={item.label} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm text-slate-500">{item.label}</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{item.total} Staff</p>
                    <p className="mt-1 text-xs text-slate-400">{item.onShift} on shift now</p>
                  </article>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">User Management</p>
                    {usersLoading && <p className="text-xs text-slate-400">Loading users...</p>}
                  </div>
                  {canCreateUsers && (
                    <div className="mb-4 grid gap-2 md:grid-cols-4">
                      <input
                        value={newUserDraft.username}
                        onChange={(event) =>
                          setNewUserDraft((previous) => ({ ...previous, username: event.target.value }))
                        }
                        placeholder="username"
                        className="ui-input px-3 py-2 text-sm"
                      />
                      <input
                        value={newUserDraft.displayName}
                        onChange={(event) =>
                          setNewUserDraft((previous) => ({ ...previous, displayName: event.target.value }))
                        }
                        placeholder="display name"
                        className="ui-input px-3 py-2 text-sm"
                      />
                      <select
                        value={newUserDraft.role}
                        onChange={(event) =>
                          setNewUserDraft((previous) => ({ ...previous, role: event.target.value }))
                        }
                        className="ui-input px-3 py-2 text-sm"
                      >
                        <option value="cashier">cashier</option>
                        <option value="manager">manager</option>
                        <option value="admin">admin</option>
                      </select>
                      <input
                        type="password"
                        value={newUserDraft.password}
                        onChange={(event) =>
                          setNewUserDraft((previous) => ({ ...previous, password: event.target.value }))
                        }
                        placeholder="password"
                        className="ui-input px-3 py-2 text-sm"
                      />
                      <button
                        onClick={handleCreateUser}
                        className="ui-btn ui-btn-primary md:col-span-4 px-3 py-2 text-sm"
                      >
                        Create User
                      </button>
                    </div>
                  )}
                  <div className="max-h-[280px] overflow-y-auto rounded-lg border border-slate-100">
                    <div className="grid grid-cols-[70px_1fr_1fr_110px_90px] gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <p>ID</p>
                      <p>Username</p>
                      <p>Name</p>
                      <p>Role</p>
                      <p>Status</p>
                    </div>
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className="grid grid-cols-[70px_1fr_1fr_110px_90px] gap-2 border-b border-slate-100 px-3 py-2 text-sm text-slate-700"
                      >
                        <p>{user.id}</p>
                        <p>{user.username}</p>
                        <p>{user.displayName}</p>
                        <p className="capitalize">{user.role}</p>
                        <button
                          onClick={() => handleToggleUserActive(user)}
                          disabled={!canCreateUsers || usersUpdatingId === String(user.id)}
                          className={`ui-btn rounded-md px-2 py-1 text-xs ${
                            user.active
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-100 text-slate-600'
                          }`}
                        >
                          {user.active ? 'Active' : 'Disabled'}
                        </button>
                      </div>
                    ))}
                    {users.length === 0 && !usersLoading && (
                      <div className="px-3 py-3 text-sm text-slate-400">No users found.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {page === 'settings' && (
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
                <label className="flex flex-col gap-1 text-sm text-slate-600">
                  Tax Rate (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.taxRate}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        taxRate: Number(event.target.value || 0),
                      }))
                    }
                    className="ui-input px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-slate-600">
                  Default Service
                  <select
                    value={settings.defaultService}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        defaultService: event.target.value,
                      }))
                    }
                    className="ui-input px-3 py-2 text-sm"
                  >
                    <option>Dine In</option>
                    <option>Take Away</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-slate-600">
                  Receipt Footer
                  <button
                    onClick={() =>
                      setSettings((previous) => ({
                        ...previous,
                        receiptFooter: !previous.receiptFooter,
                      }))
                    }
                    className={`ui-btn rounded-lg px-3 py-2 text-sm ${
                      settings.receiptFooter
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {settings.receiptFooter ? 'Enabled' : 'Disabled'}
                  </button>
                </label>
              </div>
            )}

            {sectionError && (
              <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-[#FC4A4A]">
                {sectionError}
              </p>
            )}

            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
              <Coffee size={16} className="mr-2 inline text-[#2D71F8]" />
              Tenant module is active and ready for your next inventory and settings actions.
            </div>

            <button
              onClick={saveCurrentSection}
              className="ui-btn ui-btn-primary mt-4 px-4 py-2.5 text-sm"
            >
              Save {config.title}
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
