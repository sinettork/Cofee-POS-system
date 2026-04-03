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
import { CATEGORY_ITEMS, PAGE_ITEMS, PRODUCT_ITEMS, TRACKING_ORDERS } from '../constants/uiData'
import { formatCurrency, formatDate, formatTime } from '@shared/utils/format'

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
    <div className="grid min-h-[100dvh] w-full grid-cols-1 gap-3 overflow-x-hidden bg-white p-3 md:p-4 xl:grid-cols-[74px_minmax(0,1fr)_380px] xl:overflow-hidden">
      <aside className="ui-surface hidden rounded-[24px] p-3 xl:flex xl:flex-col xl:items-center xl:justify-between">
        <div className="flex w-full flex-col items-center gap-5">
          <button onClick={onOpenMenu} className="ui-btn ui-btn-primary mt-1 h-11 w-11 rounded-full p-0 shadow-lg shadow-amber-900/10">
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

      <main className="ui-surface flex min-h-0 flex-col overflow-hidden rounded-[24px]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-4 md:px-6">
          <div className="flex items-center gap-2 text-stone-600">
            <button onClick={onOpenMenu} className="ui-btn ui-btn-ghost rounded-xl p-2 text-stone-500 xl:hidden">
              <Menu size={19} />
            </button>
            <HeaderChip icon={CalendarDays} label={formatDate(now)} />
            <HeaderChip icon={Clock3} label={formatTime(now)} />
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`ui-pill px-3 py-1 font-bold ${
                cart.length > 0 ? 'bg-emerald-50 text-[#1C8370]' : 'bg-red-50 text-[#FC4A4A]'
              }`}
            >
              {cart.length > 0 ? 'Open Order' : 'Close Order'}
            </div>
            {canOpenInventory && (
              <div ref={stockAlertPanelRef} className="relative">
                <button
                  onClick={handleBellToggle}
                  className="ui-btn ui-btn-ghost ui-icon-btn relative text-stone-500 hover:bg-stone-100"
                  title="Open stock alerts"
                >
                  <Bell size={17} />
                  {stockAlertCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#7c4a32] px-1 text-[10px] font-bold leading-none text-white">
                      {stockAlertCount > 99 ? '99+' : stockAlertCount}
                    </span>
                  )}
                </button>
                {stockAlertOpen && (
                  <div className="ui-surface absolute right-0 top-[calc(100%+8px)] z-20 w-[min(290px,calc(100vw-2rem))] rounded-xl border-stone-200 bg-white p-3 shadow-xl">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-stone-900">Stock Alerts</p>
                      <span className="text-xs text-stone-400">{stockAlertCount} items</span>
                    </div>
                    {hasAnyStockAlert > 0 ? (
                      <div className="max-h-[300px] space-y-2 overflow-y-auto">
                        {stockAlertPreview.map((alert) => (
                          <div key={`alert-popover-${alert.id}`} className="rounded-lg border border-stone-100 bg-stone-50/70 px-2.5 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-stone-800">{alert.name}</p>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  alert.state === 'out'
                                    ? 'bg-red-100 text-red-600'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {alert.state === 'out' ? 'Out' : 'Low'}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-stone-500">
                              Stock {alert.stockQty}
                              {alert.state === 'low' ? ` (Threshold ${alert.stockThreshold})` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-2 text-xs text-stone-600">
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
          <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
            {mergedCategories.map((item) => {
              const Icon = item.icon
              const isActive = activeCategory === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveCategory(item.id)}
                  className={`relative flex min-w-[120px] flex-shrink-0 flex-col items-start gap-3 rounded-2xl border p-4 transition-all duration-300 ${
                    isActive
                      ? 'border-[#7c4a32] bg-[#7c4a32] text-white shadow-lg shadow-amber-900/10 -translate-y-1'
                      : 'border-stone-100 bg-white text-stone-600 hover:border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                      isActive ? 'bg-white/20 text-white' : 'bg-stone-50 text-stone-500'
                    }`}
                  >
                    <Icon size={20} />
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${isActive ? 'text-white' : 'text-stone-900'}`}>
                      {item.name}
                    </p>
                    <p className={`text-[10px] font-medium uppercase tracking-wider ${isActive ? 'text-white/60' : 'text-stone-400'}`}>
                      {item.count} Items
                    </p>
                  </div>
                  {isActive && (
                    <div className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                  )}
                </button>
              )
            })}
          </div>

          <label className="relative my-5 block">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input
              ref={productSearchInputRef}
              type="text"
              value={searchQuery}
              onChange={(event) => {
                const nextValue = event.target.value
                startTransition(() => setSearchQuery(nextValue))
              }}
              placeholder="Search something sweet or strong..."
              className="ui-input rounded-2xl bg-stone-50/80 py-3 pl-11 pr-4 text-sm font-medium text-stone-700"
            />
          </label>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-4">
            {filteredProducts.map((product) => {
              const availableQty = availableStockForProduct(product)
              const isOutOfStock = availableQty <= 0
              return (
                <div
                  key={product.id}
                  className={`group relative flex flex-col rounded-3xl border bg-white p-3 transition-all duration-300 ${
                    isOutOfStock
                      ? 'cursor-not-allowed border-stone-100 opacity-60'
                      : 'border-stone-100 hover:-translate-y-1 hover:border-emerald-100 hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)]'
                  }`}
                >
                  <div className="relative mb-3 aspect-square overflow-hidden rounded-2xl bg-stone-50">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <button
                      onClick={() => {
                        if (product.customizable) {
                          setSelectedProduct(product)
                        } else {
                          addToCart(product)
                        }
                      }}
                      className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-xl transition-all duration-300 hover:scale-110 active:scale-90"
                    >
                      {product.customizable ? <Edit2 size={24} /> : <Plus size={28} />}
                    </button>
                  </div>
                    {isOutOfStock && (
                      <div className="absolute inset-0 flex items-center justify-center bg-stone-900/40 backdrop-blur-[2px]">
                        <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-900">
                          Sold Out
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col px-1">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                        {product.label}
                      </span>
                      <span
                        className={`text-[10px] font-bold ${
                          isOutOfStock ? 'text-red-500' : 'text-emerald-600'
                        }`}
                      >
                        {isOutOfStock ? 'No Stock' : `${availableQty} Left`}
                      </span>
                    </div>

                    <h3 className="line-clamp-2 min-h-[40px] text-[15px] font-bold text-stone-800 group-hover:text-emerald-700 transition-colors leading-snug" title={product.name}>
                      {product.name}
                    </h3>

                    <div className="mt-3 flex items-center justify-between border-t border-stone-50 pt-3">
                      <span className="text-lg font-black text-stone-900">
                        {formatMoney(product.basePrice)}
                      </span>
                      {!isOutOfStock && !product.customizable && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            addToCart(product)
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7c4a32] text-white shadow-sm transition-all hover:bg-[#5d3624] hover:shadow-amber-900/20 active:scale-90"
                        >
                          <Plus size={18} />
                        </button>
                      )}
                      {!isOutOfStock && product.customizable && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedProduct(product)
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-600 transition-all hover:bg-emerald-50 hover:text-emerald-600 active:scale-90"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <footer className="border-t border-stone-100 px-4 py-3 md:px-6">
          <div className="mb-2 flex items-center justify-between">
            <button
              onClick={() => setTrackVisible((current) => !current)}
              className="ui-btn ui-btn-primary rounded-full px-3 py-1 text-sm shadow-sm"
            >
              Track Order
            </button>
            <div className="flex items-center gap-2 text-stone-400">
              <button
                onClick={() => {
                  setTrackingSearchOpen((open) => !open)
                  if (trackingSearchOpen) setTrackingKeyword('')
                }}
                className="ui-btn ui-btn-ghost ui-icon-btn h-7 w-7 p-1 hover:bg-stone-100"
              >
                <Search size={16} />
              </button>
              <button
                onClick={() =>
                  setTrackingSort((current) => (current === 'latest' ? 'oldest' : 'latest'))
                }
                className="ui-btn ui-btn-ghost ui-icon-btn h-7 w-7 p-1 hover:bg-stone-100"
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
              className="ui-input mb-2 px-3 py-2 text-sm text-stone-700"
            />
          )}
          {trackVisible && (
            <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
              {filteredTrackingOrders.map((order) => (
                <article
                  key={order.id}
                  className="min-w-[220px] rounded-2xl border border-stone-100 bg-stone-50/70 p-3 text-xs"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-bold text-stone-800">{order.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        order.status === 'All Done'
                          ? 'bg-emerald-50 text-[#1C8370]'
                          : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <p className="text-stone-400">
                    {order.table} - {order.type}
                  </p>
                  <p className="mt-1 font-medium text-stone-500">{order.time}</p>
                </article>
              ))}
              {filteredTrackingOrders.length === 0 && (
                <div className="rounded-xl border border-dashed border-stone-200 px-4 py-3 text-xs text-stone-400">
                  No tracked orders match this filter.
                </div>
              )}
            </div>
          )}
        </footer>
      </main>

      <aside className="ui-surface flex min-h-0 flex-col overflow-hidden rounded-[24px]">
        <div className="border-b border-stone-100 p-5 bg-stone-50/30">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7c4a32] text-white shadow-lg shadow-amber-900/10">
                <UserRound size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-stone-900 leading-tight">{customerName || 'Customer Order'}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Order in Progress</p>
                </div>
              </div>
            </div>
            <button 
              onClick={() => customerInputRef.current?.focus()} 
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-stone-200 text-stone-400 hover:text-stone-900 transition-all hover:shadow-sm"
            >
              <Edit2 size={16} />
            </button>
          </div>
          <div className="space-y-3">
            <div className="relative">
              <input
                ref={customerInputRef}
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Customer Name"
                className="ui-input h-11 px-4 py-2 text-sm font-bold text-stone-800 placeholder:text-stone-300 border-stone-200 focus:border-[#7c4a32] focus:ring-4 focus:ring-amber-900/5"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="relative">
                <select
                  value={tableName}
                  onChange={(event) => setTableName(event.target.value)}
                  className="ui-input h-11 appearance-none px-4 py-2 text-sm font-bold text-stone-800 border-stone-200 focus:border-[#7c4a32] focus:ring-4 focus:ring-amber-900/5"
                >
                  {allTables.map((table) => (
                    <option key={table.id || table.label} value={table.label}>
                      {table.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Menu size={14} />
                </div>
              </div>
              <div className="relative">
                <select
                  value={orderType}
                  onChange={(event) => setOrderType(event.target.value)}
                  className="ui-input h-11 appearance-none px-4 py-2 text-sm font-bold text-stone-800 border-stone-200 focus:border-[#7c4a32] focus:ring-4 focus:ring-amber-900/5"
                >
                  <option>Dine In</option>
                  <option>Take Away</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Menu size={14} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {cart.length === 0 && (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 text-center">
              <Coffee size={36} className="mb-2 text-stone-200" />
              <p className="text-sm font-medium text-stone-400">No item selected yet.</p>
            </div>
          )}
          {cart.map((item) => (
            <article
              key={item.cartId}
              className="group flex gap-4 rounded-2xl bg-stone-50/50 p-2.5 transition-all hover:bg-white hover:shadow-md border border-transparent hover:border-stone-100"
            >
              <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-stone-100 bg-white">
                <img
                  src={item.product.image}
                  alt={item.product.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              <div className="flex-1">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-stone-800 leading-tight">{item.product.name}</p>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                      {item.product.label}
                    </span>
                  </div>
                  <p className="font-black text-stone-900">{formatMoney(item.totalPrice)}</p>
                </div>
                {Object.values(item.selectedOptions).length > 0 && (
                  <div className="mb-2 space-y-0.5 text-[11px] font-medium text-stone-400">
                    {Object.values(item.selectedOptions).map((option) => (
                      <p key={`${item.cartId}-${option.name}`} className="flex items-center gap-1">
                        <span className="h-1 w-1 rounded-full bg-stone-200"></span>
                        {option.name}
                        {option.price > 0 ? (
                          <span className="text-stone-300">(+{formatMoney(option.price)})</span>
                        ) : (
                          ''
                        )}
                      </p>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => updateCartNotes(item.cartId)}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
                        item.notes
                          ? 'border-blue-100 bg-blue-50 text-[#2d71f8]'
                          : 'border-stone-100 bg-white text-stone-400 hover:text-stone-600'
                      }`}
                      title={item.notes || 'Add note'}
                    >
                      <Paperclip size={14} />
                    </button>
                    <button
                      onClick={() => updateCartQuantity(item.cartId, -item.quantity)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-100 bg-white text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      title="Remove from cart"
                    >
                      <LogOut size={14} className="rotate-180" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
                    <button
                      onClick={() => updateCartQuantity(item.cartId, -1)}
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-50 hover:text-stone-800"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="min-w-[20px] text-center text-[13px] font-bold text-stone-800">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateCartQuantity(item.cartId, 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-50 hover:text-stone-800"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                {item.notes && (
                  <p className="mt-2 rounded-lg bg-blue-50/50 p-2 text-[11px] italic text-[#2d71f8]">
                    "{item.notes}"
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>

        <footer className="border-t border-stone-100 bg-white p-5">
          {placeError && (
            <p className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-500">
              {placeError}
            </p>
          )}
          <div className="mb-5 space-y-2 text-sm tabular-nums">
            <div className="flex items-center justify-between">
              <p className="font-medium text-stone-500">Subtotal</p>
              <p className="font-medium text-stone-700">{formatMoney(subtotal)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="font-medium text-stone-500">{taxLabel}</p>
              <p className="font-medium text-stone-700">{formatMoney(tax)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="font-medium text-[#1C8370]">Discount</p>
              <p className="font-medium text-[#1C8370]">- {formatMoney(discount)}</p>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-dashed border-stone-200 pt-3">
              <p className="text-sm font-medium text-stone-500">Payable Amount</p>
              <p className="text-2xl font-black text-[#7c4a32] tabular-nums">{formatMoney(total)}</p>
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
              className="ui-btn ui-btn-secondary mb-2 flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-50"
            >
              <Percent size={16} className="text-[#1C8370]" />
              {discountRate > 0 ? 'Promo 10% On' : 'Apply Promo 10%'}
            </button>
          </div>
          <button
            onClick={openPaymentModal}
            disabled={placingOrder || cart.length === 0}
            className="ui-btn ui-btn-primary w-full py-4 text-lg font-black shadow-lg shadow-amber-900/10 disabled:bg-stone-200 disabled:shadow-none transition-all active:scale-[0.98]"
          >
            {placingOrder ? 'Processing...' : 'Complete Payment'}
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
