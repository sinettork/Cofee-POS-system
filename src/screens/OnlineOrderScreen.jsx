import {
  ArrowRight,
  Loader2,
  MessageSquareText,
  Minus,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  UserRound,
} from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { createPublicOrder, fetchPublicCatalog } from '../api/client'
import { formatCurrency } from '../utils/format'
import { readPublicCart, writePublicCart } from '../utils/publicCart'

function normalizePositiveInteger(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.floor(parsed))
}

export function OnlineOrderScreen() {
  const [catalog, setCatalog] = useState({
    categories: [],
    products: [],
    currency: 'USD',
    taxRate: 10,
  })
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [cart, setCart] = useState([])
  const [cartHydrated, setCartHydrated] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [placingOrder, setPlacingOrder] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [successInfo, setSuccessInfo] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoadingCatalog(true)
    setCatalogError('')
    fetchPublicCatalog(controller.signal)
      .then((payload) => {
        setCatalog({
          categories: Array.isArray(payload?.categories) ? payload.categories : [],
          products: Array.isArray(payload?.products) ? payload.products : [],
          currency: String(payload?.currency ?? 'USD').toUpperCase() === 'KHR' ? 'KHR' : 'USD',
          taxRate: Number(payload?.taxRate ?? 10),
        })
      })
      .catch((error) => {
        setCatalogError(error.message || 'Unable to load products.')
      })
      .finally(() => {
        setLoadingCatalog(false)
      })
    return () => controller.abort()
  }, [])

  const categories = useMemo(() => {
    const publicCategories = Array.isArray(catalog.categories)
      ? catalog.categories.filter((item) => String(item?.id ?? '') !== 'all')
      : []
    return [{ id: 'all', name: 'All', count: catalog.products.length }, ...publicCategories]
  }, [catalog.categories, catalog.products.length])

  useEffect(() => {
    if (categories.some((item) => item.id === activeCategory)) return
    setActiveCategory('all')
  }, [activeCategory, categories])

  useEffect(() => {
    if (loadingCatalog) return
    const productMap = new Map(catalog.products.map((product) => [String(product.id), product]))
    const nextCart = readPublicCart()
      .map((line) => {
        const product = productMap.get(String(line.productId))
        if (!product) return null
        const stockQty = normalizePositiveInteger(product.stockQty)
        if (stockQty <= 0) return null
        const quantity = Math.min(stockQty, normalizePositiveInteger(line.quantity))
        if (quantity <= 0) return null
        return { product, quantity }
      })
      .filter(Boolean)
    setCart(nextCart)
    setCartHydrated(true)
  }, [catalog.products, loadingCatalog])

  useEffect(() => {
    if (!cartHydrated) return
    writePublicCart(
      cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      })),
    )
  }, [cart, cartHydrated])

  const deferredKeyword = useDeferredValue(searchKeyword)
  const keyword = deferredKeyword.trim().toLowerCase()
  const filteredProducts = useMemo(
    () =>
      catalog.products.filter((product) => {
        const inCategory = activeCategory === 'all' || String(product.category) === activeCategory
        if (!inCategory) return false
        if (!keyword) return true
        return String(product.name ?? '').toLowerCase().includes(keyword)
      }),
    [activeCategory, catalog.products, keyword],
  )

  const cartByProductId = useMemo(() => {
    const map = new Map()
    cart.forEach((entry) => map.set(entry.product.id, entry))
    return map
  }, [cart])

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = cart.reduce((sum, item) => sum + Number(item.product.basePrice ?? 0) * item.quantity, 0)
  const taxRate = Number.isFinite(Number(catalog.taxRate)) ? Math.max(0, Number(catalog.taxRate)) / 100 : 0.1
  const tax = subtotal * taxRate
  const total = subtotal + tax
  const formatMoney = (value) => formatCurrency(value, catalog.currency)

  const addToCart = (product) => {
    const stockQty = normalizePositiveInteger(product?.stockQty)
    if (stockQty <= 0) return
    setCart((previous) => {
      const current = previous.find((item) => item.product.id === product.id)
      const nextQty = (current?.quantity ?? 0) + 1
      if (nextQty > stockQty) return previous
      if (current) {
        return previous.map((item) =>
          item.product.id === product.id ? { ...item, quantity: nextQty } : item,
        )
      }
      return [...previous, { product, quantity: 1 }]
    })
    setSubmitError('')
  }

  const updateQuantity = (productId, delta) => {
    setCart((previous) =>
      previous
        .map((item) => {
          if (item.product.id !== productId) return item
          const stockQty = normalizePositiveInteger(item.product?.stockQty)
          const nextQuantity = Math.max(0, Math.min(stockQty, item.quantity + delta))
          if (nextQuantity === 0) return null
          return { ...item, quantity: nextQuantity }
        })
        .filter(Boolean),
    )
    setSubmitError('')
  }

  const handleSubmitOrder = async () => {
    if (placingOrder || cart.length === 0) return
    const trimmedName = customerName.trim()
    if (!trimmedName) {
      setSubmitError('Name is required.')
      return
    }

    setPlacingOrder(true)
    setSubmitError('')
    try {
      const response = await createPublicOrder({
        customerName: trimmedName,
        phone,
        note,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      })
      setSuccessInfo({
        orderNumber: String(response?.orderNumber ?? 'N/A'),
        message: String(response?.message ?? 'Order received.'),
      })
      setCart([])
      setNote('')
    } catch (error) {
      setSubmitError(error.message || 'Unable to place order.')
    } finally {
      setPlacingOrder(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <a href="/" className="text-sm font-bold text-slate-900">Grill & Coffee</a>
          <div className="flex items-center gap-2">
            <a href="/" className="ui-btn ui-btn-secondary rounded-lg px-3 py-1.5 text-xs">
              Website
            </a>
            <a href="/pos" className="ui-btn ui-btn-secondary rounded-lg px-3 py-1.5 text-xs">
              POS
            </a>
            <span className="rounded-full bg-[#2d71f8]/10 px-3 py-1 text-xs font-semibold text-[#2d71f8]">
              {totalItems} items
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:px-8 lg:grid-cols-[1fr_360px]">
        <main className="p-0 md:p-0">
          <header className="mb-5 pb-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#2d71f8]">Order</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">Browse Products</h1>
            <p className="mt-1 text-sm text-slate-500">Select items and place your order.</p>
          </header>

          <label className="relative mb-4 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="Search products..."
              className="ui-input rounded-xl bg-slate-50 py-2.5 pl-10 pr-3 text-sm"
            />
          </label>

          <div className="scrollbar-hide mb-5 flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => {
              const active = category.id === activeCategory
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`ui-btn rounded-full px-4 py-1.5 text-sm ${
                    active
                      ? 'bg-[#2d71f8]/10 text-[#2d71f8]'
                      : 'border border-transparent bg-transparent text-slate-500'
                  }`}
                >
                  {category.name} ({category.count})
                </button>
              )
            })}
          </div>

          {loadingCatalog && (
            <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-200 text-slate-500">
              <Loader2 className="mr-2 animate-spin" size={18} />
              Loading products...
            </div>
          )}

          {!loadingCatalog && catalogError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
              {catalogError}
            </div>
          )}

          {!loadingCatalog && !catalogError && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="hidden grid-cols-[70px_minmax(0,1fr)_120px_110px_120px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 md:grid">
                <span>Image</span>
                <span>Product</span>
                <span>Price</span>
                <span>Stock</span>
                <span className="text-right">Action</span>
              </div>
              {filteredProducts.map((product) => {
                const stockQty = normalizePositiveInteger(product.stockQty)
                const inCartQty = Number(cartByProductId.get(product.id)?.quantity ?? 0)
                const soldOut = stockQty <= 0 || inCartQty >= stockQty
                return (
                  <article
                    key={product.id}
                    className="border-b border-slate-100 px-4 py-3 last:border-b-0"
                  >
                    <div className="hidden grid-cols-[70px_minmax(0,1fr)_120px_110px_120px] items-center gap-3 md:grid">
                      <div className="h-12 w-12 overflow-hidden rounded-md bg-slate-100">
                        <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500">{product.label}</p>
                      </div>
                      <p className="text-sm font-semibold text-[#2d71f8]">{formatMoney(product.basePrice)}</p>
                      <p className="text-sm text-slate-600">{stockQty}</p>
                      <div className="text-right">
                        <button
                          onClick={() => addToCart(product)}
                          disabled={soldOut}
                          className="ui-btn ui-btn-secondary rounded-md px-3 py-1.5 text-xs font-semibold disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          {soldOut ? 'Unavailable' : 'Add'}
                        </button>
                      </div>
                    </div>

                    <div className="md:hidden">
                      <div className="flex gap-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100">
                          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{product.name}</p>
                          <p className="text-xs text-slate-500">{product.label}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-sm font-semibold text-[#2d71f8]">{formatMoney(product.basePrice)}</span>
                            <span className="text-xs text-slate-500">Stock {stockQty}</span>
                          </div>
                          <button
                            onClick={() => addToCart(product)}
                            disabled={soldOut}
                            className="ui-btn ui-btn-secondary mt-2 rounded-md px-3 py-1.5 text-xs font-semibold disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            {soldOut ? 'Unavailable' : 'Add to Cart'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
              {filteredProducts.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-slate-500">No products match your search.</div>
              )}
            </div>
          )}
        </main>

        <aside className="sticky top-4 h-fit rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:p-5">
          <div className="mb-4 flex items-center gap-2">
            <ShoppingBag size={18} className="text-[#2d71f8]" />
            <h2 className="text-lg font-semibold text-slate-900">Order Summary</h2>
          </div>

          {successInfo && (
            <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <p className="font-semibold">Order {successInfo.orderNumber}</p>
              <p>{successInfo.message}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="block">
              <span className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                <UserRound size={13} />
                Name
              </span>
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Your name"
                className="ui-input rounded-lg border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                <Phone size={13} />
                Phone
              </span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone number"
                className="ui-input rounded-lg border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                <MessageSquareText size={13} />
                Note
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional note"
                rows={3}
                className="ui-input resize-none rounded-lg border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="my-4 max-h-[240px] space-y-2 overflow-y-auto">
            {cart.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
                Cart is empty.
              </div>
            )}
            {cart.map((item) => (
              <article key={item.product.id} className="border-b border-slate-200/80 pb-2 last:border-b-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">{item.product.name}</p>
                  <p className="text-sm font-bold text-slate-900">
                    {formatMoney(Number(item.product.basePrice ?? 0) * item.quantity)}
                  </p>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <p className="text-xs text-slate-500">{formatMoney(item.product.basePrice)} each</p>
                  <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1 py-0.5">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="ui-btn ui-btn-ghost rounded-md p-1 text-slate-500"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-5 text-center text-sm font-semibold text-slate-800">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="ui-btn ui-btn-ghost rounded-md p-1 text-slate-500"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {submitError && (
            <p className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
              {submitError}
            </p>
          )}

          <div className="mb-4 space-y-1.5 text-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="font-medium text-slate-700">{formatMoney(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>Tax ({Number((taxRate * 100).toFixed(2))}%)</span>
              <span className="font-medium text-slate-700">{formatMoney(tax)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-2 text-slate-900">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-[#2d71f8]">{formatMoney(total)}</span>
            </div>
          </div>

          <button
            onClick={handleSubmitOrder}
            disabled={placingOrder || cart.length === 0}
            className="ui-btn ui-btn-primary w-full rounded-lg py-3 text-base disabled:bg-slate-300 disabled:shadow-none"
          >
            {placingOrder ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                Place Order
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </aside>
      </div>
    </div>
  )
}
