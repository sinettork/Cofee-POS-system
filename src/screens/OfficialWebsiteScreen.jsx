import {
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Coffee,
  HeartHandshake,
  Leaf,
  Menu,
  MessageCircleHeart,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchPublicCatalog } from '../api/client'
import { formatCurrency } from '../utils/format'
import { PUBLIC_CART_EVENT, addPublicCartItem, getPublicCartCount } from '../utils/publicCart'

const MAIN_NAV = [
  { id: 'home', label: 'Home' },
  { id: 'shop', label: 'Shop' },
]

const ABOUT_NAV = [
  { id: 'story', label: 'Our Story', desc: 'Who we are and our mission' },
  { id: 'tips', label: 'Blog & Tips', desc: 'Coffee advice and guides' },
  { id: 'faq', label: 'FAQ', desc: 'Common questions answered' },
  { id: 'contact', label: 'Contact Us', desc: 'Get in touch with our team' },
]

const TESTIMONIALS = [
  {
    quote:
      'Great quality coffee at a fair price. I like how simple checkout is and delivery is always on time.',
    name: 'Sokha Chan',
    location: 'Phnom Penh',
    badge: 'S',
  },
  {
    quote:
      'The dark roast became our family favorite. Smooth taste, strong aroma, and easy ordering experience.',
    name: 'Dara Pov',
    location: 'Siem Reap',
    badge: 'D',
  },
  {
    quote:
      'I use this every week for office orders. Clean packaging and consistently fresh beans.',
    name: 'Mony Kea',
    location: 'Battambang',
    badge: 'M',
  },
]

const INFO_TILES = [
  {
    icon: Truck,
    title: 'Fast Delivery',
    text: 'Same-day delivery available in Phnom Penh.',
    tone: 'bg-[#edf4ff] text-[#2d71f8]',
  },
  {
    icon: ShieldCheck,
    title: 'Quality Checked',
    text: 'Roast and packaging reviewed before dispatch.',
    tone: 'bg-[#eef8f2] text-[#1c8370]',
  },
  {
    icon: HeartHandshake,
    title: 'Customer Support',
    text: 'Friendly support for order updates and help.',
    tone: 'bg-[#fff1f3] text-[#d94670]',
  },
  {
    icon: Zap,
    title: 'Quick Checkout',
    text: 'Simple ordering flow with minimal steps.',
    tone: 'bg-[#fff7ed] text-[#ea580c]',
  },
]

function ratingByIndex(index) {
  if (index % 4 === 0) return 4.9
  if (index % 3 === 0) return 4.7
  return 4.8
}

function normalizePositiveInteger(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.floor(parsed))
}

