import { formatCurrency } from '@shared/utils/format'

export function AdminDashboardScreen({ summary, currentUser }) {
  const totalSales = Number(summary?.totalSales ?? 0)
  const totalOrders = Number(summary?.totalOrders ?? 0)
  const totalCustomers = Number(summary?.totalCustomers ?? 0)
  const netProfit = Number(summary?.netProfit ?? 0)
  const userName = String(currentUser?.displayName ?? currentUser?.username ?? 'Admin User')

  return (
    <section className="space-y-4">
      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Welcome Back</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">{userName}</h2>
        <p className="mt-1 text-sm text-slate-600">Monitor website and business operations from one place.</p>
      </article>

      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Revenue</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(totalSales, 'USD')}</h3>
          <p className="mt-1 text-sm text-slate-500">Current reporting period</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Orders</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900">{totalOrders.toLocaleString()}</h3>
          <p className="mt-1 text-sm text-slate-500">All channels combined</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Customers</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900">{totalCustomers.toLocaleString()}</h3>
          <p className="mt-1 text-sm text-slate-500">Tracked customers</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Net Profit</p>
          <h3 className="mt-2 text-2xl font-bold text-emerald-600">{formatCurrency(netProfit, 'USD')}</h3>
          <p className="mt-1 text-sm text-slate-500">Estimated profitability</p>
        </article>
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Revenue</p>
        <h3 className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(totalSales, 'USD')}</h3>
        <p className="mt-1 text-sm text-emerald-600">Use Report module for date-range analytics and exports.</p>
      </article>
    </section>
  )
}
