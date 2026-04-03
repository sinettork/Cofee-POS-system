import { Component, useEffect, useState } from 'react'
import { AdminPanelApp } from '@AdminPanel/AdminPanelApp.jsx'
import PosApp from '@POS/PosApp.jsx'
import { CustomerAuthScreen } from '@Website/screens/CustomerAuthScreen.jsx'
import { OfficialWebsiteScreen } from '@Website/screens/OfficialWebsiteScreen.jsx'
import { OnlineOrderScreen } from '@Website/screens/OnlineOrderScreen.jsx'

class RootErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: String(error?.message ?? 'Unexpected application error.'),
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wider text-red-500">Application Error</p>
          <h1 className="mt-2 text-xl font-bold text-slate-900">Unable to render this page</h1>
          <p className="mt-2 text-sm text-slate-600">{this.state.message}</p>
          <div className="mt-4 flex gap-2">
            <a href="/" className="ui-btn ui-btn-primary px-3 py-2 text-sm">
              Open Website
            </a>
            <a href="/pos" className="ui-btn ui-btn-secondary px-3 py-2 text-sm">
              Open POS
            </a>
            <a href="/admin" className="ui-btn ui-btn-secondary px-3 py-2 text-sm">
              Open Admin
            </a>
          </div>
        </div>
      </div>
    )
  }
}

function readPathname() {
  if (typeof window === 'undefined') return '/'
  return String(window.location.pathname || '/').toLowerCase()
}

export function RootRouter() {
  const [pathname, setPathname] = useState(() => readPathname())

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handlePopState = () => setPathname(readPathname())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const isOnlineOrderPage = pathname.startsWith('/order') || pathname.startsWith('/online')
  const isPosPage = pathname.startsWith('/pos')
  const isAdminPage = pathname.startsWith('/admin')
  const isCheckoutPage = pathname.startsWith('/cart') || pathname.startsWith('/checkout')
  const isCustomerAuthPage = pathname.startsWith('/account') || pathname.startsWith('/customer-login')

  return (
    <RootErrorBoundary>
      {isCustomerAuthPage ? (
        <CustomerAuthScreen />
      ) : isOnlineOrderPage ? (
        <OnlineOrderScreen />
      ) : isAdminPage ? (
        <AdminPanelApp />
      ) : isPosPage ? (
        <PosApp />
      ) : (
        <OfficialWebsiteScreen checkoutPage={isCheckoutPage} />
      )}
    </RootErrorBoundary>
  )
}
