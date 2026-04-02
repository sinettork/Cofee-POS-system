import {
  Bell,
  CalendarDays,
  Clock3,
  Coffee,
  Edit2,
  LogOut,
  Menu,
  Minus,
  Paperclip,
  Percent,
  Plus,
  Power,
  Search,
  UserRound,
} from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState, startTransition } from 'react'
import { PaymentModal } from '../components/PaymentModal'
import { ProductModal } from '../components/ProductModal'
import { HeaderChip, RailButton } from '../components/common'
import { CATEGORY_ITEMS, PAGE_ITEMS, PRODUCT_ITEMS, TRACKING_ORDERS } from '../uiData'
import { formatCurrency, formatDate, formatTime } from '../utils/format'

const DEFAULT_CURRENCY = 'USD'

export function PosScreen({
  now,
  pageItems = PAGE_ITEMS,
  canOpenInventory = false,
  onOpenMenu,
  onNavigate,
  categories = [],
  products = PRODUCT_ITEMS,
  tableGroups = [],
  trackingOrders = TRACKING_ORDERS,
  taxRate = 0.1,
  onPlaceOrder,
  onAction,
  onSignOut,
}) {
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [placeError, setPlaceError] = useState('')
  const [customerName, setCustomerName] = useState('Eloise')
  const [tableName, setTableName] = useState('Table 01')
  const [orderType, setOrderType] = useState('Dine In')
  const [discountRate, setDiscountRate] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [trackingSearchOpen, setTrackingSearchOpen] = useState(false)
  const [trackingKeyword, setTrackingKeyword] = useState('')
  const [trackingSort, setTrackingSort] = useState('latest')
  const [trackVisible, setTrackVisible] = useState(true)
  const [stockAlertOpen, setStockAlertOpen] = useState(false)
  const cartIdRef = useRef(1)
  const productSearchInputRef = useRef(null)
  const customerInputRef = useRef(null)
  const stockAlertPanelRef = useRef(null)

  const mergedCategories = useMemo(() => {
    const baseById = new Map(CATEGORY_ITEMS.map((item) => [item.id, item]))
    const mergedBase = CATEGORY_ITEMS.map((baseCategory) => {
      const fromApi = categories.find((item) => item.id === baseCategory.id)
      return {
        ...baseCategory,
        name: fromApi?.name ?? baseCategory.name,
        count: fromApi?.count ?? baseCategory.count,
      }
    })

    const dynamicCategories = categories
      .filter((item) => item.id !== 'all' && !baseById.has(item.id))
      .map((item) => ({
        id: item.id,
        name: item.name,
        count:
          Number.isFinite(Number(item.count))
            ? Number(item.count)
            : products.filter((product) => product.category === item.id).length,
        icon: Coffee,
      }))

    return [...mergedBase, ...dynamicCategories]
  }, [categories, products])

  const deferredSearch = useDeferredValue(searchQuery)
  const keyword = deferredSearch.trim().toLowerCase()
  const filteredProducts = products.filter((product) => {
    const matchesCategory = activeCategory === 'all' || product.category === activeCategory
    const matchesSearch = product.name.toLowerCase().includes(keyword)
    return matchesCategory && matchesSearch
  })
  const allTables = useMemo(() => {
    const values = tableGroups.flatMap((group) =>
      (group.tables ?? []).map((table) => {
        const digits = String(table.id ?? '').replace(/^T-?/i, '')
        return {
          id: String(table.id ?? ''),
          label: digits ? `Table ${digits}` : String(table.id ?? 'Table 01'),
        }
      }),
    )
    if (values.length > 0) return values
    return [{ id: 'T-01', label: 'Table 01' }]
  }, [tableGroups])
  const resolvedTaxRate = Number.isFinite(Number(taxRate)) ? Math.max(0, Number(taxRate)) : 0.1
  const taxLabel = `Tax (${(resolvedTaxRate * 100).toFixed(1).replace(/\.0$/, '')}%)`

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0)
  const tax = subtotal * resolvedTaxRate
  const discount = subtotal * discountRate
  const total = subtotal + tax - discount
  const currency = DEFAULT_CURRENCY
  const formatMoney = (usdAmount) => formatCurrency(usdAmount, currency)
  const resolveStockQty = (product) => {
    const latestProduct = products.find((item) => item.id === product.id) ?? product
    const parsed = Number(latestProduct?.stockQty)
    if (!Number.isFinite(parsed)) return 999
    return Math.max(0, parsed)
  }
  const cartQtyForProduct = (productId) =>
    cart.reduce((sum, item) => (item.product.id === productId ? sum + item.quantity : sum), 0)
  const availableStockForProduct = (product) =>
    Math.max(0, Math.floor(resolveStockQty(product) - cartQtyForProduct(product.id)))
  const filteredTrackingOrders = trackingOrders
    .filter((order) => {
      const keyword = trackingKeyword.trim().toLowerCase()
      if (!keyword) return true
      return (
        order.name.toLowerCase().includes(keyword) ||
        order.table.toLowerCase().includes(keyword) ||
        order.type.toLowerCase().includes(keyword) ||
        order.status.toLowerCase().includes(keyword)
      )
    })
    .slice()
    .sort((a, b) => (trackingSort === 'latest' ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id)))
  const stockAlerts = products
    .map((product) => {
      const qty = Number(product?.stockQty)
      const threshold = Number(product?.stockThreshold)
      if (!Number.isFinite(qty)) return null
      if (qty <= 0) {
        return {
          id: product.id,
          name: product.name,
          stockQty: qty,
          stockThreshold: Number.isFinite(threshold) ? threshold : 0,
          state: 'out',
        }
      }
      if (Number.isFinite(threshold) && qty <= threshold) {
        return {
          id: product.id,
          name: product.name,
          stockQty: qty,
          stockThreshold: threshold,
          state: 'low',
        }
      }
      return null
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.state !== right.state) return left.state === 'out' ? -1 : 1
      return left.stockQty - right.stockQty
    })
  const stockAlertCount = stockAlerts.length
  const stockAlertPreview = stockAlerts.slice(0, 5)

  useEffect(() => {
    if (!stockAlertOpen) return undefined
    const handlePointerDown = (event) => {
      if (stockAlertPanelRef.current?.contains(event.target)) return
      setStockAlertOpen(false)
    }
    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [stockAlertOpen])

  useEffect(() => {
    if (!canOpenInventory) {
      setStockAlertOpen(false)
    }
  }, [canOpenInventory])

  useEffect(() => {
    if (mergedCategories.some((item) => item.id === activeCategory)) return
    setActiveCategory('all')
  }, [activeCategory, mergedCategories])

  useEffect(() => {
    const hasCurrent = allTables.some((table) => table.label === tableName)
    if (!hasCurrent) {
      setTableName(allTables[0]?.label ?? 'Table 01')
    }
  }, [allTables, tableName])

  const goToInventoryFromAlert = () => {
    setStockAlertOpen(false)
    onNavigate('inventory')
  }

  const handleBellToggle = () => {
    setStockAlertOpen((current) => !current)
  }

  const hasAnyStockAlert = products.reduce((totalCount, product) => {
    const qty = Number(product?.stockQty)
    const threshold = Number(product?.stockThreshold)
    if (!Number.isFinite(qty)) return totalCount
    if (qty <= 0) return totalCount + 1
    if (Number.isFinite(threshold) && qty <= threshold) return totalCount + 1
    return totalCount
  }, 0)

  const addToCart = (product, selectedOptions = {}, notes = '', quantity = 1) => {
    const availableQty = availableStockForProduct(product)
    if (availableQty <= 0) {
      onAction?.(`${product.name} is out of stock.`)
      return
    }
    const safeQty = Math.max(1, Math.min(quantity, availableQty))
    const optionTotal = Object.values(selectedOptions).reduce((sum, item) => sum + item.price, 0)
    const itemPrice = product.basePrice + optionTotal
    const cartId = `cart-${cartIdRef.current}`
    cartIdRef.current += 1

    setCart((previous) => [
      ...previous,
      {
        cartId,
        product,
        selectedOptions,
        notes,
        quantity: safeQty,
        itemPrice,
        totalPrice: itemPrice * safeQty,
      },
    ])
    if (safeQty < quantity) {
      onAction?.(`Only ${availableQty} in stock for ${product.name}. Added ${safeQty}.`)
    }
    setSelectedProduct(null)
  }

  const updateCartQuantity = (cartId, delta) => {
    let blockedByStock = ''
    setCart((previous) =>
      previous
        .map((item) => {
          if (item.cartId !== cartId) return item
          const latestProduct = products.find((entry) => entry.id === item.product.id) ?? item.product
          const productStock = Number.isFinite(Number(latestProduct?.stockQty))
            ? Math.max(0, Math.floor(Number(latestProduct.stockQty)))
            : 999
          const qtyInOtherLines = previous.reduce(
            (sum, current) =>
              current.product.id === item.product.id && current.cartId !== cartId ? sum + current.quantity : sum,
            0,
          )
          const maxQuantityForLine = Math.max(0, productStock - qtyInOtherLines)
          if (delta > 0 && item.quantity >= maxQuantityForLine) {
            blockedByStock = item.product.name
            return item
          }
          const nextQuantity = Math.max(0, Math.min(maxQuantityForLine, item.quantity + delta))
          if (nextQuantity === 0) return null
          return {
            ...item,
            quantity: nextQuantity,
            totalPrice: nextQuantity * item.itemPrice,
          }
        })
        .filter(Boolean),
    )
    if (blockedByStock) {
      onAction?.(`${blockedByStock} reached stock limit.`)
    }
  }

  const updateCartNotes = (cartId) => {
    const target = cart.find((item) => item.cartId === cartId)
    if (!target) return
    const nextNote = window.prompt('Update note for this item:', target.notes ?? '')
    if (nextNote === null) return
    setCart((previous) =>
      previous.map((item) => (item.cartId === cartId ? { ...item, notes: nextNote.trim() } : item)),
    )
    if (nextNote.trim()) {
      onAction?.('Item note updated.')
    }
  }

  const clearDraft = () => {
    if (cart.length === 0) return
    const shouldClear = window.confirm('Clear current draft order?')
    if (!shouldClear) return
    setCart([])
    setPlaceError('')
    onAction?.('Draft order cleared.')
  }

  const openPaymentModal = () => {
    if (placingOrder || cart.length === 0) return
    if (!customerName.trim()) {
      setPlaceError('Customer name is required.')
      return
    }
    setPlaceError('')
    setPaymentModalOpen(true)
  }

  const handlePlaceOrder = async (paymentDraft = null) => {
    if (placingOrder || cart.length === 0) return false
    if (!customerName.trim()) {
      setPlaceError('Customer name is required.')
      return false
    }

    const selectedPaymentMethod = paymentDraft?.paymentMethod ?? paymentMethod
    const amountReceived = paymentDraft?.amountReceived ?? total
    const changeAmount = paymentDraft?.changeAmount ?? 0
    const isCashPayment = selectedPaymentMethod === 'Cash'

    if (isCashPayment && amountReceived + 0.000001 < total) {
      setPlaceError('Amount received is less than total payment.')
      return false
    }

    setPlacingOrder(true)
    setPlaceError('')

    try {
      let result = { orderNumber: 'Draft' }
      if (onPlaceOrder) {
        result = await onPlaceOrder({
          customerName,
          tableName,
          orderType,
          paymentMethod: selectedPaymentMethod,
          paymentStatus: 'Paid',
          currency,
          paymentCurrency: currency,
          amountReceived,
          changeAmount,
          subtotal,
          tax,
          discount,
          total,
          items: cart.map((item) => ({
            productId: item.product.id,
            productName: item.product.name,
            quantity: item.quantity,
            itemPrice: item.itemPrice,
            totalPrice: item.totalPrice,
            selectedOptions: item.selectedOptions,
            notes: item.notes,
          })),
        })
      }
      setPaymentMethod(selectedPaymentMethod)
      return result || { orderNumber: 'Draft' }
    } catch (error) {
      setPlaceError(error.message || 'Failed to place order.')
      return false
    } finally {
      setPlacingOrder(false)
    }
  }

  return (
    <div className="grid h-screen w-full grid-cols-1 gap-3 overflow-hidden p-3 md:p-4 xl:grid-cols-[74px_1fr_380px]">
      <aside className="ui-surface hidden rounded-[22px] p-3 xl:flex xl:flex-col xl:items-center xl:justify-between">
        <div className="flex w-full flex-col items-center gap-5">
          <button onClick={onOpenMenu} className="ui-btn ui-btn-primary mt-1 h-11 w-11 rounded-full p-0">
            <Menu size={20} />
          </button>
          {pageItems.map((item) => (
            <RailButton
              key={item.id}
              icon={item.icon}
              active={item.id === 'pos'}
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </div>
        <button onClick={onSignOut} className="ui-btn ui-btn-danger mb-1 h-11 w-11 rounded-full p-0 text-[#FC4A4A]">
          <LogOut size={18} />
        </button>
      </aside>

      <main className="ui-surface flex min-h-0 flex-col overflow-hidden rounded-[22px]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 md:px-6">
          <div className="flex items-center gap-2 text-slate-600">
            <button onClick={onOpenMenu} className="ui-btn ui-btn-ghost rounded-xl p-2 text-slate-500 xl:hidden">
              <Menu size={19} />
            </button>
            <HeaderChip icon={CalendarDays} label={formatDate(now)} />
            <HeaderChip icon={Clock3} label={formatTime(now)} />
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`ui-pill ${
                cart.length > 0 ? 'bg-emerald-50 text-[#1C8370]' : 'bg-red-50 text-[#FC4A4A]'
              }`}
            >
              {cart.length > 0 ? 'Open Order' : 'Close Order'}
            </div>
            {canOpenInventory && (
              <div ref={stockAlertPanelRef} className="relative">
                <button
                  onClick={handleBellToggle}
                  className="ui-btn ui-btn-ghost ui-icon-btn relative text-[#2D71F8] hover:bg-[#2D71F8]/10"
                  title="Open stock alerts"
                >
                  <Bell size={17} />
                  {stockAlertCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#FC4A4A] px-1 text-[10px] font-bold leading-none text-white">
                      {stockAlertCount > 99 ? '99+' : stockAlertCount}
                    </span>
                  )}
                </button>
                {stockAlertOpen && (
                  <div className="ui-surface absolute right-0 top-[calc(100%+8px)] z-20 w-[290px] rounded-xl border-slate-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">Stock Alerts</p>
                      <span className="text-xs text-slate-400">{stockAlertCount} items</span>
                    </div>
                    {hasAnyStockAlert > 0 ? (
                      <div className="space-y-2">
                        {stockAlertPreview.map((alert) => (
                          <div key={`alert-popover-${alert.id}`} className="rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-slate-800">{alert.name}</p>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  alert.state === 'out'
                                    ? 'bg-red-100 text-[#FC4A4A]'
                                    : 'bg-[#2D71F8]/10 text-[#2D71F8]'
                                }`}
                              >
                                {alert.state === 'out' ? 'Out' : 'Low'}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              Stock {alert.stockQty}
                              {alert.state === 'low' ? ` (Threshold ${alert.stockThreshold})` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
                        All stock healthy.
                      </p>
                    )}
                    <button
                      onClick={goToInventoryFromAlert}
                      className="ui-btn ui-btn-primary mt-2 w-full py-2.5 text-xs"
                    >
                      Open Inventory
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={clearDraft}
              className={`ui-btn ui-btn-ghost ui-icon-btn ${
                cart.length > 0
                  ? 'text-[#1C8370] hover:bg-emerald-50'
                  : 'text-[#FC4A4A] hover:bg-red-50'
              }`}
            >
              <Power size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-3">
            {mergedCategories.map((item) => {
              const Icon = item.icon
              const isActive = activeCategory === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveCategory(item.id)}
                  className={`w-[116px] flex-shrink-0 rounded-2xl border p-3 text-left transition-all ${
                    isActive
                      ? 'border-[#2D71F8] bg-[#2D71F8]/[0.03] shadow-[0_10px_18px_rgba(45,113,248,0.14)]'
                      : 'border-slate-100 bg-slate-50/70 hover:bg-slate-100'
                  }`}
                >
                  <div
                    className={`mb-3 inline-flex rounded-full p-2 ${
                      isActive ? 'bg-[#2D71F8] text-white' : 'bg-white text-slate-500'
                    }`}
                  >
                    <Icon size={16} />
                  </div>
                  <p className={`text-sm font-semibold ${isActive ? 'text-[#2D71F8]' : 'text-slate-800'}`}>
                    {item.name}
                  </p>
                  <p className="text-xs text-slate-400">{item.count} Items</p>
                </button>
              )
            })}
          </div>

          <label className="relative my-5 block">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              ref={productSearchInputRef}
              type="text"
              value={searchQuery}
              onChange={(event) => {
                const nextValue = event.target.value
                startTransition(() => setSearchQuery(nextValue))
              }}
              placeholder="Search something sweet or strong..."
              className="ui-input rounded-2xl bg-slate-50/80 py-3 pl-11 pr-4 text-sm font-medium text-slate-700"
            />
          </label>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => {
                  const availableQty = availableStockForProduct(product)
                  if (availableQty <= 0) {
                    onAction?.(`${product.name} is out of stock.`)
                    return
                  }
                  if (product.customizable) {
                    setSelectedProduct(product)
                  } else {
                    addToCart(product)
                  }
                }}
                className={`group flex flex-col rounded-2xl border bg-white p-3 text-left transition-all ${
                  availableStockForProduct(product) <= 0
                    ? 'cursor-not-allowed border-slate-200 opacity-55'
                    : 'border-slate-100 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]'
                }`}
              >
                <div className="mb-3 aspect-square overflow-hidden rounded-2xl bg-slate-50">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <p className="line-clamp-2 text-[15px] font-bold text-slate-900">{product.name}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {product.label}
                  </span>
                  <span className="text-[15px] font-bold text-slate-900">{formatMoney(product.basePrice)}</span>
                </div>
                <p
                  className={`mt-1 text-[11px] font-semibold ${
                    availableStockForProduct(product) <= 0 ? 'text-[#FC4A4A]' : 'text-slate-400'
                  }`}
                >
                  Stock: {Math.max(0, Math.floor(resolveStockQty(product)))}
                </p>
              </button>
            ))}
          </div>
        </div>

        <footer className="border-t border-slate-100 px-4 py-3 md:px-6">
          <div className="mb-2 flex items-center justify-between">
            <button
              onClick={() => setTrackVisible((current) => !current)}
              className="ui-btn ui-btn-primary rounded-full px-3 py-1 text-sm"
            >
              Track Order
            </button>
            <div className="flex items-center gap-2 text-slate-400">
              <button
                onClick={() => {
                  setTrackingSearchOpen((open) => !open)
                  if (trackingSearchOpen) setTrackingKeyword('')
                }}
                className="ui-btn ui-btn-ghost ui-icon-btn h-7 w-7 p-1"
              >
                <Search size={16} />
              </button>
              <button
                onClick={() =>
                  setTrackingSort((current) => (current === 'latest' ? 'oldest' : 'latest'))
                }
                className="ui-btn ui-btn-ghost ui-icon-btn h-7 w-7 p-1"
              >
                <Clock3 size={16} />
              </button>
            </div>
          </div>
          {trackingSearchOpen && (
            <input
              value={trackingKeyword}
              onChange={(event) => setTrackingKeyword(event.target.value)}
              placeholder="Search tracking by customer, table, or status..."
              className="ui-input mb-2 px-3 py-2 text-sm text-slate-700"
            />
          )}
          {trackVisible && (
            <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
              {filteredTrackingOrders.map((order) => (
                <article
                  key={order.id}
                  className="min-w-[220px] rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-xs"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-semibold text-slate-800">{order.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        order.status === 'All Done'
                          ? 'bg-emerald-50 text-[#1C8370]'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <p className="text-slate-400">
                    {order.table} - {order.type}
                  </p>
                  <p className="mt-1 font-medium text-slate-500">{order.time}</p>
                </article>
              ))}
              {filteredTrackingOrders.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-400">
                  No tracked orders match this filter.
                </div>
              )}
            </div>
          )}
        </footer>
      </main>

      <aside className="ui-surface flex min-h-0 flex-col overflow-hidden rounded-[22px]">
        <div className="border-b border-slate-100 p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2D71F8]/10 font-bold text-[#2D71F8]">
                <UserRound size={16} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{customerName || 'Customer Order'}</h2>
                <p className="text-xs text-slate-400">Order Number: Draft</p>
              </div>
            </div>
            <button onClick={() => customerInputRef.current?.focus()} className="ui-btn ui-btn-ghost ui-icon-btn text-slate-400 hover:text-slate-700">
              <Edit2 size={16} />
            </button>
          </div>
          <div className="mb-2">
            <input
              ref={customerInputRef}
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Customer Name"
              className="ui-input px-3 py-2 text-sm font-semibold text-slate-700"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={tableName}
              onChange={(event) => setTableName(event.target.value)}
              className="ui-input px-3 py-2 text-sm font-semibold text-slate-700"
            >
              {allTables.map((table) => (
                <option key={table.id || table.label} value={table.label}>
                  {table.label}
                </option>
              ))}
            </select>
            <select
              value={orderType}
              onChange={(event) => setOrderType(event.target.value)}
              className="ui-input px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <option>Dine In</option>
              <option>Take Away</option>
            </select>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {cart.length === 0 && (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 text-center">
              <Coffee size={36} className="mb-2 text-slate-200" />
              <p className="text-sm font-medium text-slate-400">No item selected yet.</p>
            </div>
          )}
          {cart.map((item) => (
            <article key={item.cartId} className="group flex gap-3">
              <img
                src={item.product.image}
                alt={item.product.name}
                className="h-14 w-14 rounded-xl border border-slate-100 object-cover"
              />
              <div className="flex-1">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-900">{item.product.name}</p>
                  <p className="font-bold text-slate-900">{formatMoney(item.totalPrice)}</p>
                </div>
                {Object.values(item.selectedOptions).length > 0 && (
                  <div className="mb-2 space-y-0.5 text-[12px] text-slate-400">
                    {Object.values(item.selectedOptions).map((option) => (
                      <p key={`${item.cartId}-${option.name}`}>
                        {option.name}
                        {option.price > 0 ? ` (+${formatMoney(option.price)})` : ''}
                      </p>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => updateCartNotes(item.cartId)}
                    className="ui-btn ui-btn-secondary rounded-md border-[#2D71F8]/20 bg-[#2D71F8]/10 p-1.5 text-[#2D71F8] hover:bg-[#2D71F8]/20"
                  >
                    <Paperclip size={13} />
                  </button>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 opacity-80 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => updateCartQuantity(item.cartId, -1)}
                      className="ui-btn ui-btn-ghost rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-4 text-center text-sm font-semibold text-slate-700">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateCartQuantity(item.cartId, 1)}
                      className="ui-btn ui-btn-ghost rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                {item.notes && <p className="mt-1 text-xs text-slate-500">Note: {item.notes}</p>}
              </div>
            </article>
          ))}
        </div>

        <footer className="border-t border-slate-100 bg-white p-5">
          {placeError && (
            <p className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-[#FC4A4A]">
              {placeError}
            </p>
          )}
          <div className="mb-5 space-y-2 text-sm tabular-nums">
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-500">Subtotal</p>
              <p className="font-medium text-slate-700">{formatMoney(subtotal)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-500">{taxLabel}</p>
              <p className="font-medium text-slate-700">{formatMoney(tax)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="font-medium text-[#1C8370]">Discount</p>
              <p className="font-medium text-[#1C8370]">- {formatMoney(discount)}</p>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 pt-3">
              <p className="text-sm font-medium text-slate-500">Total</p>
              <p className="text-2xl font-semibold text-[#2D71F8] tabular-nums">{formatMoney(total)}</p>
            </div>
          </div>
          <div className="mb-4 space-y-2.5">
            <button
              onClick={() =>
                setDiscountRate((current) => {
                  const next = current > 0 ? 0 : 0.1
                  onAction?.(next > 0 ? 'Promo enabled (10% discount).' : 'Promo removed.')
                  return next
                })
              }
              className="ui-btn ui-btn-secondary mb-2 flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm text-slate-600"
            >
              <Percent size={16} className="text-[#1C8370]" />
              {discountRate > 0 ? 'Promo 10% On' : 'Apply Promo 10%'}
            </button>
          </div>
          <button
            onClick={openPaymentModal}
            disabled={placingOrder || cart.length === 0}
            className="ui-btn ui-btn-primary w-full py-3.5 text-base font-semibold disabled:bg-slate-300 disabled:shadow-none"
          >
            {placingOrder ? 'Placing Order...' : 'Place Order'}
          </button>
        </footer>
      </aside>

      {paymentModalOpen && (
        <PaymentModal
          totalAmount={total}
          currency={currency}
          initialPaymentMethod={paymentMethod}
          loading={placingOrder}
          onClose={() => {
            if (placingOrder) return
            setPaymentModalOpen(false)
          }}
          cart={cart}
          customerName={customerName}
          tableName={tableName}
          orderType={orderType}
          subtotal={subtotal}
          tax={tax}
          discount={discount}
          onConfirm={handlePlaceOrder}
          onNewOrder={(receiptData) => {
            setCart([])
            setPaymentModalOpen(false)
            setPaymentMethod(receiptData?.paymentMethod ?? paymentMethod)
            setPlaceError('')
            onAction?.(
              `Order ${receiptData?.orderNumber ?? ''} placed successfully (${receiptData?.paymentMethod ?? paymentMethod}).`,
            )
          }}
        />
      )}

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          currency={currency}
          exchangeRateKHR={4100}
          maxQuantity={availableStockForProduct(selectedProduct)}
          onClose={() => setSelectedProduct(null)}
          onAdd={addToCart}
        />
      )}
    </div>
  )
}
