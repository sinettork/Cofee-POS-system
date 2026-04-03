import { BarChart3, Globe2, LogOut, Menu, Package, Settings, ShieldCheck, Users, X } from 'lucide-react'
import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react'
import {
  bulkCreateProductItems,
  clearAuthToken,
  createCategoryItem,
  createProductItem,
  deleteProductItem,
  fetchBootstrapData,
  fetchCurrentUser,
  fetchReportSummary,
  fetchSettings,
  getStoredAuthToken,
  loginWithPassword,
  logoutSession,
  updateProductItem,
} from '@shared/api/client'
import { LoginScreen } from '@POS/screens/LoginScreen'
import { ManageScreen } from '@POS/screens/ManageScreen'
import { ReportScreen } from '@POS/screens/ReportScreen'
import {
  CATEGORY_ITEMS,
  FAVORITES,
  PRODUCT_ITEMS,
  REPORT_ORDER_ROWS,
} from '@POS/constants/uiData'
import { AdminDashboardScreen } from './screens/AdminDashboardScreen'
import { AdminWebsiteScreen } from './screens/AdminWebsiteScreen'

const ADMIN_MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'website', label: 'Website', icon: Globe2 },
  { id: 'report', label: 'Report', icon: BarChart3 },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'teams', label: 'Teams', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const ROLE_PAGE_ACCESS = {
  admin: ['dashboard', 'website', 'report', 'inventory', 'teams', 'settings'],
  manager: ['dashboard', 'website', 'report', 'inventory', 'teams', 'settings'],
  cashier: ['dashboard'],
}

function getAllowedPagesByRole(role) {
  const normalized = String(role ?? '').toLowerCase()
  return ROLE_PAGE_ACCESS[normalized] ?? ROLE_PAGE_ACCESS.cashier
}

function isAuthorizationError(error) {
  const text = String(error?.message ?? '').toLowerCase()
  return (
    text.includes('unauthorized') ||
    text.includes('session') ||
    text.includes('invalid token') ||
    text.includes('forbidden')
  )
}

function readAdminPage() {
  if (typeof window === 'undefined') return 'dashboard'
  const [, segment = ''] = String(window.location.pathname || '').toLowerCase().split('/admin/')
  const page = segment.split('/')[0] || 'dashboard'
  return ADMIN_MENU_ITEMS.some((item) => item.id === page) ? page : 'dashboard'
}

