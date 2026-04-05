import { ArrowUpRight, CalendarDays, Loader2, Menu, Power, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createTable, fetchOrderDetail, updateTableStatus } from '@shared/api/client'
import { HeaderChip, StatusDot } from '../components/common'
import { BILLING_QUEUE, HISTORY_ROWS, TABLE_GROUPS, TRACKING_ORDERS } from '../constants/uiData'
import { formatCurrency, formatDate } from '@shared/utils/format'

export function ActivityScreen({
  now,
  onOpenMenu,
  billingQueue = BILLING_QUEUE,
  historyRows = HISTORY_ROWS,
  tableGroups = TABLE_GROUPS,
  trackingOrders = TRACKING_ORDERS,
  onUpdateOrderStatus,
  onAction,
}) {
  const [tab, setTab] = useState('tables')
  const [floor, setFloor] = useState('1st Floor')
  const [billingFilter, setBillingFilter] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [updatingOrderNumber, setUpdatingOrderNumber] = useState('')
  const [actionError, setActionError] = useState('')
  const [localTableGroups, setLocalTableGroups] = useState(tableGroups)
  const [trackingSearchOpen, setTrackingSearchOpen] = useState(false)
  const [trackingSearch, setTrackingSearch] = useState('')
  const [selectedRowDetail, setSelectedRowDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    setLocalTableGroups(tableGroups)
  }, [tableGroups])

  const keyword = searchTerm.trim().toLowerCase()
  const filteredBillingQueue = billingQueue.filter((row) => {
    const matchesStatus = billingFilter === 'All' || row.status === billingFilter.toLowerCase()
    const matchesSearch =
      keyword.length === 0 ||
      row.customer.toLowerCase().includes(keyword) ||
      row.order.toLowerCase().includes(keyword) ||
      row.table.toLowerCase().includes(keyword)
    return matchesStatus && matchesSearch
  })
  const filteredHistoryRows = historyRows.filter((row) => {
    if (keyword.length === 0) return true
    return (
      row.customer.toLowerCase().includes(keyword) ||
      row.id.toLowerCase().includes(keyword) ||
      row.status.toLowerCase().includes(keyword)
    )
  })
  const floorGroups = {
    '1st Floor': ['2 Persons Table', '4 Persons'],
    '2nd Floor': ['Max 12 Persons'],
    '3rd Floor': [],
  }
  const visibleTableGroups = localTableGroups.filter((group) =>
    floorGroups[floor]?.includes(group.title),
  )
  const filteredTrackingOrders = trackingOrders.filter((order) => {
    const keyword = trackingSearch.trim().toLowerCase()
    if (!keyword) return true
    return (
      order.name.toLowerCase().includes(keyword) ||
      order.table.toLowerCase().includes(keyword) ||
      order.type.toLowerCase().includes(keyword) ||
      order.status.toLowerCase().includes(keyword)
    )
  })

  const handleMarkOrder = async (row, status, paymentStatus) => {
    if (!onUpdateOrderStatus || updatingOrderNumber) return
    setActionError('')
    setUpdatingOrderNumber(row.order)
    try {
      await onUpdateOrderStatus(row.order, status, paymentStatus)
      const normalizedStatus = String(status ?? '').trim().toLowerCase()
      if (normalizedStatus === 'done') {
        onAction?.(`Order ${row.order} completed.`)
      } else {
        onAction?.(`Order ${row.order} updated to ${status}.`)
      }
    } catch (error) {
      setActionError(error.message || 'Failed to update order status.')
    } finally {
      setUpdatingOrderNumber('')
    }
  }

  const handleAddTable = async () => {
    const targetTitles = floorGroups[floor] ?? []
    const targetTitle = targetTitles[0]
    if (!targetTitle) {
      setActionError(`Cannot add table on ${floor}. Configure a table group first.`)
      return
    }
    setActionError('')
    try {
      const result = await createTable({ groupTitle: targetTitle })
      const nextTable = {
        id: String(result?.id ?? 'T-01'),
        guest: '0 Guest',
        pax: 0,
        time: '--:--',
        status: 'available',
      }
      setLocalTableGroups((previous) => {
        const targetIndex = previous.findIndex((group) => group.title === targetTitle)
        if (targetIndex === -1) {
          return [...previous, { title: targetTitle, tables: [nextTable] }]
        }
        return previous.map((group, index) =>
          index === targetIndex ? { ...group, tables: [...group.tables, nextTable] } : group,
        )
      })
      onAction?.(`Added a new table on ${floor}.`)
    } catch (error) {
      setActionError(error.message || 'Failed to add table.')
    }
  }

  const handleCycleTableStatus = async (groupTitle, tableId) => {
    const statusSequence = ['available', 'reserved', 'served']
    const group = localTableGroups.find((item) => item.title === groupTitle)
    const table = group?.tables.find((item) => item.id === tableId)
    if (!table) return
    const currentIndex = statusSequence.indexOf(table.status)
    const nextStatus = statusSequence[(currentIndex + 1) % statusSequence.length]
    const nextGuest = nextStatus === 'available' ? '0 Guest' : nextStatus === 'reserved' ? 'Reserved' : 'Walk-in'
    const nextPax = nextStatus === 'available' ? 0 : nextStatus === 'reserved' ? 2 : 1
    const nextTime = nextStatus === 'available' ? '--:--' : nextStatus === 'reserved' ? '06:00 PM' : 'Now'

    const previousState = localTableGroups
    setActionError('')
    setLocalTableGroups((previous) =>
      previous.map((group) => {
        if (group.title !== groupTitle) return group
        return {
          ...group,
          tables: group.tables.map((table) => {
            if (table.id !== tableId) return table
            return { ...table, status: nextStatus, guest: nextGuest, pax: nextPax, time: nextTime }
          }),
        }
      }),
    )
    try {
      await updateTableStatus(tableId, {
        status: nextStatus,
        guest: nextGuest,
        pax: nextPax,
        time: nextTime,
      })
      onAction?.(`Table ${tableId} status updated.`)
    } catch (error) {
      setLocalTableGroups(previousState)
      setActionError(error.message || 'Failed to update table status.')
    }
  }

  const openDetail = async (type, row) => {
    setDetailLoading(true)
    setActionError('')
    try {
      const sourceOrder = String(row.order ?? row.id ?? '').trim()
      const safeOrder = sourceOrder.replace('#', '')
      if (!safeOrder) {
        setSelectedRowDetail({ type, row })
        return
      }
      const detail = await fetchOrderDetail(safeOrder)
      setSelectedRowDetail({ type, row: detail })
    } catch (error) {
      setActionError(error.message || 'Failed to load order detail.')
      setSelectedRowDetail({ type, row })
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="grid min-h-[100dvh] w-full grid-cols-1 overflow-hidden">
      <div className="grid min-h-0 grid-cols-1 overflow-hidden bg-white lg:h-full lg:grid-cols-[240px_1fr]">
        <aside className="border-r border-stone-100 bg-[#fcfaf8] p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="ui-input bg-white py-2.5 pl-9 pr-3 text-sm"
              placeholder="Search customer / order / table..."
            />
          </div>
          <div className="space-y-1.5">
            <button
              onClick={() => setTab('billing')}
              className={`flex w-full items-center justify-start rounded-2xl px-4 py-3 text-left text-sm transition-colors ${
                tab === 'billing'
                  ? 'bg-[#f6eee8] font-semibold text-[var(--ui-primary)]'
                  : 'bg-transparent font-medium text-stone-700 hover:bg-[#faf4ef]'
              }`}
            >
              Billing Queue
            </button>
            <button
              onClick={() => setTab('tables')}
              className={`flex w-full items-center justify-start rounded-2xl px-4 py-3 text-left text-sm transition-colors ${
                tab === 'tables'
                  ? 'bg-[#f6eee8] font-semibold text-[var(--ui-primary)]'
                  : 'bg-transparent font-medium text-stone-700 hover:bg-[#faf4ef]'
              }`}
            >
              Tables
            </button>
            <button
              onClick={() => setTab('history')}
              className={`flex w-full items-center justify-start rounded-2xl px-4 py-3 text-left text-sm transition-colors ${
                tab === 'history'
                  ? 'bg-[#f6eee8] font-semibold text-[var(--ui-primary)]'
                  : 'bg-transparent font-medium text-stone-700 hover:bg-[#faf4ef]'
              }`}
            >
              Order History
            </button>
          </div>
        </aside>

        <section className="flex flex-col overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-4 md:px-6">
            <div className="flex items-center gap-2">
              <button onClick={onOpenMenu} className="ui-btn ui-btn-ghost rounded-xl p-2 text-stone-500">
                <Menu size={18} />
              </button>
              <h1 className="text-xl font-bold text-stone-900">
                Activity
                <span className="ml-1 text-sm font-medium text-stone-400">
                  /{' '}
                  {tab === 'billing'
                    ? 'Billing Queue'
                    : tab === 'tables'
                      ? 'Tables'
                      : 'Order History'}
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-2 text-stone-600">
              <HeaderChip icon={CalendarDays} label={formatDate(now)} />
              <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-[#1C8370]">
                Open Order
              </div>
              <button
                onClick={() => {
                  setTab('billing')
                  setBillingFilter('All')
                  setSearchTerm('')
                  setTrackingSearch('')
                  setActionError('')
                  onAction?.('Activity filters reset.')
                }}
                className="ui-btn ui-btn-ghost ui-icon-btn text-[#1C8370] hover:bg-emerald-50"
              >
                <Power size={18} />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {tab === 'tables' && (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={handleAddTable}
                    className="ui-btn ui-btn-secondary px-4 py-2 text-sm font-bold text-stone-700 hover:bg-stone-50"
                  >
                    Add Table
                  </button>
                  <div className="flex gap-2">
                    {['1st Floor', '2nd Floor', '3rd Floor'].map((item) => (
                      <button
                        key={item}
                        onClick={() => setFloor(item)}
                        className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                          floor === item
                            ? 'border border-[var(--ui-primary)]/20 bg-[#f6eee8] text-[var(--ui-primary)]'
                            : 'bg-stone-100/80 text-stone-500 hover:bg-[#f3ece6]'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-8">
                  {visibleTableGroups.map((group) => (
                    <section key={group.title}>
                      <div className="mb-4 flex items-center justify-between border-b border-stone-100 pb-2">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-stone-500">{group.title}</h3>
                        <span className="rounded-full bg-stone-100 px-3 py-1 text-[10px] font-bold text-stone-600">
                          {group.tables.length} Tables
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                        {group.tables.map((table) => {
                          const isServed = table.status === 'served'
                          const isReserved = table.status === 'reserved'
                          return (
                            <article
                              key={table.id}
                              onClick={() => handleCycleTableStatus(group.title, table.id)}
                              className={`group relative flex cursor-pointer flex-col items-center rounded-[28px] border p-6 text-center transition-colors ${
                                isServed
                                  ? 'border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50/50'
                                  : isReserved
                                    ? 'border-rose-100 bg-rose-50/30 hover:bg-rose-50/50'
                                    : 'border-stone-100 bg-white hover:bg-[#faf4ef]'
                              }`}
                            >
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                                  {table.id}
                                </span>
                                <h4 className="text-base font-black text-stone-800 leading-tight">
                                  {table.guest || '0 Guest'}
                                  {table.pax > 0 ? ` (${table.pax})` : ''}
                                </h4>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                                  {table.time || '--:--'}
                                </p>
                              </div>

                              <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-white ring-1 ring-stone-100 transition-colors">
                                <span
                                  className={`h-3 w-3 rounded-full ring-4 ring-white ${
                                    isServed
                                      ? 'bg-emerald-500'
                                      : isReserved
                                        ? 'bg-rose-500 animate-pulse'
                                        : 'bg-stone-300 group-hover:bg-[var(--ui-primary)]'
                                  }`}
                                />
                              </div>

                              <div className="mt-4 inline-flex rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-stone-500 ring-1 ring-stone-100 transition-colors group-hover:bg-[#f6eee8] group-hover:text-[var(--ui-primary)]">
                                {table.status}
                              </div>
                            </article>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                  {visibleTableGroups.length === 0 && (
                    <div className="rounded-[2rem] border-2 border-dashed border-stone-100 p-12 text-center text-sm font-bold uppercase tracking-widest text-stone-300">
                      No tables on {floor}
                    </div>
                  )}
                </div>
                <div className="mt-6 flex items-center gap-4 text-xs">
                  <p className="font-semibold text-stone-600">Table Status:</p>
                  <StatusDot color="bg-emerald-400" label="Served" />
                  <StatusDot color="bg-red-400" label="Reserved" />
                  <StatusDot color="bg-slate-200" label="Available" />
                </div>
              </>
            )}

            {tab === 'billing' && (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2">
                    {['All', 'Active', 'Closed'].map((item) => (
                      <button
                        key={item}
                        onClick={() => setBillingFilter(item)}
                        className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                          billingFilter === item
                            ? 'border border-[var(--ui-primary)]/20 bg-[#f6eee8] text-[var(--ui-primary)]'
                            : 'bg-stone-100/80 text-stone-500 hover:bg-[#f3ece6]'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setBillingFilter('Active')}
                    className="ui-btn ui-btn-secondary inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold text-stone-500 hover:bg-stone-50"
                  >
                    {billingQueue.filter((item) => item.status === 'active').length} Active Queue
                  </button>
                </div>

                <div className="divide-y divide-stone-100 rounded-[26px] border border-stone-100 bg-white">
                  {filteredBillingQueue.map((row) => (
                    <article key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-stone-50/50">
                      <div>
                        <p className="font-bold text-stone-900">{row.customer}</p>
                        <p className="text-sm font-medium text-stone-500">Order Number: {row.order}</p>
                        <p className="text-sm font-medium text-stone-400">
                          {row.table} - {formatDate(now)} - {row.time}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-stone-900">
                          {formatCurrency(row.amount, row.currency ?? 'USD')}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            row.status === 'active'
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-stone-100 text-stone-500'
                          }`}
                        >
                          {row.status}
                        </span>
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            onClick={() => openDetail('billing', row)}
                            className="ui-btn ui-btn-secondary px-2.5 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100"
                          >
                            Detail
                          </button>
                          {row.status === 'active' && (
                            <button
                              onClick={() => handleMarkOrder(row, 'Closed', 'Paid')}
                              disabled={updatingOrderNumber === row.order}
                              className="ui-btn ui-btn-primary px-2.5 py-1 text-xs font-bold disabled:bg-stone-300 disabled:shadow-none"
                            >
                              {updatingOrderNumber === row.order ? 'Saving...' : 'Close + Paid'}
                            </button>
                          )}
                          {row.status === 'closed' && (
                            <button
                              onClick={() => handleMarkOrder(row, 'Done', 'Paid')}
                              disabled={updatingOrderNumber === row.order}
                              className="ui-btn rounded-2xl border border-emerald-600 bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:bg-stone-300"
                            >
                              {updatingOrderNumber === row.order ? 'Saving...' : 'Mark Done'}
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                {actionError && (
                  <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-500">
                    {actionError}
                  </p>
                )}

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-bold text-stone-800">Track Order</h3>
                    <button
                      onClick={() => {
                        setTrackingSearchOpen((open) => !open)
                        if (trackingSearchOpen) setTrackingSearch('')
                      }}
                      className="ui-btn ui-btn-ghost ui-icon-btn text-stone-500 hover:bg-stone-100"
                    >
                      <Search size={16} />
                    </button>
                  </div>
                  {trackingSearchOpen && (
                    <input
                      value={trackingSearch}
                      onChange={(event) => setTrackingSearch(event.target.value)}
                      placeholder="Search tracking by customer, table, or status..."
                      className="ui-input mb-2 px-3 py-2 text-sm text-stone-700"
                    />
                  )}
                  <div className="scrollbar-hide flex gap-4 overflow-x-auto pb-4">
                    {filteredTrackingOrders.map((order) => (
                      <article
                        key={order.id}
                        className="group flex min-w-[300px] flex-col gap-4 overflow-hidden rounded-[28px] border border-stone-100 bg-white p-6 transition-colors hover:bg-[#faf4ef]"
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <h4 className="truncate text-base font-black text-stone-800 uppercase tracking-tight group-hover:text-[var(--ui-primary)] transition-colors">
                              {order.name}
                            </h4>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-stone-400">
                              {order.table} • {order.type}
                            </p>
                          </div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-50 text-stone-800 shadow-sm ring-1 ring-stone-100 group-hover:bg-stone-800 group-hover:text-white transition-all">
                            <span className="text-xs font-black uppercase tracking-widest">{order.id.replace(/\D/g, '') || '01'}</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
                             <span className="text-stone-400">Progress</span>
                             <span className={`rounded-full px-3 py-1 ring-1 ring-inset ${
                               order.status === 'All Done' || order.status === 'Ready'
                                ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' 
                                : 'bg-amber-50 text-amber-700 ring-amber-100'
                             }`}>
                               {order.status}
                             </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                            <div 
                              className={`h-full transition-all duration-1000 ${
                                (order.status === 'All Done' || order.status === 'Ready') ? 'w-full bg-emerald-500' : 'w-2/3 bg-amber-500 animate-pulse'
                              }`} 
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-stone-50">
                          <p className="text-sm font-black text-stone-800 leading-none">
                            {order.time}
                          </p>
                          <button className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-500 hover:bg-stone-800 hover:text-white transition-all">
                             <ArrowUpRight size={14} />
                          </button>
                        </div>
                      </article>
                    ))}
                    {filteredTrackingOrders.length === 0 && (
                      <div className="flex w-full items-center justify-center rounded-[2rem] border-2 border-dashed border-stone-100 py-12 text-sm font-bold uppercase tracking-widest text-stone-300">
                        No tracked orders found
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {tab === 'history' && (
              <div className="overflow-hidden rounded-[26px] border border-stone-100 bg-white">
                <div className="overflow-x-auto">
                  <div className="min-w-[760px]">
                    <div className="grid grid-cols-[88px_1.5fr_1fr_1fr_1fr_1fr_90px] gap-2 border-b border-stone-100 bg-stone-50 px-3 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-500">
                      <p>#</p>
                      <p>Date & Time</p>
                      <p>Customer Name</p>
                      <p>Order Status</p>
                      <p>Total Payment</p>
                      <p>Payment Status</p>
                      <p>Orders</p>
                    </div>
                    <div className="max-h-[560px] overflow-y-auto divide-y divide-stone-50">
                      {filteredHistoryRows.map((row) => (
                        <div
                          key={row.id + row.at}
                          className="grid grid-cols-[88px_1.5fr_1fr_1fr_1fr_1fr_90px] gap-2 px-3 py-4 text-sm text-stone-700 transition-colors hover:bg-stone-50/50"
                        >
                          <p className="font-bold">{row.id}</p>
                          <p className="font-medium">{row.at}</p>
                          <p className="font-bold">{row.customer}</p>
                          <p className="font-bold uppercase tracking-wider text-[11px] text-stone-500">{row.status}</p>
                          <p className="font-black text-stone-900">{formatCurrency(row.payment, row.currency ?? 'USD')}</p>
                          <p className={`font-bold uppercase tracking-widest text-[11px] ${row.paid ? 'text-[#1C8370]' : 'text-red-500'}`}>
                            {row.paid ? 'Paid' : 'Unpaid'}
                          </p>
                          <button
                            onClick={() => openDetail('history', row)}
                            className="text-[#7c4a32] font-bold hover:underline"
                          >
                            Detail
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {selectedRowDetail && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border border-stone-100 bg-white shadow-[0_24px_50px_rgba(41,37,36,0.12)] animate-in zoom-in-95 duration-200">
            <header className="flex items-center justify-between border-b border-stone-100 px-8 py-6">
              <h3 className="text-xl font-black text-stone-800 uppercase tracking-tight">Order Detail</h3>
              <button 
                onClick={() => setSelectedRowDetail(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-50 text-stone-400 transition-colors hover:bg-[#faf4ef] hover:text-[var(--ui-primary)]"
              >
                <X size={20} />
              </button>
            </header>

            <div className="max-h-[70vh] overflow-y-auto px-8 py-6">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Order ID</p>
                    <p className="text-sm font-bold text-stone-800">{selectedRowDetail.row.order ?? `#${selectedRowDetail.row.id}`}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Type</p>
                    <p className="text-sm font-bold text-stone-800 uppercase tracking-tight">{selectedRowDetail.type}</p>
                  </div>
                  <div className="space-y-1 text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Customer</p>
                    <p className="text-sm font-bold text-stone-800 truncate">{selectedRowDetail.row.customer ?? selectedRowDetail.row.name ?? 'Guest'}</p>
                  </div>
                   <div className="space-y-1 text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Status</p>
                    <span className="inline-flex rounded-full bg-stone-100 px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-stone-600 ring-1 ring-stone-200">
                      {selectedRowDetail.row.status ?? selectedRowDetail.row.state ?? 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="rounded-[1.5rem] bg-stone-50 p-5 ring-1 ring-stone-100">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Financial Summary</p>
                  <div className="space-y-2">
                    {'payment' in selectedRowDetail.row && (
                      <div className="flex justify-between text-sm">
                        <span className="font-bold text-stone-500">Total Payable</span>
                        <span className="font-black text-stone-800">
                          {formatCurrency(selectedRowDetail.row.payment, selectedRowDetail.row.currency ?? 'USD')}
                        </span>
                      </div>
                    )}
                    {'paymentMethod' in selectedRowDetail.row && (
                      <div className="flex justify-between text-sm">
                        <span className="font-bold text-stone-500">Method</span>
                        <span className="font-black text-stone-800">{selectedRowDetail.row.paymentMethod}</span>
                      </div>
                    )}
                    {'amountReceived' in selectedRowDetail.row && (
                      <div className="flex justify-between text-sm">
                        <span className="font-bold text-stone-500">Received</span>
                        <span className="font-black text-emerald-600">
                          {formatCurrency(
                            selectedRowDetail.row.amountReceived,
                            selectedRowDetail.row.paymentCurrency ?? selectedRowDetail.row.currency ?? 'USD',
                          )}
                        </span>
                      </div>
                    )}
                    {'changeAmount' in selectedRowDetail.row && (
                      <div className="flex justify-between text-sm">
                        <span className="font-bold text-stone-500">Change</span>
                        <span className="font-black text-amber-600">
                          {formatCurrency(
                            selectedRowDetail.row.changeAmount,
                            selectedRowDetail.row.paymentCurrency ?? selectedRowDetail.row.currency ?? 'USD',
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {Array.isArray(selectedRowDetail.row?.items) && selectedRowDetail.row.items.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Order Items</p>
                    <div className="space-y-2">
                      {selectedRowDetail.row.items.map((item, index) => (
                        <div key={`${item.productId}-${index}`} className="flex items-center justify-between rounded-2xl bg-white p-3 ring-1 ring-stone-100">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-stone-800">{item.productName}</p>
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Qty: {item.quantity}</p>
                          </div>
                          <span className="text-sm font-black text-stone-800">
                            {formatCurrency(
                              item.totalPrice,
                              selectedRowDetail.row.paymentCurrency ?? selectedRowDetail.row.currency ?? 'USD',
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {detailLoading && (
                  <div className="flex items-center justify-center py-4 gap-2 text-stone-400">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Loading Details...</span>
                  </div>
                )}
              </div>
            </div>

            <footer className="bg-stone-50 px-8 py-6">
               <button
                onClick={() => setSelectedRowDetail(null)}
                className="flex w-full h-12 items-center justify-center rounded-2xl bg-[var(--ui-primary)] text-white text-sm font-black uppercase tracking-widest shadow-lg shadow-stone-200 hover:bg-stone-800 transition-all active:scale-95"
              >
                Done
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
