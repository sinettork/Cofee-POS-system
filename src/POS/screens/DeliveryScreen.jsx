import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Send,
  Truck,
  User,
} from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'

const STATUS_META = {
  pending: {
    label: 'Pending Kitchen',
    badgeClassName: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    panelClassName: 'border-amber-200 bg-[linear-gradient(135deg,#fffdf7_0%,#ffffff_100%)]',
    accentClassName: 'bg-amber-500',
  },
  ready_for_delivery: {
    label: 'Ready for Delivery',
    badgeClassName: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
    panelClassName: 'border-sky-200 bg-[linear-gradient(135deg,#f8fcff_0%,#ffffff_100%)]',
    accentClassName: 'bg-sky-500',
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    badgeClassName: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
    panelClassName: 'border-violet-200 bg-[linear-gradient(135deg,#fbf9ff_0%,#ffffff_100%)]',
    accentClassName: 'bg-violet-500',
  },
  delivered: {
    label: 'Delivered',
    badgeClassName: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    panelClassName: 'border-emerald-200 bg-[linear-gradient(135deg,#f7fffb_0%,#ffffff_100%)]',
    accentClassName: 'bg-emerald-500',
  },
}

const STATUS_ORDER = ['pending', 'ready_for_delivery', 'out_for_delivery', 'delivered']
const AUTO_REFRESH_MS = 10000

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem('tenant-pos-auth-token')}`,
  }
}

function getStatusMeta(status) {
  return STATUS_META[status] ?? STATUS_META.pending
}

function getMinutesSince(dateStr) {
  if (!dateStr) return 0
  const timestamp = new Date(dateStr).getTime()
  if (!Number.isFinite(timestamp)) return 0
  return Math.max(0, Math.round((Date.now() - timestamp) / 60000))
}

function getUrgencyState(delivery) {
  const minutes = getMinutesSince(delivery?.created_at)
  const status = String(delivery?.delivery_status ?? 'pending')

  if (status === 'delivered') return { tone: 'calm', label: 'Completed' }
  if ((status === 'pending' && minutes >= 20) || (status === 'ready_for_delivery' && minutes >= 25) || (status === 'out_for_delivery' && minutes >= 50)) {
    return { tone: 'critical', label: 'Needs attention' }
  }
  if ((status === 'pending' && minutes >= 10) || (status === 'ready_for_delivery' && minutes >= 15) || (status === 'out_for_delivery' && minutes >= 30)) {
    return { tone: 'watch', label: 'Watch timing' }
  }
  return { tone: 'calm', label: 'On track' }
}

function formatClock(dateStr) {
  if (!dateStr) return '--:--'
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateLabel(dateStr) {
  if (!dateStr) return 'Unknown date'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatLastUpdated(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'Not synced yet'
  return `Synced ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
}