function pushAdminPage(nextPage) {
  if (typeof window === 'undefined') return
  const path = nextPage === 'dashboard' ? '/admin' : `/admin/${nextPage}`
  if (window.location.pathname === path) return
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function AdminPanelApp() {
  const [page, setPage] = useState(() => readAdminPage())
  const [now, setNow] = useState(() => new Date())
  const [syncError, setSyncError] = useState('')
  const [actionNotice, setActionNotice] = useState('')
  const [summary, setSummary] = useState({
    totalSales: 12650,
    totalOrders: 1250,
    totalCustomers: 400,
    netProfit: 12650,
  })
  const [appData, setAppData] = useState(() => ({
    categories: CATEGORY_ITEMS.map((item) => ({
      id: item.id,
      name: item.name,
      count: item.count,
    })),
    products: PRODUCT_ITEMS,
    favorites: FAVORITES,
    reportOrderRows: REPORT_ORDER_ROWS,
    inventoryMovements: [],
  }))
  const [appSettings, setAppSettings] = useState({
    taxRate: 10,
    receiptFooter: true,
    defaultService: 'Dine In',
  })
  const [authToken, setAuthToken] = useState(() => getStoredAuthToken())
  const [currentUser, setCurrentUser] = useState(null)
  const [authChecking, setAuthChecking] = useState(true)
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [authError, setAuthError] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const onTick = useEffectEvent(() => {
    setNow(new Date())
  })

  useEffect(() => {
    const timer = setInterval(() => onTick(), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const onPopState = () => setPage(readAdminPage())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const allowedPages = useMemo(() => getAllowedPagesByRole(currentUser?.role), [currentUser?.role])
  const menuItems = useMemo(
    () => ADMIN_MENU_ITEMS.filter((item) => allowedPages.includes(item.id)),
    [allowedPages],
  )
  const canManageCatalog = useMemo(
    () => ['admin', 'manager'].includes(String(currentUser?.role ?? '').toLowerCase()),
    [currentUser?.role],
  )

  useEffect(() => {
    if (!currentUser) return
    if (allowedPages.includes(page)) return
    const fallbackPage = allowedPages[0] ?? 'dashboard'
    setPage(fallbackPage)
    pushAdminPage(fallbackPage)
  }, [allowedPages, currentUser, page])

  useEffect(() => {
    if (!authToken) {
      setCurrentUser(null)
      setAuthChecking(false)
      return
    }
    const controller = new AbortController()
    setAuthChecking(true)
    fetchCurrentUser(controller.signal)
      .then((response) => {
        setCurrentUser(response.user)
        setAuthError('')
      })
      .catch((error) => {
        clearAuthToken()
        setAuthToken('')
        setCurrentUser(null)
        setAuthError(
          isAuthorizationError(error)
            ? 'Session expired. Please sign in again.'
            : String(error.message || 'Authentication failed.'),
        )
      })
      .finally(() => {
        setAuthChecking(false)
      })
    return () => controller.abort()
  }, [authToken])

  const handleSignOut = useCallback(async ({ silent = false, authMessage = '' } = {}) => {
    try {
      if (!silent) {
        await logoutSession()
      } else {
        clearAuthToken()
      }
    } catch {
      clearAuthToken()
    }
    setAuthToken('')
    setCurrentUser(null)
    setMobileMenuOpen(false)
    setPage('dashboard')
    pushAdminPage('dashboard')
    if (authMessage) {
      setAuthError(authMessage)
    } else if (!silent) {
      setAuthError('')
      setActionNotice('Signed out from tenant session.')
    }
  }, [])

  useEffect(() => {
    if (!currentUser) return
    const controller = new AbortController()
    const bootstrapPromise = fetchBootstrapData(controller.signal)
    const summaryPromise = fetchReportSummary(controller.signal)
    const settingsPromise = fetchSettings(controller.signal)

    Promise.allSettled([bootstrapPromise, summaryPromise, settingsPromise])
      .then((results) => {
        const [bootstrapResult, summaryResult, settingsResult] = results

        if (bootstrapResult.status === 'fulfilled') {
          setAppData((previous) => ({
            ...previous,
            ...bootstrapResult.value,
          }))
          setSyncError('')
        } else if (bootstrapResult.reason?.name !== 'AbortError') {
          if (isAuthorizationError(bootstrapResult.reason)) {
            handleSignOut({ silent: true, authMessage: 'Session expired. Please sign in again.' })
            return
          }
          setSyncError('SQLite API not connected. Running local mock data.')
        }

        if (summaryResult.status === 'fulfilled') {
          setSummary(summaryResult.value)
        }

        if (settingsResult.status === 'fulfilled') {
          const nextTaxRate = Number(settingsResult.value?.taxRate ?? 10)
          setAppSettings({
            taxRate: Number.isFinite(nextTaxRate) ? nextTaxRate : 10,
            receiptFooter: String(settingsResult.value?.receiptFooter ?? 'true').toLowerCase() === 'true',
            defaultService: String(settingsResult.value?.defaultService ?? 'Dine In') || 'Dine In',
          })
        }
      })
      .catch(() => {
        setSyncError('SQLite API not connected. Running local mock data.')
      })

    return () => controller.abort()
  }, [currentUser, handleSignOut])

  useEffect(() => {
    if (!actionNotice) return undefined
    const timer = setTimeout(() => setActionNotice(''), 2600)
    return () => clearTimeout(timer)
  }, [actionNotice])

  useEffect(() => {
    if (!mobileMenuOpen || typeof window === 'undefined') return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mobileMenuOpen])

  const refreshBootstrap = async () => {
    const next = await fetchBootstrapData(undefined)
    setAppData((previous) => ({
      ...previous,
      ...next,
    }))
  }

  const handleCreateProduct = async (payload) => {
    const created = await createProductItem(payload)
    await refreshBootstrap()
    setSyncError('')
    return created
  }

  const handleCreateCategory = async (payload) => {
    const created = await createCategoryItem(payload)
    await refreshBootstrap()
    setSyncError('')
    return created
  }

  const handleUpdateProduct = async (productId, payload) => {
    const updated = await updateProductItem(productId, payload)
    await refreshBootstrap()
    setSyncError('')
    return updated
  }

  const handleDeleteProduct = async (productId) => {
    await deleteProductItem(productId)
    await refreshBootstrap()
    setSyncError('')
  }

  const handleBulkCreateProducts = async (products, mode = 'skip_duplicates') => {
    const result = await bulkCreateProductItems({ products, mode })
    await refreshBootstrap()
    setSyncError('')
    return result
  }

  const handleAction = (message) => {
    setActionNotice(String(message || '').trim())
  }

  const navigateToPage = useCallback((nextPage) => {
    setPage(nextPage)
    pushAdminPage(nextPage)
    setMobileMenuOpen(false)
  }, [])

  const handleLoginSubmit = async ({ username, password }) => {
    setAuthSubmitting(true)
    setAuthError('')
    try {
      const response = await loginWithPassword({ username, password })
      setAuthToken(response.token)
      setCurrentUser(response.user)
      const nextPages = getAllowedPagesByRole(response.user?.role)
      const nextPage = nextPages[0] ?? 'dashboard'
      setPage(nextPage)
      pushAdminPage(nextPage)
      setSyncError('')
      setActionNotice('')
    } catch (error) {
      setAuthError(String(error.message || 'Unable to sign in.'))
    } finally {
      setAuthSubmitting(false)
    }
  }

  if (authChecking) {
    return <LoginScreen loading error="" onSubmit={() => Promise.resolve()} />
  }

  if (!currentUser) {
    return <LoginScreen loading={authSubmitting} error={authError} onSubmit={handleLoginSubmit} />
  }

  return (
    <div className="min-h-[100dvh] bg-slate-100">
      {syncError && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          {syncError}
        </div>
      )}

      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="ui-btn ui-btn-ghost rounded-lg p-2 text-slate-600 md:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={16} />
            </button>
            <ShieldCheck className="text-[#2d71f8]" size={18} />
            <h1 className="text-sm font-bold text-slate-900">Coffee Admin Panel</h1>
          </div>
          <div className="hidden items-center gap-2 text-xs font-semibold sm:flex">
            <a href="/" className="ui-btn ui-btn-secondary px-3 py-1.5">Website</a>
            <a href="/pos" className="ui-btn ui-btn-secondary px-3 py-1.5">POS</a>
            <button
              type="button"
              className="ui-btn ui-btn-secondary px-3 py-1.5"
              onClick={() => handleSignOut()}
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden rounded-xl border border-slate-200 bg-white p-3 md:block">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Admin Modules</p>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              const active = page === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                    active ? 'bg-[#2d71f8]/10 text-[#2d71f8]' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  onClick={() => navigateToPage(item.id)}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <main className="min-w-0 space-y-4">
          {page === 'dashboard' && (
            <AdminDashboardScreen summary={summary} currentUser={currentUser} />
          )}

          {page === 'website' && (
            <AdminWebsiteScreen
              settings={appSettings}
              totalProducts={appData.products.length}
              totalCategories={appData.categories.length}
            />
          )}

          {page === 'report' && (
            <ReportScreen
              now={now}
              favorites={appData.favorites}
              reportOrderRows={appData.reportOrderRows}
              summary={summary}
              onOpenMenu={() => setMobileMenuOpen(true)}
              onAction={handleAction}
            />
          )}

          {['inventory', 'teams', 'settings'].includes(page) && (
            <ManageScreen
              now={now}
              page={page}
              categories={appData.categories}
              products={appData.products}
              inventoryMovements={appData.inventoryMovements}
              canManageCatalog={canManageCatalog}
              onOpenMenu={() => setMobileMenuOpen(true)}
              onAction={handleAction}
              onCreateCategory={handleCreateCategory}
              onCreateProduct={handleCreateProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              onBulkCreateProducts={handleBulkCreateProducts}
              settingsBootstrap={appSettings}
              currentUserRole={String(currentUser?.role ?? '').toLowerCase()}
              onSettingsChange={(nextSettings) => {
                if (!nextSettings) return
                setAppSettings((previous) => ({ ...previous, ...nextSettings }))
              }}
            />
          )}
        </main>
      </div>

      <button
        type="button"
        aria-label="Close admin menu"
        className={`fixed inset-0 z-40 bg-slate-900/35 transition-opacity md:hidden ${
          mobileMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] max-w-[82vw] border-r border-slate-200 bg-white p-3 shadow-xl transition-transform md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
          <p className="text-sm font-bold text-slate-900">Admin Modules</p>
          <button
            type="button"
            className="ui-btn ui-btn-ghost rounded-lg p-2 text-slate-600"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={16} />
          </button>
        </div>
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const active = page === item.id
            return (
              <button
                key={`mobile-${item.id}`}
                type="button"
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                  active ? 'bg-[#2d71f8]/10 text-[#2d71f8]' : 'text-slate-600 hover:bg-slate-100'
                }`}
                onClick={() => navigateToPage(item.id)}
              >
                <Icon size={15} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs font-semibold">
          <a href="/" className="ui-btn ui-btn-secondary w-full justify-center px-3 py-2">Website</a>
          <a href="/pos" className="ui-btn ui-btn-secondary w-full justify-center px-3 py-2">POS</a>
          <button
            type="button"
            className="ui-btn ui-btn-secondary w-full justify-center px-3 py-2"
            onClick={() => handleSignOut()}
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      {actionNotice && (
        <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-[60] rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-700 shadow-[0_10px_30px_rgba(16,185,129,0.18)] sm:left-auto sm:max-w-[340px]">
          {actionNotice}
        </div>
      )}
    </div>
  )
}
