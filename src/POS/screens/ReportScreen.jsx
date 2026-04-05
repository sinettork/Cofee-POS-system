import {
  CalendarDays,
  ChevronDown,
  CircleDot,
  Clock3,
  Download,
  Filter,
  Menu,
  Power,
  Search,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { fetchReportSummary } from '@shared/api/client'
import { HeaderChip, MetricCard, MiniMetric } from '../components/common'
import { FAVORITES, REPORT_ORDER_ROWS } from '../constants/uiData'
import { formatCurrency, formatDate } from '@shared/utils/format'

export function ReportScreen({
  now,
  onOpenMenu,
  favorites = FAVORITES,
  reportOrderRows = REPORT_ORDER_ROWS,
  summary = {
    totalSales: 12650,
    totalOrders: 1250,
    totalCustomers: 400,
    netProfit: 12650,
  },
  onAction,
}) {
  const [period, setPeriod] = useState('Monthly')
  const [showGraph, setShowGraph] = useState(true)
  const [favoriteSearchOpen, setFavoriteSearchOpen] = useState(false)
  const [favoriteKeyword, setFavoriteKeyword] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('All')
  const [detailRow, setDetailRow] = useState(null)
  const [metricMode, setMetricMode] = useState('Total Sales Amount')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [summaryData, setSummaryData] = useState(summary)

  useEffect(() => {
    setSummaryData(summary)
  }, [summary])

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams()
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    fetchReportSummary(controller.signal, params.toString())
      .then((result) => setSummaryData(result))
      .catch((error) => {
        if (error?.name === 'AbortError') return
      })
    return () => controller.abort()
  }, [dateFrom, dateTo])

  const filteredFavorites = useMemo(() => {
    const keyword = favoriteKeyword.trim().toLowerCase()
    if (!keyword) return favorites
    return favorites.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword) ||
        item.category.toLowerCase().includes(keyword),
    )
  }, [favorites, favoriteKeyword])

  const filteredOrderRows = useMemo(() => {
    if (paymentFilter === 'All') return reportOrderRows
    return reportOrderRows.filter((row) => row.paymentState === paymentFilter)
  }, [paymentFilter, reportOrderRows])

  const miniMetricAmount = Number(summaryData.totalSales || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const miniMetricGrowth = Number(summaryData.netProfit || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const miniMetricGrowthPct =
    summaryData.totalSales > 0
      ? ((summaryData.netProfit / summaryData.totalSales) * 100).toFixed(1)
      : '0.0'
  const rangeLabel = dateFrom || dateTo ? `${dateFrom || '...'} - ${dateTo || '...'}` : 'All dates'

  const handleDownload = () => {
    const header = ['Order', 'Date', 'Customer', 'Status', 'Payment', 'PaymentState']
    const csvRows = filteredOrderRows.map((row) => [
      row.id,
      row.date,
      row.customer,
      row.state,
      Number(row.payment).toFixed(2),
      row.paymentState,
    ])
    const csv = [header, ...csvRows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `report-${period.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    onAction?.('Report CSV downloaded.')
  }

  const cyclePeriod = () => {
    setPeriod((current) => {
      const next = current === 'Monthly' ? 'Weekly' : current === 'Weekly' ? 'Daily' : 'Monthly'
      onAction?.(`Report period switched to ${next}.`)
      return next
    })
  }

  const cyclePaymentFilter = () => {
    setPaymentFilter((current) => {
      const next = current === 'All' ? 'Paid' : current === 'Paid' ? 'Unpaid' : 'All'
      onAction?.(`Order filter: ${next}.`)
      return next
    })
  }

  const applyRange = (preset) => {
    const nowDate = new Date()
    if (preset === 'today') {
      const day = formatDateInputLocal(nowDate)
      setDateFrom(day)
      setDateTo(day)
      return
    }
    if (preset === 'week') {
      const start = new Date(nowDate)
      start.setDate(start.getDate() - 7)
      setDateFrom(formatDateInputLocal(start))
      setDateTo(formatDateInputLocal(nowDate))
      return
    }
    if (preset === 'month') {
      const start = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1)
      setDateFrom(formatDateInputLocal(start))
      setDateTo(formatDateInputLocal(nowDate))
      return
    }
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="grid min-h-[100dvh] w-full grid-cols-1 overflow-hidden">
      <div className="flex min-h-0 h-full flex-col overflow-hidden bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-4 md:px-6">
          <div className="flex items-center gap-2">
            <button onClick={onOpenMenu} className="ui-btn ui-btn-ghost rounded-xl p-2 text-stone-500">
              <Menu size={18} />
            </button>
            <h1 className="text-xl font-semibold text-stone-900">Report</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="ui-btn ui-btn-secondary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-stone-600"
            >
              Download
              <Download size={14} />
            </button>
            <HeaderChip icon={CalendarDays} label={formatDate(now)} />
            <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-[#1C8370]">
              Open Order
            </div>
            <button
              onClick={() => {
                setPaymentFilter('All')
                setFavoriteKeyword('')
                onAction?.('Report filters reset.')
              }}
              className="ui-btn ui-btn-ghost ui-icon-btn text-[#1C8370] hover:bg-emerald-50"
            >
              <Power size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[24px] border border-stone-100 bg-[#fcfaf8] p-3">
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <span className="font-medium text-stone-700">Date Period:</span>
              <button
                onClick={cyclePeriod}
                className="ui-btn ui-btn-secondary inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm"
              >
                {period} <CalendarDays size={14} />
              </button>
            </div>
            <button
              onClick={() => {
                setShowGraph((current) => !current)
                onAction?.(showGraph ? 'Graph hidden.' : 'Graph shown.')
              }}
              className="ui-btn ui-btn-secondary inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm"
            >
              {showGraph ? 'Hide Graph' : 'Show Graph'}
              <CircleDot size={16} className={showGraph ? 'text-[var(--ui-primary)]' : 'text-stone-400'} />
            </button>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[24px] border border-stone-100 bg-white p-3">
            {['today', 'week', 'month', 'all'].map((preset) => (
              <button
                key={preset}
                onClick={() => applyRange(preset)}
                className="ui-btn ui-btn-secondary rounded-full px-3 py-1.5 text-xs text-stone-600"
              >
                {preset}
              </button>
            ))}
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="ui-input w-full sm:w-[168px] px-2.5 py-1.5 text-xs"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="ui-input w-full sm:w-[168px] px-2.5 py-1.5 text-xs"
            />
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Total Sales Amount"
              value={formatNumber(summaryData.totalSales)}
              unit="USD"
              delta={`Orders: ${formatNumber(summaryData.totalOrders)}`}
              growth="Live"
            />
            <MetricCard
              title="Total Product Sales"
              value={formatNumber(summaryData.totalOrders)}
              unit="Items"
              delta="From SQLite"
              growth="Live"
            />
            <MetricCard
              title="Total Customers"
              value={formatNumber(summaryData.totalCustomers)}
              unit="Persons"
              delta="Unique customers"
              growth="Live"
            />
            <MetricCard
              title="Net Profit"
              value={formatNumber(summaryData.netProfit)}
              unit="USD"
              delta="Total - Tax"
              growth="Live"
            />
          </div>

          <div className="mb-5 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <section className="ui-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-stone-900">Report Graph</h3>
                <button
                  onClick={() =>
                    setMetricMode((current) =>
                      current === 'Total Sales Amount' ? 'Total Orders' : 'Total Sales Amount',
                    )
                  }
                  className="ui-btn ui-btn-secondary inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-stone-600"
                >
                  {metricMode}
                  <ChevronDown size={14} />
                </button>
              </div>
              {showGraph ? (
                <div className="h-[220px] overflow-hidden rounded-[22px] border border-stone-100 bg-[linear-gradient(120deg,rgba(124,74,50,0.03),rgba(124,74,50,0.10))] p-3">
                  <svg viewBox="0 0 640 200" className="h-full w-full">
                    <path
                      d="M0 120 C30 90, 50 150, 90 120 C130 90, 160 35, 210 70 C245 95, 265 130, 300 100 C330 70, 360 55, 390 110 C420 160, 470 150, 520 95 C550 65, 590 100, 640 130"
                      fill="none"
                      stroke="#7c4a32"
                      strokeWidth="3"
                    />
                    <path
                      d="M0 120 C30 90, 50 150, 90 120 C130 90, 160 35, 210 70 C245 95, 265 130, 300 100 C330 70, 360 55, 390 110 C420 160, 470 150, 520 95 C550 65, 590 100, 640 130 L640 200 L0 200 Z"
                      fill="url(#reportFill)"
                    />
                    <defs>
                      <linearGradient id="reportFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#7c4a32" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="#7c4a32" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              ) : (
                <div className="flex h-[220px] items-center justify-center rounded-[22px] border border-dashed border-stone-200 bg-[#fcfaf8] text-sm text-stone-400">
                  Graph is hidden. Click "Show Graph" to display it.
                </div>
              )}
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <MiniMetric title="Amount" value={miniMetricAmount} unit="USD" />
                <MiniMetric title="Growth" value={miniMetricGrowth} unit="USD" />
                <MiniMetric title="Growth Percentage" value={miniMetricGrowthPct} unit="Percent (%)" />
              </div>
            </section>

            <section className="ui-surface p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-stone-900">Favorite Product</h3>
                <button
                  onClick={() => {
                    setFavoriteSearchOpen((open) => !open)
                    if (favoriteSearchOpen) setFavoriteKeyword('')
                  }}
                  className="ui-btn ui-btn-ghost ui-icon-btn text-stone-400"
                >
                  <Search size={15} />
                </button>
              </div>
              {favoriteSearchOpen && (
                <input
                  value={favoriteKeyword}
                  onChange={(event) => setFavoriteKeyword(event.target.value)}
                  placeholder="Search favorite product..."
                  className="ui-input mb-3 px-3 py-2 text-sm text-stone-700"
                />
              )}
              <div className="space-y-3">
                {filteredFavorites.map((item) => (
                  <article key={item.id} className="flex items-center justify-between rounded-[20px] border border-stone-100 px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <img src={item.image} alt={item.name} className="h-10 w-10 rounded-lg object-cover" />
                      <div>
                        <p className="text-sm font-semibold text-stone-900">{item.name}</p>
                        <p className="text-xs text-stone-400">{item.category}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-stone-700">{item.orderCount} Times</p>
                  </article>
                ))}
                {filteredFavorites.length === 0 && (
                  <div className="rounded-[20px] border border-dashed border-stone-200 px-3 py-3 text-sm text-stone-400">
                    No favorite products match this search.
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="ui-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-3 py-3">
              <h3 className="text-lg font-semibold text-stone-900">All Orders</h3>
              <div className="flex items-center gap-2">
                <HeaderChip icon={CalendarDays} label={rangeLabel} />
                <HeaderChip icon={Clock3} label="08:00 AM - 01:00 PM" />
                <button
                  onClick={cyclePaymentFilter}
                  className="ui-btn ui-btn-ghost ui-icon-btn text-stone-500"
                >
                  <Filter size={15} />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                <div className="grid grid-cols-[90px_1.5fr_1fr_1fr_1fr_1fr_100px] gap-2 bg-[#fcfaf8] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  <p>#</p>
                  <p>Date & Time</p>
                  <p>Customer Name</p>
                  <p>Order Status</p>
                  <p>Total Payment</p>
                  <p>Payment Status ({paymentFilter})</p>
                  <p>Orders</p>
                </div>
                <div className="max-h-[280px] overflow-y-auto">
                  {filteredOrderRows.map((row) => (
                    <div
                      key={row.id + row.customer}
                      className="grid grid-cols-[90px_1.5fr_1fr_1fr_1fr_1fr_100px] gap-2 border-t border-stone-100 px-3 py-3 text-sm text-stone-700"
                    >
                      <p>{row.id}</p>
                      <p>{row.date}</p>
                      <p>{row.customer}</p>
                      <p>{row.state}</p>
                      <p>{formatCurrency(row.payment, row.currency ?? 'USD')}</p>
                      <p className={row.paymentState === 'Paid' ? 'text-[#1C8370]' : 'text-[#FC4A4A]'}>
                        {row.paymentState}
                      </p>
                      <button onClick={() => setDetailRow(row)} className="font-semibold text-[var(--ui-primary)] hover:underline">
                        Detail
                      </button>
                    </div>
                  ))}
                  {filteredOrderRows.length === 0 && (
                    <div className="px-3 py-4 text-sm text-stone-400">No orders found for this payment filter.</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {detailRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[26px] border border-stone-100 bg-white p-5 shadow-[0_24px_50px_rgba(41,37,36,0.12)]">
            <h3 className="text-lg font-semibold text-stone-900">Report Order Detail</h3>
            <div className="mt-3 space-y-2 text-sm text-stone-600">
              <p>
                <span className="font-semibold text-stone-800">Order:</span> #{detailRow.id}
              </p>
              <p>
                <span className="font-semibold text-stone-800">Date:</span> {detailRow.date}
              </p>
              <p>
                <span className="font-semibold text-stone-800">Customer:</span> {detailRow.customer}
              </p>
              <p>
                <span className="font-semibold text-stone-800">Status:</span> {detailRow.state}
              </p>
              <p>
                <span className="font-semibold text-stone-800">Payment:</span>{' '}
                {formatCurrency(detailRow.payment, detailRow.currency ?? 'USD')}
              </p>
              <p>
                <span className="font-semibold text-stone-800">Payment State:</span>{' '}
                {detailRow.paymentState}
              </p>
              {detailRow.paymentMethod && (
                <p>
                  <span className="font-semibold text-stone-800">Payment Method:</span>{' '}
                  {detailRow.paymentMethod}
                </p>
              )}
              {Number.isFinite(detailRow.amountReceived) && (
                <p>
                  <span className="font-semibold text-stone-800">Received:</span>{' '}
                  {formatCurrency(
                    detailRow.amountReceived,
                    detailRow.paymentCurrency ?? detailRow.currency ?? 'USD',
                  )}
                </p>
              )}
              {Number.isFinite(detailRow.changeAmount) && (
                <p>
                  <span className="font-semibold text-stone-800">Change:</span>{' '}
                  {formatCurrency(
                    detailRow.changeAmount,
                    detailRow.paymentCurrency ?? detailRow.currency ?? 'USD',
                  )}
                </p>
              )}
            </div>
            <button
              onClick={() => setDetailRow(null)}
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

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function formatDateInputLocal(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