function buildSearchText(delivery) {
  return [
    delivery?.order_number,
    delivery?.customer_name,
    delivery?.delivery_address,
    delivery?.delivery_phone,
    delivery?.driver_name,
    delivery?.driver_phone,
    delivery?.delivery_note,
    delivery?.kitchen_status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function extractFirstUrl(text) {
  const value = String(text ?? '')
  const match = value.match(/https?:\/\/\S+/i)
  return match ? match[0] : ''
}

export function DeliveryScreen() {
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [assigningDriver, setAssigningDriver] = useState(null)
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const deferredSearch = useDeferredValue(searchValue.trim().toLowerCase())

  const loadDeliveryQueue = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/delivery/queue?limit=50', {
        headers: getAuthHeaders(),
      })
      if (!response.ok) throw new Error('Failed to load delivery queue')
      const data = await response.json()
      setDeliveries(Array.isArray(data.deliveries) ? data.deliveries : [])
      setLastUpdatedAt(new Date())
    } catch (requestError) {
      setError(String(requestError?.message || 'Failed to load delivery queue'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDeliveryQueue()
    const intervalId = setInterval(() => {
      void loadDeliveryQueue()
    }, AUTO_REFRESH_MS)
    return () => clearInterval(intervalId)
  }, [loadDeliveryQueue])

  useEffect(() => {
    if (!successMsg) return undefined
    const timeoutId = setTimeout(() => setSuccessMsg(''), 3000)
    return () => clearTimeout(timeoutId)
  }, [successMsg])

  const openDriverEditor = (delivery) => {
    setAssigningDriver(delivery.id)
    setDriverName(String(delivery?.driver_name ?? ''))
    setDriverPhone(String(delivery?.driver_phone ?? ''))
    setError('')
  }

  const closeDriverEditor = () => {
    setAssigningDriver(null)
    setDriverName('')
    setDriverPhone('')
  }

  const handleAssignDriver = async (orderId) => {
    if (!driverName.trim()) {
      setError('Driver name is required.')
      return
    }

    try {
      const response = await fetch(`/api/delivery/${orderId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          driverName: driverName.trim(),
          driverPhone: driverPhone.trim(),
        }),
      })
      if (!response.ok) throw new Error('Failed to assign driver')

      setSuccessMsg('Driver assignment saved.')
      closeDriverEditor()
      await loadDeliveryQueue()
    } catch (requestError) {
      setError(String(requestError?.message || 'Failed to assign driver'))
    }
  }

  const handleUpdateStatus = async (delivery, newStatus) => {
    if (newStatus === 'out_for_delivery' && !String(delivery?.driver_name ?? '').trim()) {
      setError('Assign a driver before sending the order out for delivery.')
      openDriverEditor(delivery)
      return
    }

    try {
      const response = await fetch(`/api/delivery/${delivery.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!response.ok) throw new Error('Failed to update status')

      setSuccessMsg(`Order ${delivery.order_number} updated to ${getStatusMeta(newStatus).label}.`)
      await loadDeliveryQueue()
    } catch (requestError) {
      setError(String(requestError?.message || 'Failed to update delivery status'))
    }
  }

  const countsByStatus = useMemo(() => {
    return STATUS_ORDER.reduce(
      (accumulator, status) => {
        accumulator[status] = deliveries.filter((delivery) => delivery.delivery_status === status).length
        return accumulator
      },
      { all: deliveries.length },
    )
  }, [deliveries])

  const summaryCards = useMemo(() => {
    const activeDeliveries = deliveries.filter((delivery) => delivery.delivery_status !== 'delivered')
    const unassignedDeliveries = activeDeliveries.filter((delivery) => !String(delivery.driver_name ?? '').trim())
    const criticalDeliveries = activeDeliveries.filter((delivery) => getUrgencyState(delivery).tone === 'critical')

    return [
      {
        label: 'Active Deliveries',
        value: activeDeliveries.length,
        hint: 'Orders still moving through the route',
        tone: 'text-[var(--ui-primary)]',
        bg: 'bg-[#faf4ef]',
      },
      {
        label: 'Need Driver',
        value: unassignedDeliveries.length,
        hint: 'Orders without a rider assignment',
        tone: 'text-sky-700',
        bg: 'bg-sky-50',
      },
      {
        label: 'Needs Attention',
        value: criticalDeliveries.length,
        hint: 'Orders aging beyond the target window',
        tone: 'text-red-600',
        bg: 'bg-red-50',
      },
      {
        label: 'Delivered Today',
        value: countsByStatus.delivered ?? 0,
        hint: 'Completed handoffs in the queue',
        tone: 'text-emerald-700',
        bg: 'bg-emerald-50',
      },
    ]
  }, [countsByStatus.delivered, deliveries])

  const filteredDeliveries = useMemo(() => {
    const withStatusFilter = deliveries.filter((delivery) =>
      filterStatus === 'all' ? true : delivery.delivery_status === filterStatus,
    )

    const withSearch = withStatusFilter.filter((delivery) => {
      if (!deferredSearch) return true
      return buildSearchText(delivery).includes(deferredSearch)
    })

    return withSearch.sort((left, right) => {
      const statusPriority = STATUS_ORDER.indexOf(String(left.delivery_status ?? 'pending')) - STATUS_ORDER.indexOf(String(right.delivery_status ?? 'pending'))
      if (filterStatus === 'all' && statusPriority !== 0) return statusPriority
      return getMinutesSince(right.created_at) - getMinutesSince(left.created_at)
    })
  }, [deferredSearch, deliveries, filterStatus])

  const showInitialLoading = loading && deliveries.length === 0

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4 md:p-6">
      <section className="ui-surface overflow-hidden rounded-[28px]">
        <div className="flex flex-col gap-5 border-b border-stone-100 bg-[radial-gradient(circle_at_top_left,_#fffaf5_0%,_#ffffff_55%)] px-5 py-5 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-stone-500">
                <Truck size={14} />
                Delivery Control
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-900">Delivery Queue</h1>
              <p className="mt-1 max-w-2xl text-sm font-medium text-stone-500">
                Track every delivery from kitchen handoff to doorstep, keep drivers assigned, and surface orders that need attention.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-stone-500">
                {formatLastUpdated(lastUpdatedAt)}
              </div>
              <button
                type="button"
                onClick={() => void loadDeliveryQueue()}
                disabled={loading}
                className="ui-btn ui-btn-secondary px-4 py-3 text-sm text-stone-600"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                <span>{loading ? 'Refreshing...' : 'Refresh Queue'}</span>
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <article key={card.label} className={`rounded-[22px] border border-stone-200 px-4 py-4 ${card.bg}`}>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-stone-500">{card.label}</p>
                <p className={`mt-3 text-3xl font-black ${card.tone}`}>{card.value}</p>
                <p className="mt-1 text-sm font-medium text-stone-500">{card.hint}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5 md:px-6">
          {error && (
            <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              <CheckCircle2 size={18} />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-[var(--ui-primary)] text-white shadow-lg shadow-amber-900/10'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                All
                <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[11px]">{countsByStatus.all ?? 0}</span>
              </button>
              {STATUS_ORDER.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilterStatus(status)}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                    filterStatus === status
                      ? 'bg-[var(--ui-primary)] text-white shadow-lg shadow-amber-900/10'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {getStatusMeta(status).label}
                  <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[11px]">{countsByStatus[status] ?? 0}</span>
                </button>
              ))}
            </div>

            <label className="relative w-full max-w-[360px]">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="search"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search order, customer, address, or driver"
                className="ui-input h-12 rounded-2xl bg-stone-50/70 pl-11 pr-4 text-sm font-medium text-stone-700"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="min-h-0 flex-1 overflow-y-auto pr-1">
        {showInitialLoading ? (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <article key={`delivery-skeleton-${index}`} className="ui-surface animate-pulse rounded-[24px] p-5">
                <div className="h-4 w-24 rounded-full bg-stone-100" />
                <div className="mt-4 h-8 w-40 rounded-2xl bg-stone-100" />
                <div className="mt-6 space-y-3">
                  <div className="h-16 rounded-2xl bg-stone-100" />
                  <div className="h-16 rounded-2xl bg-stone-100" />
                  <div className="h-16 rounded-2xl bg-stone-100" />
                </div>
              </article>
            ))}
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <div className="ui-surface flex min-h-[320px] flex-col items-center justify-center rounded-[28px] px-6 text-center">
            <Truck size={42} className="text-stone-300" />
            <h2 className="mt-4 text-xl font-black text-stone-800">No deliveries in this view</h2>
            <p className="mt-2 max-w-md text-sm font-medium text-stone-500">
              {deferredSearch
                ? 'Try a different search term or switch the status filter to surface more orders.'
                : 'The queue is clear for the current filter. New delivery orders will appear here automatically.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {filteredDeliveries.map((delivery) => {
              const statusMeta = getStatusMeta(delivery.delivery_status)
              const urgency = getUrgencyState(delivery)
              const waitMinutes = getMinutesSince(delivery.created_at)
              const mapsUrl = extractFirstUrl(delivery.delivery_address)
              const driverAssigned = Boolean(String(delivery.driver_name ?? '').trim())
              const isEditingDriver = assigningDriver === delivery.id
              const urgencyClassName =
                urgency.tone === 'critical'
                  ? 'bg-red-50 text-red-600 ring-1 ring-red-200'
                  : urgency.tone === 'watch'
                    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                    : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'

              return (
                <article
                  key={delivery.id}
                  className={`ui-surface rounded-[26px] border p-5 ${statusMeta.panelClassName}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.accentClassName}`} />
                        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-stone-400">
                          {formatDateLabel(delivery.created_at)} at {formatClock(delivery.created_at)}
                        </p>
                      </div>
                      <h3 className="mt-3 text-2xl font-black tracking-tight text-stone-900">
                        {delivery.order_number}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusMeta.badgeClassName}`}>
                          {statusMeta.label}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${urgencyClassName}`}>
                          {urgency.label}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-stone-200 bg-white/90 px-4 py-3 text-right shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-stone-400">Queue Age</p>
                      <p className="mt-1 text-2xl font-black text-stone-900">{waitMinutes}m</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3">
                    <div className="rounded-[22px] border border-stone-200 bg-white/90 p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
                          <User size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-stone-400">Customer</p>
                          <p className="mt-1 truncate text-base font-black text-stone-800">
                            {delivery.customer_name || 'Guest'}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-stone-500">
                            <span className="rounded-full bg-stone-100 px-2.5 py-1">
                              Kitchen: {delivery.kitchen_status || 'Pending'}
                            </span>
                            <span className="rounded-full bg-stone-100 px-2.5 py-1">
                              Order: {delivery.status || 'Active'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-stone-200 bg-white/90 p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
                          <MapPin size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-stone-400">Delivery Address</p>
                          <p className="mt-1 text-sm font-semibold leading-6 text-stone-700">
                            {delivery.delivery_address || 'No delivery address provided'}
                          </p>
                          {mapsUrl && (
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex text-sm font-bold text-[var(--ui-primary)] hover:underline"
                            >
                              Open map link
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[22px] border border-stone-200 bg-white/90 p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
                            <Phone size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-stone-400">Delivery Phone</p>
                            <p className="mt-1 text-sm font-semibold text-stone-700">
                              {delivery.delivery_phone || 'No phone provided'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-stone-200 bg-white/90 p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
                            <Clock3 size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-stone-400">Timing</p>
                            <p className="mt-1 text-sm font-semibold text-stone-700">
                              Created {formatClock(delivery.created_at)}
                            </p>
                            <p className="mt-1 text-xs font-medium text-stone-500">
                              {waitMinutes} minutes in queue
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {delivery.delivery_note && (
                      <div className="rounded-[22px] border border-amber-200 bg-amber-50/80 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-700">Delivery Note</p>
                        <p className="mt-2 text-sm font-medium leading-6 text-stone-700">{delivery.delivery_note}</p>
                      </div>
                    )}

                    <div className="rounded-[22px] border border-stone-200 bg-white/90 p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-stone-400">Driver</p>
                          <p className="mt-1 text-base font-black text-stone-800">
                            {driverAssigned ? delivery.driver_name : 'Unassigned'}
                          </p>
                          <p className="mt-1 text-sm font-medium text-stone-500">
                            {delivery.driver_phone || 'Add a driver phone number for handoff coordination'}
                          </p>
                        </div>

                        {!isEditingDriver && (
                          <button
                            type="button"
                            onClick={() => openDriverEditor(delivery)}
                            className="ui-btn ui-btn-secondary px-4 py-3 text-sm text-stone-600"
                          >
                            <User size={15} />
                            <span>{driverAssigned ? 'Edit Driver' : 'Assign Driver'}</span>
                          </button>
                        )}
                      </div>

                      {isEditingDriver && (
                        <div className="mt-4 grid gap-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <input
                              type="text"
                              value={driverName}
                              onChange={(event) => setDriverName(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  void handleAssignDriver(delivery.id)
                                }
                              }}
                              placeholder="Driver name"
                              className="ui-input h-11 px-4 text-sm font-medium text-stone-700"
                            />
                            <input
                              type="tel"
                              value={driverPhone}
                              onChange={(event) => setDriverPhone(event.target.value)}
                              placeholder="Driver phone"
                              className="ui-input h-11 px-4 text-sm font-medium text-stone-700"
                            />
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void handleAssignDriver(delivery.id)}
                              className="ui-btn ui-btn-primary px-4 py-3 text-sm"
                            >
                              <Send size={15} />
                              <span>Save Driver</span>
                            </button>
                            <button
                              type="button"
                              onClick={closeDriverEditor}
                              className="ui-btn ui-btn-secondary px-4 py-3 text-sm text-stone-600"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {delivery.delivery_status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => void handleUpdateStatus(delivery, 'ready_for_delivery')}
                        className="ui-btn ui-btn-primary flex-1 px-4 py-3 text-sm"
                      >
                        <CheckCircle2 size={16} />
                        <span>Mark Ready</span>
                      </button>
                    )}

                    {delivery.delivery_status === 'ready_for_delivery' && (
                      <button
                        type="button"
                        onClick={() => void handleUpdateStatus(delivery, 'out_for_delivery')}
                        className="ui-btn ui-btn-primary flex-1 px-4 py-3 text-sm"
                      >
                        <Truck size={16} />
                        <span>Dispatch Driver</span>
                      </button>
                    )}

                    {delivery.delivery_status === 'out_for_delivery' && (
                      <button
                        type="button"
                        onClick={() => void handleUpdateStatus(delivery, 'delivered')}
                        className="ui-btn flex-1 border-emerald-500 bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(16,185,129,0.18)] transition-colors hover:bg-emerald-600"
                      >
                        <CheckCircle2 size={16} />
                        <span>Mark Delivered</span>
                      </button>
                    )}

                    {delivery.delivery_status === 'delivered' && (
                      <div className="flex flex-1 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                        <CheckCircle2 size={16} />
                        <span>Delivery completed</span>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
