import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react'
import {
  bulkCreateProductItems,
  clearAuthToken,
  createCategoryItem,
  createOrder,
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
  updateOrderStatus,
} from '@shared/api/client'
import { MainDrawer } from './components/MainDrawer'
import { ActivityScreen } from './screens/ActivityScreen'
import { LoginScreen } from './screens/LoginScreen'
import { ManageScreen } from './screens/ManageScreen'
import { PosScreen } from './screens/PosScreen'
import { ReportScreen } from './screens/ReportScreen'
import {
  BILLING_QUEUE,
  CATEGORY_ITEMS,
  FAVORITES,
  HISTORY_ROWS,
  PAGE_ITEMS,
  PRODUCT_ITEMS,
  QUICK_MENU_ITEMS,
  REPORT_ORDER_ROWS,
  TABLE_GROUPS,
  TRACKING_ORDERS,
} from './constants/uiData'

const ROLE_PAGE_ACCESS = {
  manager: ['pos', 'activity', 'report', 'inventory', 'teams', 'settings'],
  cashier: ['pos', 'activity'],
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

export default function PosApp() {
  const [page, setPage] = useState('pos')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
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
    trackingOrders: TRACKING_ORDERS,
    billingQueue: BILLING_QUEUE,
    tableGroups: TABLE_GROUPS,
    historyRows: HISTORY_ROWS,
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

  const onTick = useEffectEvent(() => {
    setNow(new Date())
  })

  useEffect(() => {
    const timer = setInterval(() => onTick(), 1000)
    return () => clearInterval(timer)
  }, [])

  const allowedPages = useMemo(() => getAllowedPagesByRole(currentUser?.role), [currentUser?.role])
  const quickMenuItems = useMemo(
    () => QUICK_MENU_ITEMS.filter((item) => allowedPages.includes(item.id)),
    [allowedPages],
  )
  const sideRailPages = useMemo(
    () => PAGE_ITEMS.filter((item) => allowedPages.includes(item.id)),
    [allowedPages],
  )
  const canManageCatalog = useMemo(
    () => String(currentUser?.role ?? '').toLowerCase() === 'manager',
    [currentUser?.role],
  )

  useEffect(() => {
    if (!currentUser) return
    if (allowedPages.includes(page)) return
    setPage(allowedPages[0] ?? 'pos')
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
        setAuthError(isAuthorizationError(error) ? 'Session expired. Please sign in again.' : String(error.message || 'Authentication failed.'))
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
    setIsMenuOpen(false)
    setPage('pos')
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
          setAppData(bootstrapResult.value)
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
          const nextSettings = {
            taxRate: Number.isFinite(nextTaxRate) ? nextTaxRate : 10,
            receiptFooter: String(settingsResult.value?.receiptFooter ?? 'true').toLowerCase() === 'true',
            defaultService: String(settingsResult.value?.defaultService ?? 'Dine In') || 'Dine In',
          }
          setAppSettings(nextSettings)
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

  const refreshBootstrap = async () => {
    const next = await fetchBootstrapData(undefined)
    setAppData(next)
  }

  const refreshSummary = async () => {
    const nextSummary = await fetchReportSummary(undefined)
    setSummary(nextSummary)
  }

  const handlePlaceOrder = async (payload) => {
    const result = await createOrder(payload)
    await Promise.all([refreshBootstrap(), refreshSummary()])
    setSyncError('')
    return result
  }

  const handleOrderStatusUpdate = async (orderNumber, status, paymentStatus) => {
    await updateOrderStatus(orderNumber, { status, paymentStatus })
    await Promise.all([refreshBootstrap(), refreshSummary()])
    setSyncError('')
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

  const handleLoginSubmit = async ({ username, password }) => {
    setAuthSubmitting(true)
    setAuthError('')
    try {
      const response = await loginWithPassword({ username, password })
      setAuthToken(response.token)
      setCurrentUser(response.user)
      const nextPages = getAllowedPagesByRole(response.user?.role)
      setPage(nextPages[0] ?? 'pos')
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
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-white">
      {syncError && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          {syncError}
        </div>
      )}
      <div className="flex min-h-0 flex-1 w-full overflow-hidden">
        {page === 'pos' && (
          <PosScreen
            now={now}
            pageItems={sideRailPages}
            canOpenInventory={allowedPages.includes('inventory')}
            categories={appData.categories}
            products={appData.products}
            tableGroups={appData.tableGroups}
            trackingOrders={appData.trackingOrders}
            taxRate={Math.max(0, Number(appSettings.taxRate ?? 10)) / 100}
            onOpenMenu={() => setIsMenuOpen(true)}
            onNavigate={setPage}
            onPlaceOrder={handlePlaceOrder}
            onAction={handleAction}
            onSignOut={() => handleSignOut()}
          />
        )}
        {page === 'activity' && (
          <ActivityScreen
            now={now}
            billingQueue={appData.billingQueue}
            historyRows={appData.historyRows}
            tableGroups={appData.tableGroups}
            trackingOrders={appData.trackingOrders}
            onOpenMenu={() => setIsMenuOpen(true)}
            onUpdateOrderStatus={handleOrderStatusUpdate}
            onAction={handleAction}
          />
        )}
        {page === 'report' && allowedPages.includes('report') && (
          <ReportScreen
            now={now}
            favorites={appData.favorites}
            reportOrderRows={appData.reportOrderRows}
            summary={summary}
            onOpenMenu={() => setIsMenuOpen(true)}
            onAction={handleAction}
          />
        )}
        {['inventory', 'teams', 'settings'].includes(page) && allowedPages.includes(page) && (
          <ManageScreen
            now={now}
            page={page}
            categories={appData.categories}
            products={appData.products}
            inventoryMovements={appData.inventoryMovements}
            canManageCatalog={canManageCatalog}
            onOpenMenu={() => setIsMenuOpen(true)}
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
      </div>

      <MainDrawer
        open={isMenuOpen}
        currentPage={page}
        currentUser={currentUser}
        items={quickMenuItems}
        onClose={() => setIsMenuOpen(false)}
        onSignOut={() => handleSignOut()}
        onNavigate={(nextPage) => {
          if (!allowedPages.includes(nextPage)) return
          setPage(nextPage)
          setIsMenuOpen(false)
        }}
      />
      {actionNotice && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[60] max-w-[340px] rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-700 shadow-[0_10px_30px_rgba(16,185,129,0.18)]">
          {actionNotice}
        </div>
      )}
    </div>
  )
}
