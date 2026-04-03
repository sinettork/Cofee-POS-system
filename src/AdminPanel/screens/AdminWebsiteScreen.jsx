import { ExternalLink, Globe, ShoppingCart, UserRound } from 'lucide-react'

export function AdminWebsiteScreen({ settings, totalProducts = 0, totalCategories = 0 }) {
  return (
    <section className="space-y-4">
      <article className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Website Control Center</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">Website and Public Ordering</h2>
        <p className="mt-2 text-sm text-slate-600">
          Use this module to monitor customer-facing channels and keep checkout configuration in sync.
        </p>
      </article>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tax Rate</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900">{Number(settings?.taxRate ?? 10)}%</h3>
          <p className="mt-1 text-sm text-slate-500">Applied on website checkout totals.</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Catalog Items</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900">{Number(totalProducts).toLocaleString()}</h3>
          <p className="mt-1 text-sm text-slate-500">Visible to public menu and online order flow.</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Categories</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900">{Number(totalCategories).toLocaleString()}</h3>
          <p className="mt-1 text-sm text-slate-500">Used in website tab navigation and filters.</p>
        </article>
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Quick Links</p>
        <div className="grid gap-2 md:grid-cols-3">
          <a href="/" className="ui-btn ui-btn-secondary flex items-center justify-between px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-2"><Globe size={14} /> Open Website</span>
            <ExternalLink size={13} />
          </a>
          <a href="/order" className="ui-btn ui-btn-secondary flex items-center justify-between px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-2"><ShoppingCart size={14} /> Open Order Page</span>
            <ExternalLink size={13} />
          </a>
          <a href="/account" className="ui-btn ui-btn-secondary flex items-center justify-between px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-2"><UserRound size={14} /> Open Customer Login</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </article>
    </section>
  )
}
