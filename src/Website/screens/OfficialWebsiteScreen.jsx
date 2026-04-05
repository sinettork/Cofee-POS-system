import {
  ArrowRight,
  CheckCircle2,
  Briefcase,
  Crosshair,
  Home,
  Loader2,
  LogOut,
  LogIn,
  MapPin,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  Truck,
  User,
  UserRound,
  X,
} from 'lucide-react'
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createPublicOrder,
  createPublicDeliveryOrder,
  logoutPublicCustomer,
  updatePublicCustomerProfile,
} from '@shared/api/client'
import { formatCurrency } from '@shared/utils/format'
import {
  PUBLIC_CART_EVENT,
  addPublicCartItem,
  getPublicCartCount,
  readPublicCart,
  writePublicCart,
} from '@shared/utils/publicCart'
import { MARQUEE_ITEMS, NAV_LINKS } from '../constants/websiteContent'
import { usePublicCatalog } from '../hooks/usePublicCatalog'
import { usePublicCustomerSession } from '../hooks/usePublicCustomerSession'
import { usePublicPaymentConfig } from '../hooks/usePublicPaymentConfig'
import { useSavedAddresses } from '../hooks/useSavedAddresses'
import { WebsiteCheckoutPaymentPanel } from '../sections/WebsiteCheckoutPaymentPanel'
import { WebsiteMarketingSections } from '../sections/WebsiteMarketingSections'
import {
  deriveProductEmoji,
  hydrateCartLines,
  normalizePositiveInteger,
  parseCoordinatesFromText,
} from '../utils/websiteHelpers'
import './OfficialWebsiteScreen.css'

const LeafletAddressPicker = lazy(() => import('@shared/components/LeafletAddressPicker.jsx'))