export function OfficialWebsiteScreen() {
  const [catalog, setCatalog] = useState({
    products: [],
    currency: 'USD',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [aboutMenuOpen, setAboutMenuOpen] = useState(false)
  const [cartCount, setCartCount] = useState(() => getPublicCartCount())
  const aboutMenuRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchPublicCatalog(controller.signal)
      .then((payload) => {
        setCatalog({
          products: Array.isArray(payload?.products) ? payload.products : [],
          currency: String(payload?.currency ?? 'USD').toUpperCase() === 'KHR' ? 'KHR' : 'USD',
        })
      })
      .catch((requestError) => {
        setError(requestError.message || 'Unable to load product preview.')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!aboutMenuOpen) return undefined
    const handleClickOutside = (event) => {
      if (!aboutMenuRef.current?.contains(event.target)) {
        setAboutMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [aboutMenuOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const syncCartCount = () => setCartCount(getPublicCartCount())
    syncCartCount()
    window.addEventListener('focus', syncCartCount)
    window.addEventListener('storage', syncCartCount)
    window.addEventListener(PUBLIC_CART_EVENT, syncCartCount)
    return () => {
      window.removeEventListener('focus', syncCartCount)
      window.removeEventListener('storage', syncCartCount)
      window.removeEventListener(PUBLIC_CART_EVENT, syncCartCount)
    }
  }, [])

  const products = catalog.products
  const featuredProducts = useMemo(() => products.slice(0, 8), [products])
  const guideProducts = useMemo(() => products.slice(0, 5), [products])
  const tipProducts = useMemo(() => products.slice(0, 3), [products])
  const heroProduct = featuredProducts[0] ?? null
  const promoProduct = featuredProducts[2] ?? heroProduct

  const formatMoney = (value) => formatCurrency(value, catalog.currency)

  const scrollToSection = (sectionId) => {
    if (typeof window === 'undefined') return
    const element = document.getElementById(sectionId)
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.history.replaceState(null, '', `#${sectionId}`)
  }

  const handleNavClick = (event, sectionId) => {
    event.preventDefault()
    setMobileMenuOpen(false)
    setAboutMenuOpen(false)
    scrollToSection(sectionId)
  }

  const handleAddToCart = (product) => {
    const stockQty = normalizePositiveInteger(product?.stockQty)
    if (!product?.id || stockQty <= 0) return
    const nextCart = addPublicCartItem(product.id, 1, { maxQty: stockQty })
    const nextCount = nextCart.reduce((sum, line) => sum + line.quantity, 0)
    setCartCount(nextCount)
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8fc_0%,#eff3fa_100%)] text-slate-800">
      <div className="mx-auto min-h-screen w-full max-w-7xl">
        <header
          id="home"
          className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 py-4 backdrop-blur md:px-7"
        >
          <a href="/" className="flex items-center gap-2 text-slate-900">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#2d71f8] text-white shadow-[0_8px_18px_rgba(45,113,248,0.28)]">
              <Coffee size={18} />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold">Grill & Coffee</p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Cambodia</p>
            </div>
          </a>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-700 lg:flex">
            {MAIN_NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(event) => handleNavClick(event, item.id)}
                className="transition-colors hover:text-[#2d71f8]"
              >
                {item.label}
              </a>
            ))}
            <div className="relative" ref={aboutMenuRef}>
              <button
                onClick={() => setAboutMenuOpen((open) => !open)}
                className={`ui-btn rounded-lg border px-3 py-2 text-sm ${
                  aboutMenuOpen
                    ? 'border-[#2d71f8] bg-[#2d71f8]/10 text-[#2d71f8]'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                About <ChevronDown size={15} />
              </button>
              {aboutMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-[290px] rounded-xl border border-slate-200 bg-white p-2 shadow-[0_18px_36px_rgba(15,23,42,0.12)]">
                  {ABOUT_NAV.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={(event) => handleNavClick(event, item.id)}
                      className="block rounded-lg px-3 py-2.5 hover:bg-slate-50"
                    >
                      <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="/order"
              title="Cart"
              className="ui-btn ui-btn-ghost ui-icon-btn relative h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-700"
            >
              <ShoppingCart size={16} />
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#f43f5e] px-1 text-[10px] font-bold text-white">
                {cartCount}
              </span>
            </a>
            <a href="#contact" onClick={(event) => handleNavClick(event, 'contact')} className="hidden text-sm font-semibold text-slate-600 md:inline">
              Login
            </a>
            <a href="/order" className="ui-btn ui-btn-primary rounded-full px-4 py-2 text-sm">
              Start Order
            </a>
            <button
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="ui-btn ui-btn-ghost ui-icon-btn rounded-full border border-slate-200 bg-white text-slate-700 lg:hidden"
            >
              <Menu size={17} />
            </button>
          </div>
        </header>

        {mobileMenuOpen && (
          <div className="border-b border-slate-200 bg-white px-4 py-3 md:px-7 lg:hidden">
            <nav className="grid grid-cols-2 gap-2">
              {MAIN_NAV.map((item) => (
                <a
                  key={`mobile-main-${item.id}`}
                  href={`#${item.id}`}
                  onClick={(event) => handleNavClick(event, item.id)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700"
                >
                  {item.label}
                </a>
              ))}
              {ABOUT_NAV.map((item) => (
                <a
                  key={`mobile-about-${item.id}`}
                  href={`#${item.id}`}
                  onClick={(event) => handleNavClick(event, item.id)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        )}

        <section className="grid grid-cols-1 gap-6 px-4 pb-8 pt-7 md:px-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-1 rounded-full bg-[#2d71f8]/10 px-3 py-1 text-xs font-semibold text-[#2d71f8]">
              <Sparkles size={13} />
              Cambodia&apos;s premium coffee store
            </p>
            <h1 className="mt-3 max-w-xl text-4xl font-black leading-tight text-slate-900 md:text-[52px]">
              Fresh & Strong Coffee
              <br />
              for Your Daily Ritual
            </h1>
            <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">
              Premium quality coffee in all roast profiles, from mellow to bold. Delivered quickly to your door in Cambodia.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a href="/order" className="ui-btn ui-btn-primary rounded-full px-5 py-3 text-sm font-semibold">
                Shop Now
                <ArrowRight size={14} />
              </a>
              <a href="#shop" onClick={(event) => handleNavClick(event, 'shop')} className="ui-btn ui-btn-secondary rounded-full px-5 py-3 text-sm font-semibold">
                View All Products
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-5 text-sm">
              <div>
                <p className="text-3xl font-black text-slate-900">2K+</p>
                <p className="text-slate-500">Happy Customers</p>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div>
                <p className="text-3xl font-black text-slate-900">{products.length || 8}</p>
                <p className="text-slate-500">Products</p>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div>
                <p className="text-3xl font-black text-slate-900">4.9</p>
                <p className="text-slate-500">Avg Rating</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-[26px] bg-[linear-gradient(135deg,#dce8ff_0%,#e8e0ff_100%)]" />
            <div className="relative rounded-[26px] border border-slate-200 bg-white/80 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.14)]">
              <div className="overflow-hidden rounded-[18px] bg-slate-100">
                {heroProduct ? (
                  <img src={heroProduct.image} alt={heroProduct.name} className="h-[320px] w-full object-cover" />
                ) : (
                  <div className="flex h-[320px] items-center justify-center text-sm text-slate-500">Hero image</div>
                )}
              </div>
              <div className="absolute right-5 top-5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                <p className="text-[#ea580c]">Same-Day</p>
                <p>Phnom Penh</p>
              </div>
              <div className="absolute bottom-5 left-5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                <p className="text-[#1c8370]">Eco-Friendly</p>
                <p>Roast options</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 px-4 pb-8 md:px-7 sm:grid-cols-2 lg:grid-cols-4">
          {INFO_TILES.map((tile) => {
            const Icon = tile.icon
            return (
              <article key={tile.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className={`mb-2 inline-flex rounded-full p-2 ${tile.tone}`}>
                  <Icon size={16} />
                </div>
                <p className="text-sm font-semibold text-slate-800">{tile.title}</p>
                <p className="mt-1 text-xs leading-6 text-slate-500">{tile.text}</p>
              </article>
            )
          })}
        </section>

        <section id="shop" className="border-t border-slate-200 bg-[#f3f5fa] px-4 py-10 md:px-7">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-black text-slate-900">Featured Products</h2>
              <p className="text-sm text-slate-500">Best-selling products loved by Cambodian families</p>
            </div>
            <a href="/order" className="text-sm font-semibold text-[#2d71f8]">
              View all
            </a>
          </div>
          {loading && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              Loading products...
            </div>
          )}
          {!loading && error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {error}
            </div>
          )}
          {!loading && !error && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {featuredProducts.map((product, index) => (
                <article key={product.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="relative aspect-[4/3] bg-slate-100">
                    <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                    <span className="absolute left-2 top-2 rounded-full bg-[#2d71f8]/10 px-2 py-0.5 text-[10px] font-semibold text-[#2d71f8]">
                      {index === 0 ? 'Best Seller' : index === 1 ? 'Popular' : 'Top Rated'}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-[#f59e0b]">★★★★★ <span className="text-slate-400">({ratingByIndex(index)})</span></p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{product.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{product.label}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-lg font-bold text-[#2d71f8]">{formatMoney(product.basePrice)}</p>
                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={normalizePositiveInteger(product.stockQty) <= 0}
                        className="ui-btn ui-btn-primary rounded-full px-3 py-1.5 text-xs disabled:bg-slate-300 disabled:shadow-none"
                      >
                        {normalizePositiveInteger(product.stockQty) <= 0 ? 'Sold Out' : 'Add to Cart'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="border-t border-slate-200 bg-white px-4 py-10 md:px-7">
          <h3 className="text-center text-3xl font-black text-slate-900">Coffee Size Guide</h3>
          <p className="mt-1 text-center text-sm text-slate-500">Choose the right cup size for your comfort</p>
          <div className="mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-5">
            {guideProducts.map((product, index) => (
              <article key={`guide-${product.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                <div className="mx-auto mb-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-lg font-bold text-[#2d71f8]">
                  {['S', 'M', 'L', 'XL', 'XXL'][index] ?? 'S'}
                </div>
                <p className="text-sm font-semibold text-slate-800">{formatMoney(product.basePrice)}</p>
                <p className="text-xs text-slate-500">{product.name.split(' ').slice(0, 2).join(' ')}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="story" className="border-t border-slate-200 bg-[#2355db] px-4 py-12 text-white md:px-7">
          <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[1fr_340px]">
            <div>
              <h3 className="text-4xl font-black">Why Choose Grill & Coffee?</h3>
              <p className="mt-4 max-w-2xl text-white/85">
                We are Cambodia&apos;s trusted online coffee store. Our products meet international quality standards and are crafted for daily satisfaction.
              </p>
              <div className="mt-5 space-y-2 text-sm text-white/90">
                <p className="inline-flex items-center gap-2"><CheckCircle2 size={15} /> Quality-tested and consistent flavor</p>
                <p className="inline-flex items-center gap-2"><CheckCircle2 size={15} /> Multiple roast profiles and sizes</p>
                <p className="inline-flex items-center gap-2"><CheckCircle2 size={15} /> Cash and digital payment options</p>
                <p className="inline-flex items-center gap-2"><CheckCircle2 size={15} /> Fast delivery across Cambodia</p>
              </div>
              <a href="/order" className="ui-btn mt-6 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#2355db]">
                Shop Now
                <ArrowRight size={14} />
              </a>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/25 bg-white/10">
              {promoProduct ? (
                <img src={promoProduct.image} alt={promoProduct.name} className="h-[260px] w-full object-cover" />
              ) : (
                <div className="flex h-[260px] items-center justify-center text-sm text-white/80">Preview image</div>
              )}
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-[#f3f5fa] px-4 py-12 md:px-7">
          <h3 className="text-center text-4xl font-black text-slate-900">What Customers Say</h3>
          <p className="mt-2 text-center text-sm text-slate-500">Real reviews from coffee buyers in Cambodia</p>
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {TESTIMONIALS.map((item) => (
              <article key={item.name} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-[#f59e0b]">★★★★★</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">&quot;{item.quote}&quot;</p>
                <div className="mt-4 flex items-center gap-2">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#2d71f8] text-xs font-bold text-white">
                    {item.badge}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.location}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-slate-200 bg-white px-4 py-10 md:px-7">
          <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#eef3ff_0%,#f4f7ff_100%)] p-8 text-center">
            <h3 className="text-4xl font-black text-slate-900">Ready to Order?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Browse premium coffee and place your order in minutes.
            </p>
            <a href="/order" className="ui-btn ui-btn-primary mt-5 rounded-full px-5 py-3 text-sm">
              Start Shopping
            </a>
          </div>
        </section>

        <section id="tips" className="border-t border-slate-200 bg-[#f3f5fa] px-4 py-10 md:px-7">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-3xl font-black text-slate-900">Coffee Tips & Guides</h3>
              <p className="text-sm text-slate-500">Practical content for better coffee choices</p>
            </div>
            <a href="#blog" onClick={(event) => handleNavClick(event, 'blog')} className="text-sm font-semibold text-[#2d71f8]">
              All articles
            </a>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {tipProducts.map((product, index) => (
              <article key={`tip-${product.id}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="aspect-[4/2.1] bg-slate-100">
                  <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                </div>
                <div className="p-4">
                  <p className="inline-flex items-center gap-1 rounded-full bg-[#2d71f8]/10 px-2 py-0.5 text-[11px] font-semibold text-[#2d71f8]">
                    <BookOpenText size={12} />
                    {index === 0 ? 'Roast Guide' : index === 1 ? 'Brewing Tips' : 'Coffee Care'}
                  </p>
                  <h4 className="mt-2 text-base font-bold text-slate-900">
                    {index === 0
                      ? 'How to Choose the Right Roast for Your Taste'
                      : index === 1
                        ? 'Why Freshly Ground Coffee Improves Your Cup'
                        : '7 Tips to Store Coffee Beans Correctly'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {index === 0
                      ? 'Learn the differences between light, medium, and dark roasts in a simple guide.'
                      : index === 1
                        ? 'Understand grind size, water temperature, and timing for daily brewing.'
                        : 'Avoid stale flavor with simple storage and handling routines.'}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{index === 1 ? 'Mony Kea' : 'Sokha Chan'}</span>
                    <span>{index === 0 ? '5 min read' : index === 1 ? '4 min read' : '6 min read'}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="blog" className="border-t border-slate-200 bg-white px-4 py-10 md:px-7">
          <div className="rounded-2xl bg-[linear-gradient(135deg,#2d71f8_0%,#4338ca_100%)] p-6 text-white md:p-8">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
              <div>
                <p className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                  <CircleUserRound size={13} />
                  Our Story
                </p>
                <h3 className="mt-3 text-3xl font-black">Cambodia&apos;s Trusted Coffee Brand</h3>
                <p className="mt-3 text-white/85">
                  Built in Phnom Penh with a simple mission: reliable quality coffee, fair pricing, and easy digital ordering.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-lg bg-white/10 px-3 py-2">2,000+ Happy Customers</span>
                  <span className="rounded-lg bg-white/10 px-3 py-2">4.9 Avg Rating</span>
                  <span className="rounded-lg bg-white/10 px-3 py-2">25 Provinces Served</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <article className="rounded-xl bg-white/10 p-3">
                  <p className="text-sm font-semibold">Quality Tested</p>
                  <p className="mt-1 text-xs text-white/80">Consistent roast and flavor profile.</p>
                </article>
                <article className="rounded-xl bg-white/10 p-3">
                  <p className="text-sm font-semibold">Eco Options</p>
                  <p className="mt-1 text-xs text-white/80">Sustainable packaging options available.</p>
                </article>
                <article className="rounded-xl bg-white/10 p-3">
                  <p className="text-sm font-semibold">Fast Delivery</p>
                  <p className="mt-1 text-xs text-white/80">Same-day in Phnom Penh.</p>
                </article>
                <article className="rounded-xl bg-white/10 p-3">
                  <p className="text-sm font-semibold">24/7 Support</p>
                  <p className="mt-1 text-xs text-white/80">Always here to help with orders.</p>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="border-t border-slate-200 bg-[#f5f1fb] px-4 py-10 md:px-7">
          <div className="mx-auto max-w-xl text-center">
            <p className="inline-flex items-center gap-1 text-sm font-semibold text-[#2d71f8]">
              <MessageCircleHeart size={15} />
              Stay Updated
            </p>
            <h3 className="mt-2 text-3xl font-black text-slate-900">Subscribe for Offers & Tips</h3>
            <p className="mt-2 text-sm text-slate-600">
              Get coffee brewing tips, exclusive deals, and product alerts in your inbox.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                placeholder="Your email address"
                className="ui-input flex-1 rounded-xl px-4 py-2.5 text-sm"
              />
              <button className="ui-btn ui-btn-primary rounded-xl px-5 py-2.5 text-sm">
                Subscribe
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">No spam. Unsubscribe anytime.</p>
          </div>
        </section>

        <div className="bg-[#2d71f8] px-4 py-3 text-white md:px-7">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="inline-flex items-center gap-2 font-semibold">
              <Leaf size={14} />
              Free shipping on orders over $25 across Cambodia
            </p>
            <a href="/order" className="ui-btn rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#2d71f8]">
              Shop Now
              <ArrowRight size={14} />
            </a>
          </div>
        </div>

        <footer id="contact" className="bg-[#0b1b39] px-4 py-10 text-slate-300 md:px-7">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <a href="/" className="flex items-center gap-2 text-white">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#2d71f8]">
                  <Coffee size={17} />
                </div>
                <div>
                  <p className="text-sm font-bold">Grill & Coffee</p>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Cambodia</p>
                </div>
              </a>
              <p className="mt-4 text-sm leading-7 text-slate-400">
                Trusted coffee brand delivering quality roast and brew products for everyday consumers across Cambodia.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Store</p>
              <div className="mt-3 space-y-2 text-sm">
                <a href="#home" onClick={(event) => handleNavClick(event, 'home')} className="block hover:text-white">Home</a>
                <a href="#shop" onClick={(event) => handleNavClick(event, 'shop')} className="block hover:text-white">Products</a>
                <a href="/order" className="block hover:text-white">My Cart</a>
                <a href="#faq" onClick={(event) => handleNavClick(event, 'faq')} className="block hover:text-white">Track Order</a>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Company</p>
              <div className="mt-3 space-y-2 text-sm">
                <a href="#story" onClick={(event) => handleNavClick(event, 'story')} className="block hover:text-white">About Us</a>
                <a href="#tips" onClick={(event) => handleNavClick(event, 'tips')} className="block hover:text-white">Blog & Tips</a>
                <a href="#faq" onClick={(event) => handleNavClick(event, 'faq')} className="block hover:text-white">FAQ</a>
                <a href="#contact" onClick={(event) => handleNavClick(event, 'contact')} className="block hover:text-white">Contact</a>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Contact</p>
              <div className="mt-3 space-y-2 text-sm text-slate-400">
                <p>123 Monivong Blvd, Phnom Penh</p>
                <p>+855 12 345 678</p>
                <p>hello@grillcoffee.com.kh</p>
              </div>
            </div>
          </div>
          <div className="mt-8 border-t border-white/10 pt-4 text-xs text-slate-500">
            <p>2026 Grill & Coffee Cambodia. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
