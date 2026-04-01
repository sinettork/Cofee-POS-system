import { CalendarDays, Menu, Power, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { HeaderChip, StatusDot } from '../components/common'
import { BILLING_QUEUE, HISTORY_ROWS, TABLE_GROUPS, TRACKING_ORDERS } from '../uiData'
import { formatCurrency, formatDate } from '../utils/format'

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
      onAction?.(`Order ${row.order} updated to ${status}.`)
    } catch (error) {
      setActionError(error.message || 'Failed to update order status.')
    } finally {
      setUpdatingOrderNumber('')
    }
  }

  const handleAddTable = () => {
    const targetTitles = floorGroups[floor] ?? []
    const targetTitle = targetTitles[0]
    if (!targetTitle) {
      setActionError(`Cannot add table on ${floor}. Configure a table group first.`)
      return
    }
    setActionError('')
    setLocalTableGroups((previous) => {
      const existingIds = previous.flatMap((group) => group.tables.map((table) => table.id))
      const nextNumber =
        existingIds
          .map((id) => Number(String(id).replace('T-', '')))
          .filter((value) => Number.isFinite(value))
          .reduce((max, value) => Math.max(max, value), 0) + 1
      const nextTable = {
        id: `T-${String(nextNumber).padStart(2, '0')}`,
        guest: '0 Guest',
        pax: 0,
        time: '--:--',
        status: 'available',
      }
      const targetIndex = previous.findIndex((group) => group.title === targetTitle)
      if (targetIndex === -1) {
        return [...previous, { title: targetTitle, tables: [nextTable] }]
      }
      return previous.map((group, index) =>
        index === targetIndex ? { ...group, tables: [...group.tables, nextTable] } : group,
      )
    })
    onAction?.(`Added a new table on ${floor}.`)
  }

  const handleCycleTableStatus = (groupTitle, tableId) => {
    const statusSequence = ['available', 'reserved', 'served']
    setLocalTableGroups((previous) =>
      previous.map((group) => {
        if (group.title !== groupTitle) return group
        return {
          ...group,
          tables: group.tables.map((table) => {
            if (table.id !== tableId) return table
            const currentIndex = statusSequence.indexOf(table.status)
            const nextStatus = statusSequence[(currentIndex + 1) % statusSequence.length]
            if (nextStatus === 'available') {
              return { ...table, status: nextStatus, guest: '0 Guest', pax: 0, time: '--:--' }
            }
            if (nextStatus === 'reserved') {
              return { ...table, status: nextStatus, guest: 'Reserved', pax: 2, time: '06:00 PM' }
            }
            return { ...table, status: nextStatus, guest: 'Walk-in', pax: 1, time: 'Now' }
          }),
        }
      }),
    )
    onAction?.(`Table ${tableId} status updated.`)
  }

  return (
    <div className="grid h-screen w-full grid-cols-1 overflow-hidden">
      <div className="grid min-h-0 h-full grid-cols-1 overflow-hidden bg-white lg:grid-cols-[240px_1fr]">
        <aside className="border-r border-slate-100 bg-slate-50/60 p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="ui-input bg-white py-2.5 pl-9 pr-3 text-sm"
              placeholder="Search customer / order / table..."
            />
          </div>
          <div className="space-y-2">
            <button
              onClick={() => setTab('billing')}
              className={`ui-btn w-full justify-start px-4 py-2.5 text-left text-sm ${
                tab === 'billing' ? 'bg-[#2D71F8] text-white' : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              Billing Queue
            </button>
            <button
              onClick={() => setTab('tables')}
              className={`ui-btn w-full justify-start px-4 py-2.5 text-left text-sm ${
                tab === 'tables' ? 'bg-[#2D71F8] text-white' : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              Tables
            </button>
            <button
              onClick={() => setTab('history')}
              className={`ui-btn w-full justify-start px-4 py-2.5 text-left text-sm ${
                tab === 'history' ? 'bg-[#2D71F8] text-white' : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              Order History
            </button>
          </div>
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-400">
            <p className="font-semibold text-[#2D71F8]">Bakehouse</p>
            <p>POS System</p>
            <p className="mt-2">The dreamy taste and magic of sweet moments in every bite from our bakery.</p>
          </div>
        </aside>

        <section className="flex flex-col overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 md:px-6">
            <div className="flex items-center gap-2">
              <button onClick={onOpenMenu} className="ui-btn ui-btn-ghost rounded-xl p-2 text-slate-500">
                <Menu size={18} />
              </button>
              <h1 className="text-xl font-semibold text-slate-900">
                Activity
                <span className="ml-1 text-sm font-medium text-slate-400">
                  /{' '}
                  {tab === 'billing'
                    ? 'Billing Queue'
                    : tab === 'tables'
                      ? 'Tables'
                      : 'Order History'}
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <HeaderChip icon={CalendarDays} label={formatDate(now)} />
              <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-[#1C8370]">
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
                    className="ui-btn ui-btn-secondary px-4 py-2 text-sm text-slate-700"
                  >
                    Add Table
                  </button>
                  <div className="flex gap-2">
                    {['1st Floor', '2nd Floor', '3rd Floor'].map((item) => (
                      <button
                        key={item}
                        onClick={() => setFloor(item)}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                          floor === item
                            ? 'border border-[#2D71F8]/60 bg-[#2D71F8]/5 text-[#2D71F8]'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-5">
                  {visibleTableGroups.map((group) => (
                    <section key={group.title}>
                      <h3 className="mb-3 text-sm font-semibold text-slate-500">{group.title}</h3>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {group.tables.map((table) => (
                          <article
                            key={table.id}
                            onClick={() => handleCycleTableStatus(group.title, table.id)}
                            className={`rounded-2xl border p-3 text-center ${
                              table.status === 'served'
                                ? 'border-[#2D71F8]/20 bg-[#2D71F8]/[0.03]'
                                : table.status === 'reserved'
                                  ? 'border-[#FC4A4A]/20 bg-[#FC4A4A]/[0.03]'
                                  : 'border-slate-100 bg-slate-50/70'
                            } cursor-pointer transition hover:-translate-y-0.5`}
                          >
                            <span
                              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                                table.status === 'served'
                                  ? 'bg-[#2D71F8] text-white'
                                  : table.status === 'reserved'
                                    ? 'bg-[#FC4A4A] text-white'
                                    : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {table.id}
                            </span>
                            <p className={`mt-2 text-xs ${table.status === 'reserved' ? 'text-[#FC4A4A]' : 'text-slate-500'}`}>
                              {table.guest}
                              {table.pax > 0 ? `: ${table.pax} Guests` : ''}
                            </p>
                            <p className="mt-2 text-xs text-slate-400">{table.time}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                  {visibleTableGroups.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                      No tables configured on {floor}.
                    </div>
                  )}
                </div>
                <div className="mt-6 flex items-center gap-4 text-xs">
                  <p className="font-semibold text-slate-600">Table Status:</p>
                  <StatusDot color="bg-slate-300" label="Available" />
                  <StatusDot color="bg-[#2D71F8]" label="Served" />
                  <StatusDot color="bg-[#FC4A4A]" label="Reserved" />
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
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                          billingFilter === item
                            ? 'border border-[#2D71F8]/60 bg-[#2D71F8]/5 text-[#2D71F8]'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setBillingFilter('Active')}
                    className="ui-btn ui-btn-secondary inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-slate-500"
                  >
                    {billingQueue.filter((item) => item.status === 'active').length} Active Queue
                  </button>
                </div>

                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
                  {filteredBillingQueue.map((row) => (
                    <article key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <p className="font-semibold text-slate-900">{row.customer}</p>
                        <p className="text-sm text-slate-500">Order Number: {row.order}</p>
                        <p className="text-sm text-slate-400">
                          {row.table} - {formatDate(now)} - {row.time}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-900">
                          {formatCurrency(row.amount, row.currency ?? 'USD')}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                            row.status === 'active'
                              ? 'bg-[#2D71F8]/10 text-[#2D71F8]'
                              : 'bg-red-50 text-[#FC4A4A]'
                          }`}
                        >
                          {row.status === 'active' ? 'Active' : 'Closed'}
                        </span>
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            onClick={() => setSelectedRowDetail({ type: 'billing', row })}
                            className="ui-btn ui-btn-secondary px-2.5 py-1 text-xs text-slate-600"
                          >
                            Detail
                          </button>
                          {row.status === 'active' && (
                            <button
                              onClick={() => handleMarkOrder(row, 'Closed', 'Paid')}
                              disabled={updatingOrderNumber === row.order}
                              className="ui-btn ui-btn-primary px-2.5 py-1 text-xs disabled:bg-slate-300 disabled:shadow-none"
                            >
                              {updatingOrderNumber === row.order ? 'Saving...' : 'Close + Paid'}
                            </button>
                          )}
                          {row.status === 'closed' && (
                            <button
                              onClick={() => handleMarkOrder(row, 'Done', 'Paid')}
                              disabled={updatingOrderNumber === row.order}
                              className="ui-btn rounded-lg border border-emerald-600 bg-emerald-600 px-2.5 py-1 text-xs text-white transition hover:bg-emerald-700 disabled:bg-slate-300"
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
                  <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-[#FC4A4A]">
                    {actionError}
                  </p>
                )}

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-800">Track Order</h3>
                    <button
                      onClick={() => {
                        setTrackingSearchOpen((open) => !open)
                        if (trackingSearchOpen) setTrackingSearch('')
                      }}
                      className="ui-btn ui-btn-ghost ui-icon-btn text-slate-500"
                    >
                      <Search size={16} />
                    </button>
                  </div>
                  {trackingSearchOpen && (
                    <input
                      value={trackingSearch}
                      onChange={(event) => setTrackingSearch(event.target.value)}
                      placeholder="Search tracking by customer, table, or status..."
                      className="ui-input mb-2 px-3 py-2 text-sm text-slate-700"
                    />
                  )}
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
                </div>
              </>
            )}

            {tab === 'history' && (
              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <div className="grid grid-cols-[88px_1.5fr_1fr_1fr_1fr_1fr_90px] gap-2 border-b border-slate-100 bg-slate-50 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <p>#</p>
                  <p>Date & Time</p>
                  <p>Customer Name</p>
                  <p>Order Status</p>
                  <p>Total Payment</p>
                  <p>Payment Status</p>
                  <p>Orders</p>
                </div>
                <div className="max-h-[560px] overflow-y-auto">
                  {filteredHistoryRows.map((row) => (
                    <div
                      key={row.id + row.at}
                      className="grid grid-cols-[88px_1.5fr_1fr_1fr_1fr_1fr_90px] gap-2 border-b border-slate-100 px-3 py-3 text-sm text-slate-700"
                    >
                      <p>{row.id}</p>
                      <p>{row.at}</p>
                      <p>{row.customer}</p>
                      <p>{row.status}</p>
                      <p>{formatCurrency(row.payment, row.currency ?? 'USD')}</p>
                      <p className={row.paid ? 'text-[#1C8370]' : 'text-[#FC4A4A]'}>
                        {row.paid ? 'Paid' : 'Unpaid'}
                      </p>
                      <button
                        onClick={() => setSelectedRowDetail({ type: 'history', row })}
                        className="text-[#2D71F8] hover:underline"
                      >
                        Detail
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {selectedRowDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Order Detail</h3>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-800">Type:</span> {selectedRowDetail.type}
              </p>
              <p>
                <span className="font-semibold text-slate-800">Order:</span>{' '}
                {selectedRowDetail.row.order ?? `#${selectedRowDetail.row.id}`}
              </p>
              <p>
                <span className="font-semibold text-slate-800">Customer:</span>{' '}
                {selectedRowDetail.row.customer ?? selectedRowDetail.row.name ?? 'N/A'}
              </p>
              <p>
                <span className="font-semibold text-slate-800">Status:</span>{' '}
                {selectedRowDetail.row.status ?? selectedRowDetail.row.state ?? 'N/A'}
              </p>
              {'table' in selectedRowDetail.row && (
                <p>
                  <span className="font-semibold text-slate-800">Table:</span>{' '}
                  {selectedRowDetail.row.table}
                </p>
              )}
              {'payment' in selectedRowDetail.row && (
                <p>
                  <span className="font-semibold text-slate-800">Payment:</span>{' '}
                  {formatCurrency(
                    selectedRowDetail.row.payment,
                    selectedRowDetail.row.currency ?? 'USD',
                  )}
                </p>
              )}
              {'paymentMethod' in selectedRowDetail.row && (
                <p>
                  <span className="font-semibold text-slate-800">Payment Method:</span>{' '}
                  {selectedRowDetail.row.paymentMethod}
                </p>
              )}
              {'amountReceived' in selectedRowDetail.row && (
                <p>
                  <span className="font-semibold text-slate-800">Received:</span>{' '}
                  {formatCurrency(
                    selectedRowDetail.row.amountReceived,
                    selectedRowDetail.row.paymentCurrency ?? selectedRowDetail.row.currency ?? 'USD',
                  )}
                </p>
              )}
              {'changeAmount' in selectedRowDetail.row && (
                <p>
                  <span className="font-semibold text-slate-800">Change:</span>{' '}
                  {formatCurrency(
                    selectedRowDetail.row.changeAmount,
                    selectedRowDetail.row.paymentCurrency ?? selectedRowDetail.row.currency ?? 'USD',
                  )}
                </p>
              )}
            </div>
            <button
              onClick={() => setSelectedRowDetail(null)}
              className="ui-btn ui-btn-primary mt-4 w-full py-2.5 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