export function OfficialWebsiteScreen({ checkoutPage = false }) {
  const { catalog, loading, error } = usePublicCatalog()
  const [activeCategory, setActiveCategory] = useState('all')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [cartCount, setCartCount] = useState(() => getPublicCartCount())
  const [cartLines, setCartLines] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const [orderType, setOrderType] = useState('takeaway') // 'takeaway' or 'delivery'
  const [deliveryPhone, setDeliveryPhone] = useState('')
  const { customerSession, setCustomerSession, customerReady } = usePublicCustomerSession()
  const { paymentConfig } = usePublicPaymentConfig()
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileLocating, setProfileLocating] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileFullName, setProfileFullName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [profileAddress, setProfileAddress] = useState('')
  const [selectedCoordinates, setSelectedCoordinates] = useState(null)
  const [locationResolving, setLocationResolving] = useState(false)
  const [profileMapOpen, setProfileMapOpen] = useState(false)
  const [checkoutMapOpen, setCheckoutMapOpen] = useState(true)
  const { savedAddresses, persistSavedAddresses } = useSavedAddresses()
  const [placingOrder, setPlacingOrder] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutSuccess, setCheckoutSuccess] = useState('')
  const [latestOrder, setLatestOrder] = useState(null)
  const [trackingNow, setTrackingNow] = useState(() => Date.now())
  const [addedState, setAddedState] = useState({})
  const pageRef = useRef(null)
  const profilePanelRef = useRef(null)

  useEffect(() => {
    if (!customerSession) return
    setProfileFullName(String(customerSession.fullName ?? ''))
    setProfileEmail(String(customerSession.email ?? ''))
    setProfilePhone(String(customerSession.phone ?? ''))
    const nextAddress = String(customerSession.address ?? '')
    setProfileAddress(nextAddress)
    setSelectedCoordinates(parseCoordinatesFromText(nextAddress))
    if (!customerName.trim()) setCustomerName(String(customerSession.fullName ?? ''))
    if (!customerPhone.trim()) setCustomerPhone(String(customerSession.phone ?? ''))
  }, [customerName, customerPhone, customerSession])

  useEffect(() => {
    if (customerSession) return
    setProfileOpen(false)
    setProfileError('')
    setProfileSuccess('')
    setProfileFullName('')
    setProfileEmail('')
    setProfilePhone('')
    setProfileAddress('')
    setSelectedCoordinates(null)
    setProfileMapOpen(false)
  }, [customerSession])

  useEffect(() => {
    const parsed = parseCoordinatesFromText(profileAddress)
    if (!parsed) return
    setSelectedCoordinates(parsed)
  }, [profileAddress])

  const syncCartFromStorage = useCallback(() => {
    const rawLines = readPublicCart()
    if (!Array.isArray(catalog.products) || catalog.products.length === 0) {
      setCartCount(rawLines.reduce((sum, line) => sum + Number(line?.quantity ?? 0), 0))
      return
    }
    const normalizedLines = hydrateCartLines(catalog.products, rawLines)
    setCartLines(normalizedLines)
    setCartCount(normalizedLines.reduce((sum, line) => sum + line.quantity, 0))

    const normalizedRaw = normalizedLines.map((line) => ({
      productId: line.product.id,
      quantity: line.quantity,
    }))
    if (JSON.stringify(normalizedRaw) !== JSON.stringify(rawLines)) {
      writePublicCart(normalizedRaw)
    }
  }, [catalog.products])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const syncTimer = window.setTimeout(syncCartFromStorage, 0)
    window.addEventListener('focus', syncCartFromStorage)
    window.addEventListener('storage', syncCartFromStorage)
    window.addEventListener(PUBLIC_CART_EVENT, syncCartFromStorage)
    return () => {
      window.clearTimeout(syncTimer)
      window.removeEventListener('focus', syncCartFromStorage)
      window.removeEventListener('storage', syncCartFromStorage)
      window.removeEventListener(PUBLIC_CART_EVENT, syncCartFromStorage)
    }
  }, [syncCartFromStorage])

  useEffect(() => {
    if (!pageRef.current) return undefined
    const elements = pageRef.current.querySelectorAll('.eloise-reveal')
    if (elements.length === 0) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('visible')
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.1 },
    )
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [catalog.products.length, loading])

  useEffect(() => {
    if (!profileOpen) return undefined
    const handlePointerDown = (event) => {
      if (!profilePanelRef.current) return
      if (profilePanelRef.current.contains(event.target)) return
      setProfileOpen(false)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [profileOpen])

  useEffect(() => {
    if (!latestOrder) return undefined
    const timer = window.setInterval(() => setTrackingNow(Date.now()), 15000)
    return () => window.clearInterval(timer)
  }, [latestOrder])

  const menuTabs = useMemo(() => {
    const fromCatalog = Array.isArray(catalog.categories)
      ? catalog.categories.filter((item) => String(item?.id ?? '') !== 'all')
      : []
    if (fromCatalog.length > 0) {
      return [{ id: 'all', name: 'All Items' }, ...fromCatalog.map((item) => ({ id: item.id, name: item.name }))]
    }

    const fallbackMap = new Map()
    catalog.products.forEach((product) => {
      const id = String(product.category ?? '').trim()
      if (!id) return
      if (!fallbackMap.has(id)) fallbackMap.set(id, id.charAt(0).toUpperCase() + id.slice(1))
    })
    return [{ id: 'all', name: 'All Items' }, ...Array.from(fallbackMap.entries()).map(([id, name]) => ({ id, name }))]
  }, [catalog.categories, catalog.products])

  const resolvedActiveCategory = menuTabs.some((tab) => tab.id === activeCategory)
    ? activeCategory
    : 'all'

  const filteredProducts = useMemo(() => {
    if (resolvedActiveCategory === 'all') return catalog.products
    return catalog.products.filter((product) => String(product.category ?? '') === resolvedActiveCategory)
  }, [resolvedActiveCategory, catalog.products])

  const heroProduct = catalog.products[0] ?? null
  const menuCount = catalog.products.length
  const happyCustomerCount = Math.max(19, menuCount)
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const formatMoney = (amount) => formatCurrency(amount, catalog.currency)
  const resolvedTaxRate = Number.isFinite(Number(catalog.taxRate))
    ? Math.max(0, Number(catalog.taxRate)) / 100
    : 0.1
  const subtotal = cartLines.reduce(
    (sum, line) => sum + Number(line.product?.basePrice ?? 0) * line.quantity,
    0,
  )
  const taxAmount = subtotal * resolvedTaxRate
  const totalAmount = subtotal + taxAmount
  const roundedTotalAmount = Number(totalAmount.toFixed(2))
  const hasStaticKhqr = Boolean(paymentConfig?.khqr?.enabled && paymentConfig?.khqr?.qr)
  const isLocatingAddress = profileLocating || locationResolving
  const trackingElapsedMinutes = latestOrder
    ? Math.max(0, Math.floor((trackingNow - Number(latestOrder.placedAt ?? 0)) / 60000))
    : 0
  const trackingStage =
    trackingElapsedMinutes >= 35
      ? 3
      : trackingElapsedMinutes >= 20
        ? 2
        : trackingElapsedMinutes >= 8
          ? 1
          : 0
  const trackingEtaMinutes = latestOrder
    ? Math.max(0, Number(latestOrder.etaMinutes ?? 35) - trackingElapsedMinutes)
    : 0
  const checkoutButtonLabel =
    !customerSession?.id
      ? 'Login Required'
      : placingOrder
        ? 'Placing Order...'
        : paymentMethod === 'Cash'
          ? `Place Cash on ${orderType === 'delivery' ? 'Delivery' : 'Takeaway'} Order`
          : paymentMethod === 'KHQR'
            ? `Place KHQR ${orderType === 'delivery' ? 'Delivery' : 'Takeaway'} Order`
            : `Place ${orderType === 'delivery' ? 'Delivery' : 'Takeaway'} Order`
  const visibleNavLinks = checkoutPage ? [{ href: '/', label: 'Website' }] : NAV_LINKS

  const openCheckoutPage = () => {
    if (typeof window === 'undefined') return
    if (window.location.pathname.toLowerCase().startsWith('/cart')) return
    window.location.assign('/cart')
  }

  const openHomePage = () => {
    if (typeof window === 'undefined') return
    if (window.location.pathname === '/') return
    window.location.assign('/')
  }

  const openCustomerAuthPage = () => {
    if (typeof window === 'undefined') return
    window.location.assign('/account')
  }

  const handleProfileButtonClick = () => {
    if (!customerSession?.id) {
      openCustomerAuthPage()
      return
    }
    setProfileOpen((previous) => !previous)
    setProfileError('')
    setProfileSuccess('')
  }

  const handleSaveProfile = async () => {
    if (!customerSession?.id || profileSaving) return
    setProfileSaving(true)
    setProfileError('')
    setProfileSuccess('')
    try {
      const payload = await updatePublicCustomerProfile({
        fullName: profileFullName.trim(),
        email: profileEmail.trim(),
        phone: profilePhone.trim(),
        address: profileAddress.trim(),
      })
      const nextCustomer = payload?.customer ?? null
      if (nextCustomer) {
        setCustomerSession(nextCustomer)
      }
      setProfileSuccess('Profile updated.')
    } catch (requestError) {
      setProfileError(String(requestError?.message || 'Unable to update profile.'))
    } finally {
      setProfileSaving(false)
    }
  }

  const handleSignOutProfile = async () => {
    try {
      await logoutPublicCustomer()
    } finally {
      setCustomerSession(null)
      setProfileOpen(false)
    }
  }

  const applySavedAddress = (key) => {
    const next = String(savedAddresses?.[key] ?? '').trim()
    if (!next) {
      setProfileError(`No ${key} address saved yet.`)
      setProfileSuccess('')
      return
    }
    setProfileAddress(next)
    setProfileError('')
    setProfileSuccess(`${key === 'home' ? 'Home' : 'Work'} address applied.`)
  }

  const saveAddressPreset = (key) => {
    const address = profileAddress.trim()
    if (!address) {
      setProfileError('Enter an address before saving preset.')
      setProfileSuccess('')
      return
    }
    const next = {
      ...savedAddresses,
      [key]: address,
    }
    persistSavedAddresses(next)
    setProfileError('')
    setProfileSuccess(`${key === 'home' ? 'Home' : 'Work'} address saved.`)
  }

  const resolveAddressFromCoordinates = async (coordinates, options = {}) => {
    const lat = Number(coordinates?.lat)
    const lng = Number(coordinates?.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    const normalized = {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
    }
    const googleMapLink = `https://www.google.com/maps?q=${normalized.lat},${normalized.lng}`
    const successMessage = String(options.successMessage ?? 'Location selected.')

    setLocationResolving(true)
    setProfileError('')
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${normalized.lat}&lon=${normalized.lng}&zoom=18&addressdetails=1`,
      )
      if (!response.ok) {
        throw new Error(`Address lookup failed (${response.status}).`)
      }
      const payload = await response.json()
      const displayName = String(payload?.display_name ?? '').trim()
      if (displayName) {
        setProfileAddress(`${displayName} (${googleMapLink})`)
      } else {
        setProfileAddress(`Near ${normalized.lat}, ${normalized.lng} (${googleMapLink})`)
      }
      setProfileSuccess(successMessage)
    } catch {
      setProfileAddress(`Near ${normalized.lat}, ${normalized.lng} (${googleMapLink})`)
      setProfileError('Address lookup is unavailable right now, but coordinates were captured.')
    } finally {
      setLocationResolving(false)
    }
  }

  const handleMapPick = (coordinates) => {
    const lat = Number(coordinates?.lat)
    const lng = Number(coordinates?.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    const normalized = {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
    }
    setSelectedCoordinates(normalized)
    void resolveAddressFromCoordinates(normalized, { successMessage: 'Map pin updated.' })
  }

  const handleDetectCurrentLocation = () => {
    if (profileLocating) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setProfileError('Current location is not available in this browser.')
      return
    }
    setProfileLocating(true)
    setProfileError('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = {
          lat: Number(Number(position?.coords?.latitude ?? 0).toFixed(6)),
          lng: Number(Number(position?.coords?.longitude ?? 0).toFixed(6)),
        }
        setSelectedCoordinates(coordinates)
        void resolveAddressFromCoordinates(coordinates, { successMessage: 'Current location detected.' })
        setProfileLocating(false)
      },
      (error) => {
        setProfileError(error?.message || 'Unable to detect current location.')
        setProfileLocating(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    )
  }

  const handleAddToCart = (productId, stockQty) => {
    const safeId = String(productId ?? '').trim()
    const maxQty = normalizePositiveInteger(stockQty)
    if (!safeId || maxQty <= 0) return
    addPublicCartItem(safeId, 1, { maxQty })
    syncCartFromStorage()
    setCheckoutError('')
    setCheckoutSuccess('')
    setAddedState((previous) => ({ ...previous, [safeId]: true }))
    window.setTimeout(() => {
      setAddedState((previous) => {
        const next = { ...previous }
        delete next[safeId]
        return next
      })
    }, 1400)
  }

  const updateCartLineQuantity = (productId, delta) => {
    const safeId = String(productId ?? '').trim()
    if (!safeId) return
    const product = catalog.products.find((item) => String(item.id) === safeId)
    const maxQty = normalizePositiveInteger(product?.stockQty)
    if (!product || maxQty <= 0) return

    const currentRaw = readPublicCart()
    const nextRaw = []
    let found = false
    currentRaw.forEach((line) => {
      if (String(line.productId) !== safeId) {
        nextRaw.push(line)
        return
      }
      found = true
      const nextQty = Math.max(0, Math.min(maxQty, normalizePositiveInteger(line.quantity) + delta))
      if (nextQty > 0) {
        nextRaw.push({ productId: safeId, quantity: nextQty })
      }
    })
    if (!found && delta > 0) {
      nextRaw.push({ productId: safeId, quantity: 1 })
    }
    writePublicCart(nextRaw)
    syncCartFromStorage()
    setCheckoutError('')
    setCheckoutSuccess('')
  }

  const removeCartLine = (productId) => {
    const safeId = String(productId ?? '').trim()
    if (!safeId) return
    const nextRaw = readPublicCart().filter((line) => String(line.productId) !== safeId)
    writePublicCart(nextRaw)
    syncCartFromStorage()
    setCheckoutError('')
    setCheckoutSuccess('')
  }

  const submitPublicOrder = async (selectedMethod) => {
    const safeName = customerName.trim()

    if (orderType === 'delivery') {
      // Delivery order
      if (!profileAddress.trim()) {
        setCheckoutError('Delivery address is required.')
        return
      }
      const phoneForDelivery = deliveryPhone.trim() || customerPhone.trim()
      if (!phoneForDelivery) {
        setCheckoutError('Phone number is required for delivery.')
        return
      }

      const response = await createPublicDeliveryOrder({
        customerName: safeName,
        deliveryAddress: profileAddress.trim(),
        deliveryPhone: phoneForDelivery,
        deliveryNote: customerNote.trim(),
        paymentMethod: selectedMethod,
        paymentStatus: selectedMethod === 'KHQR' || selectedMethod === 'Card' ? 'Paid' : 'Paid',
        items: cartLines.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
        })),
      })
      writePublicCart([])
      syncCartFromStorage()

      // Save order ID and redirect to tracking page
      localStorage.setItem('current-delivery-order-id', String(response.orderId))
      setCheckoutSuccess(`Delivery order ${String(response?.orderNumber ?? 'N/A')} confirmed!`)
      setLatestOrder({
        orderNumber: String(response?.orderNumber ?? 'N/A'),
        paymentMethod: selectedMethod,
        placedAt: Date.now(),
        etaMinutes: 35,
      })

      // Reset form
      setCustomerName('')
      setCustomerPhone('')
      setDeliveryPhone('')
      setCustomerNote('')
      setPaymentMethod('Cash')

      // Redirect to tracking page after 2 seconds
      setTimeout(() => {
        window.location.href = `/delivery-tracking?orderId=${response.orderId}`
      }, 2000)
    } else {
      // Takeaway order
      const response = await createPublicOrder({
        customerName: safeName,
        phone: customerPhone.trim(),
        address: profileAddress.trim(),
        note: customerNote.trim(),
        paymentMethod: selectedMethod,
        items: cartLines.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
        })),
      })
      writePublicCart([])
      syncCartFromStorage()
      setCheckoutSuccess(
        `Order ${String(response?.orderNumber ?? 'N/A')} submitted with ${selectedMethod} payment.`,
      )
      setLatestOrder({
        orderNumber: String(response?.orderNumber ?? 'N/A'),
        paymentMethod: selectedMethod,
        placedAt: Date.now(),
        etaMinutes: 35,
      })
      setCustomerName('')
      setCustomerPhone('')
      setCustomerNote('')
      setPaymentMethod('Cash')
    }
  }

  const handleCheckout = async () => {
    if (placingOrder) return
    if (!customerSession?.id) {
      setCheckoutError('Please login with phone number or Gmail before checkout.')
      return
    }
    if (cartLines.length === 0) {
      setCheckoutError('Your cart is empty.')
      return
    }
    const safeName = customerName.trim()
    if (!safeName) {
      setCheckoutError('Customer name is required.')
      return
    }

    // Delivery-specific validation
    if (orderType === 'delivery') {
      if (!profileAddress.trim()) {
        setCheckoutError('Delivery address is required.')
        return
      }
      const phoneForDelivery = deliveryPhone.trim() || customerPhone.trim()
      if (!phoneForDelivery) {
        setCheckoutError('Phone number is required for delivery.')
        return
      }
    }

    if (paymentMethod === 'KHQR' && !hasStaticKhqr) {
      setCheckoutError('KHQR is not configured yet. Please choose Cash on Delivery.')
      return
    }

    setPlacingOrder(true)
    setCheckoutError('')
    setCheckoutSuccess('')
    try {
      await submitPublicOrder(paymentMethod)
    } catch (requestError) {
      setCheckoutError(String(requestError?.message || 'Unable to process payment.'))
    } finally {
      setPlacingOrder(false)
    }
  }

  return (
    <div className="eloise-page" ref={pageRef}>
      <nav className="eloise-nav">
        <div className="eloise-nav-container">
          <a href={checkoutPage ? '/' : '#top'} className="eloise-nav-logo">
            <span>Eloise</span> Coffee
          </a>
          <ul className="eloise-nav-links">
            {visibleNavLinks.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
          <button
            className="eloise-nav-menu-btn"
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? 'Close' : 'Menu'}
          </button>
          <div className="eloise-nav-actions">
            <button
              type="button"
              className="eloise-nav-cart-btn"
              onClick={checkoutPage ? openHomePage : openCheckoutPage}
              aria-label={checkoutPage ? 'Back to website' : 'Go to checkout page'}
            >
              <ShoppingCart size={16} />
              <span className="eloise-nav-cart-count">{cartCount}</span>
            </button>
            <button
              type="button"
              className={`eloise-nav-profile-btn ${customerSession?.id ? 'logged-in' : ''}`}
              onClick={handleProfileButtonClick}
              aria-label={customerSession?.id ? 'Account profile' : 'Login'}
              aria-expanded={profileOpen}
            >
              {customerSession ? <User size={14} /> : <LogIn size={14} />}
            </button>
            {customerSession?.id && (
              <>
                {profileOpen && (
                  <div
                    className="eloise-profile-overlay"
                    onClick={() => setProfileOpen(false)}
                  />
                )}
                <section className={`eloise-profile-drawer ${profileOpen ? 'open' : ''}`} ref={profilePanelRef}>
                  <header className="eloise-profile-header">
                    <div>
                      <p>Account</p>
                      <h4>{profileFullName || customerSession.fullName || 'Customer'}</h4>
                    </div>
                    <button type="button" className="eloise-profile-close" onClick={() => setProfileOpen(false)}>
                      <X size={20} />
                    </button>
                  </header>

                  <div className="eloise-profile-content">
                    <div className="eloise-profile-form">
                      <label>
                        Full Name
                        <input
                          type="text"
                          value={profileFullName}
                          onChange={(event) => setProfileFullName(event.target.value)}
                          placeholder="Your full name"
                        />
                      </label>
                      <label>
                        Email Address
                        <input
                          type="email"
                          value={profileEmail}
                          onChange={(event) => setProfileEmail(event.target.value)}
                          placeholder="name@gmail.com"
                        />
                      </label>
                      <label>
                        Phone Number
                        <input
                          type="text"
                          value={profilePhone}
                          onChange={(event) => setProfilePhone(event.target.value)}
                          placeholder="Phone number"
                        />
                      </label>
                      <label>
                        Delivery Address
                        <textarea
                          rows={3}
                          value={profileAddress}
                          onChange={(event) => setProfileAddress(event.target.value)}
                          placeholder="Street, Building, Apartment..."
                        />
                      </label>

                      <div className="eloise-address-presets-v2">
                        <div className="preset-item">
                          <Home size={14} />
                          <span>Home</span>
                          <div className="preset-actions">
                            <button type="button" onClick={() => applySavedAddress('home')}>Apply</button>
                            <button type="button" className="save" onClick={() => saveAddressPreset('home')}>Set</button>
                          </div>
                        </div>
                        <div className="preset-item">
                          <Briefcase size={14} />
                          <span>Work</span>
                          <div className="preset-actions">
                            <button type="button" onClick={() => applySavedAddress('work')}>Apply</button>
                            <button type="button" className="save" onClick={() => saveAddressPreset('work')}>Set</button>
                          </div>
                        </div>
                      </div>

                      <div className="eloise-profile-map-section">
                        <button
                          type="button"
                          className={`eloise-map-trigger ${profileMapOpen ? 'active' : ''}`}
                          onClick={() => setProfileMapOpen((open) => !open)}
                        >
                          <MapPin size={14} />
                          <span>{profileMapOpen ? 'Close Map Picker' : 'Pick Location on Map'}</span>
                        </button>

                        {profileMapOpen && (
                          <div className="eloise-map-container-v2">
                            <Suspense fallback={<div className="eloise-map-loading">Loading map...</div>}>
                              <LeafletAddressPicker coordinates={selectedCoordinates} onPickCoordinates={handleMapPick} />
                            </Suspense>
                            <div className="map-hint">Drag or tap to set exact coordinates</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <footer className="eloise-profile-footer">
                    <div className="action-row">
                      <button type="button" className="detect-btn" onClick={handleDetectCurrentLocation} disabled={isLocatingAddress}>
                        {isLocatingAddress ? <Loader2 size={14} className="eloise-spin" /> : <Crosshair size={14} />}
                        <span>Locate Me</span>
                      </button>
                      <button type="button" className="save-btn" onClick={handleSaveProfile} disabled={profileSaving}>
                        {profileSaving ? <Loader2 size={14} className="eloise-spin" /> : <CheckCircle2 size={14} />}
                        <span>Update Profile</span>
                      </button>
                    </div>
                    <button type="button" className="logout-btn" onClick={handleSignOutProfile}>
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  </footer>

                  {profileError && <div className="eloise-status-msg error">{profileError}</div>}
                  {profileSuccess && <div className="eloise-status-msg success">{profileSuccess}</div>}
                </section>
              </>
            )}
          </div>
        </div>
      </nav>
      {mobileMenuOpen && (
        <div className="eloise-mobile-menu">
          {visibleNavLinks.map((item) => (
            <a
              key={`mobile-${item.href}`}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <button
            type="button"
            className="eloise-mobile-order"
            onClick={() => {
              setMobileMenuOpen(false)
              if (checkoutPage) {
                openHomePage()
                return
              }
              openCheckoutPage()
            }}
          >
            <ArrowRight size={14} />
            <span>{checkoutPage ? 'Back to Website' : `Go to Checkout (${cartCount})`}</span>
          </button>
          <button
            type="button"
            className="eloise-mobile-order"
            onClick={() => {
              setMobileMenuOpen(false)
              handleProfileButtonClick()
            }}
          >
            {customerSession?.id ? <UserRound size={14} /> : <LogIn size={14} />}
            <span>{customerSession?.id ? 'Profile' : 'Login / Register'}</span>
          </button>
        </div>
      )}

      {!checkoutPage && (
        <section className="eloise-hero" id="top">
          <div className="eloise-hero-text">
            <div className="eloise-hero-tag">Est. 2024 · Specialty Coffee</div>
            <h1>
              Every Cup
              <br />
              is a <em>Story</em>
              <br />
              Worth Sipping
            </h1>
            <p>
              Artisan coffee crafted with passion, seasonal pastries baked fresh daily, and a corner of the world made just for you.
            </p>
            <div className="eloise-hero-actions">
              <a href="#menu" className="eloise-btn-primary">
                <span>Explore Menu</span>
                <ArrowRight size={14} />
              </a>
              <a href="#about" className="eloise-btn-ghost">
                <span>Our Story</span>
                <ArrowRight size={14} />
              </a>
            </div>
          </div>
          <div className="eloise-hero-visual">
            <div className="eloise-hero-img-wrap">
              <div className="eloise-hero-img-bg" />
              {heroProduct?.image ? (
                <img src={heroProduct.image} alt={heroProduct.name} className="eloise-hero-image" />
              ) : (
                <div className="eloise-hero-coffee-cup">☕</div>
              )}
              <div className="eloise-hero-badge">
                <strong>4.9★</strong>
                Guest Rating
              </div>
              <div className="eloise-hero-badge2">
                <strong>{menuCount}+</strong>
                Menu Items
              </div>
            </div>
          </div>
        </section>
      )}

      {!checkoutPage && (
        <div className="eloise-marquee-wrap">
          <div className="eloise-marquee-track">
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, index) => (
              <div className="eloise-marquee-item" key={`${item}-${index}`}>{item}</div>
            ))}
          </div>
        </div>
      )}

      {!checkoutPage && (
        <section className="eloise-about" id="about">
          <div className="eloise-about-img eloise-reveal">
            <div className="eloise-about-img-main">☕</div>
            <div className="eloise-about-float">
              <strong>100%</strong>
              <span>Arabica Beans</span>
            </div>
          </div>
          <div className="eloise-reveal">
            <div className="eloise-section-label">About Us</div>
            <h2>
              More Than Coffee
              <br />
              It is a <em>Ritual</em>
            </h2>
            <p>
              At Eloise Coffee, we believe every morning deserves a moment of calm. Our baristas are trained to coax the best from every bean while honoring the craft.
            </p>
            <p>
              We source single-origin beans from sustainable farms, roast in small batches, and pair every cup with pastries made fresh each day before dawn.
            </p>
            <div className="eloise-about-stats">
              <div>
                <div className="eloise-stat-num">{menuCount}+</div>
                <div className="eloise-stat-label">Menu Items</div>
              </div>
              <div>
                <div className="eloise-stat-num">{happyCustomerCount}+</div>
                <div className="eloise-stat-label">Happy Customers</div>
              </div>
              <div>
                <div className="eloise-stat-num">5★</div>
                <div className="eloise-stat-label">Avg Rating</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {!checkoutPage && (
        <section className="eloise-menu-section" id="menu">
          <div className="eloise-section-header eloise-reveal">
            <div className="eloise-section-label eloise-center-label">Our Menu</div>
            <h2>
              Crafted with Love,
              <br />
              Served with Pride
            </h2>
          </div>
          <div className="eloise-menu-tabs eloise-reveal">
            {menuTabs.map((tab) => (
              <button
                key={tab.id}
                className={`eloise-tab ${resolvedActiveCategory === tab.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(tab.id)}
              >
                {tab.name}
              </button>
            ))}
          </div>
          {loading && <div className="eloise-status-card">Loading menu...</div>}
          {!loading && error && <div className="eloise-status-card eloise-status-error">{error}</div>}
          {!loading && !error && (
            <div className="eloise-menu-grid" id="menuGrid">
              {filteredProducts.map((product, index) => {
                const stockQty = normalizePositiveInteger(product.stockQty)
                const soldOut = stockQty <= 0
                const badge = soldOut ? 'Sold Out' : index < 3 ? 'Popular' : ''
                const isAdded = Boolean(addedState[product.id])
                const emoji = deriveProductEmoji(product.category, index)
                return (
                  <div className="eloise-menu-card" key={product.id}>
                    <div className="eloise-menu-card-img">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="eloise-menu-image" />
                      ) : (
                        <span>{emoji}</span>
                      )}
                      {badge ? <div className="eloise-menu-card-badge">{badge}</div> : null}
                    </div>
                    <div className="eloise-menu-card-body">
                      <div className="eloise-menu-card-cat">{String(product.category ?? 'menu')}</div>
                      <h3 className="line-clamp-1" title={product.name}>{product.name}</h3>
                      <p className="line-clamp-2">{product.description || 'Handcrafted with quality ingredients and balanced flavor.'}</p>
                      <div className="eloise-menu-card-footer">
                        <span className="eloise-price">{formatMoney(product.basePrice)}</span>
                        <button
                          className="eloise-add-btn"
                          onClick={() => handleAddToCart(product.id, product.stockQty)}
                          disabled={soldOut}
                          title={soldOut ? 'Out of stock' : 'Add to cart'}
                        >
                          {isAdded ? <CheckCircle2 size={16} /> : <Plus size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {filteredProducts.length === 0 && (
                <div className="eloise-status-card">No products found in this category.</div>
              )}
            </div>
          )}
        </section>
      )}

      {checkoutPage && (
        <section className="eloise-checkout-section" id="checkout">
          <div className="eloise-section-header eloise-reveal">
            <div className="eloise-section-label eloise-center-label">Checkout</div>
            <h2>Cart and Payment</h2>
          </div>
          <div className="eloise-checkout-grid">
            <article className="eloise-checkout-card eloise-reveal">
              <header className="eloise-checkout-card-header">
                <p className="eloise-cart-label">Cart</p>
                <h3>Eloise Selection</h3>
              </header>
              <div className="eloise-cart-body">
                {cartLines.length === 0 && (
                  <div className="eloise-cart-empty">
                    <ShoppingCart size={18} />
                    <p>No items added yet.</p>
                  </div>
                )}
                {cartLines.map((line, index) => {
                  const productId = String(line.product.id)
                  return (
                    <article className="eloise-cart-item" key={productId}>
                      <div className="eloise-cart-item-thumb">
                        {line.product.image ? (
                          <img src={line.product.image} alt={line.product.name} />
                        ) : (
                          <span>{deriveProductEmoji(line.product.category, index)}</span>
                        )}
                      </div>
                      <div className="eloise-cart-item-content">
                        <p className="eloise-cart-item-name">{line.product.name}</p>
                        <p className="eloise-cart-item-price">{formatMoney(line.product.basePrice)} each</p>
                        <div className="eloise-cart-item-actions">
                          <div className="eloise-qty-control">
                            <button type="button" onClick={() => updateCartLineQuantity(productId, -1)}>
                              <Minus size={14} />
                            </button>
                            <span>{line.quantity}</span>
                            <button type="button" onClick={() => updateCartLineQuantity(productId, 1)}>
                              <Plus size={14} />
                            </button>
                          </div>
                          <button type="button" className="eloise-cart-remove" onClick={() => removeCartLine(productId)}>
                            <Trash2 size={13} />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                      <p className="eloise-cart-item-total">
                        {formatMoney(Number(line.product.basePrice ?? 0) * line.quantity)}
                      </p>
                    </article>
                  )
                })}
              </div>
            </article>

            <article className="eloise-checkout-card eloise-reveal">
              <header className="eloise-checkout-card-header">
                <p className="eloise-cart-label">Payment</p>
                <h3>Customer Details</h3>
              </header>
              <div className="eloise-payment-card-body">
                {customerReady && !customerSession?.id && (
                  <div className="eloise-login-required">
                    <p>Login required to buy items.</p>
                    <button
                      type="button"
                      className="ui-btn ui-btn-primary"
                      onClick={openCustomerAuthPage}
                    >
                      <UserRound size={14} />
                      <span>Login or Register</span>
                    </button>
                  </div>
                )}
                <div className="eloise-cart-form">
                  <label>
                    Name
                    <input
                      type="text"
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Customer name"
                    />
                  </label>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                      Order Type
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setOrderType('takeaway')}
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          borderRadius: '0.5rem',
                          border: '1px solid #e5e7eb',
                          backgroundColor: orderType === 'takeaway' ? '#f59e0b' : '#f3f4f6',
                          color: orderType === 'takeaway' ? 'white' : '#374151',
                          fontWeight: '500',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <Briefcase size={14} style={{ display: 'inline', marginRight: '0.5rem' }} />
                        Take Away
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderType('delivery')}
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          borderRadius: '0.5rem',
                          border: '1px solid #e5e7eb',
                          backgroundColor: orderType === 'delivery' ? '#f59e0b' : '#f3f4f6',
                          color: orderType === 'delivery' ? 'white' : '#374151',
                          fontWeight: '500',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <Truck size={14} style={{ display: 'inline', marginRight: '0.5rem' }} />
                        Delivery
                      </button>
                    </div>
                  </div>

                  <label>
                    Phone
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      placeholder="Phone number"
                    />
                  </label>

                  {orderType === 'delivery' && (
                    <label>
                      Delivery Phone
                      <input
                        type="text"
                        value={deliveryPhone}
                        onChange={(event) => setDeliveryPhone(event.target.value)}
                        placeholder="Phone number for delivery driver"
                      />
                    </label>
                  )}

                  <label>
                    Delivery Address
                    <textarea
                      rows={2}
                      value={profileAddress}
                      onChange={(event) => setProfileAddress(event.target.value)}
                      placeholder="Delivery address"
                    />
                  </label>
                  <div className="eloise-address-quick-picks">
                    <button
                      type="button"
                      onClick={() => applySavedAddress('home')}
                      disabled={!savedAddresses.home}
                    >
                      Home
                    </button>
                    <button
                      type="button"
                      onClick={() => applySavedAddress('work')}
                      disabled={!savedAddresses.work}
                    >
                      Work
                    </button>
                    <button
                      type="button"
                      onClick={() => saveAddressPreset('home')}
                      disabled={!profileAddress.trim()}
                    >
                      Save as Home
                    </button>
                    <button
                      type="button"
                      onClick={() => saveAddressPreset('work')}
                      disabled={!profileAddress.trim()}
                    >
                      Save as Work
                    </button>
                  </div>
                  <button
                    type="button"
                    className="eloise-location-btn"
                    onClick={handleDetectCurrentLocation}
                    disabled={isLocatingAddress}
                  >
                    {isLocatingAddress ? <Loader2 size={14} className="eloise-spin" /> : <Crosshair size={14} />}
                    <span>{isLocatingAddress ? 'Detecting current location...' : 'Use Current Location (Google Maps)'}</span>
                  </button>
                  <button
                    type="button"
                    className="eloise-map-toggle eloise-map-toggle-checkout"
                    onClick={() => setCheckoutMapOpen((open) => !open)}
                  >
                    <MapPin size={14} />
                    <span>{checkoutMapOpen ? 'Hide Map Picker' : 'Open Map Picker'}</span>
                  </button>
                  {checkoutMapOpen && (
                    <div className="eloise-map-card">
                      <Suspense fallback={<div className="eloise-map-loading">Loading map...</div>}>
                        <LeafletAddressPicker coordinates={selectedCoordinates} onPickCoordinates={handleMapPick} />
                      </Suspense>
                      <p>Tap map to choose exact delivery point.</p>
                    </div>
                  )}
                  <label>
                    Note
                    <textarea
                      rows={2}
                      value={customerNote}
                      onChange={(event) => setCustomerNote(event.target.value)}
                      placeholder="Optional note"
                    />
                  </label>
                </div>

                <WebsiteCheckoutPaymentPanel
                  paymentMethod={paymentMethod}
                  onPaymentMethodChange={(methodId) => {
                    setPaymentMethod(methodId)
                    setCheckoutError('')
                    setCheckoutSuccess('')
                  }}
                  paymentConfig={paymentConfig}
                  roundedTotalAmount={roundedTotalAmount}
                  catalogCurrency={catalog.currency}
                  hasStaticKhqr={hasStaticKhqr}
                  checkoutError={checkoutError}
                  checkoutSuccess={checkoutSuccess}
                  latestOrder={latestOrder}
                  trackingEtaMinutes={trackingEtaMinutes}
                  trackingStage={trackingStage}
                  formatMoney={formatMoney}
                  subtotal={subtotal}
                  resolvedTaxRate={resolvedTaxRate}
                  taxAmount={taxAmount}
                  totalAmount={totalAmount}
                  onCheckout={handleCheckout}
                  checkoutDisabled={placingOrder || cartLines.length === 0 || !customerSession?.id}
                  checkoutButtonLabel={checkoutButtonLabel}
                />
              </div>
            </article>
          </div>
        </section>
      )}
      {!checkoutPage && <WebsiteMarketingSections todayName={todayName} />}
    </div>
  )
}
