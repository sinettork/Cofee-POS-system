import { LogOut, X } from 'lucide-react'

export function MainDrawer({ open, currentPage, items, currentUser, onNavigate, onClose, onSignOut }) {
  const roleLabel = String(currentUser?.role ?? 'cashier')
  const displayName = String(currentUser?.displayName ?? 'Tenant User')
  const primaryItems = items.filter((item) => ['pos', 'activity', 'report'].includes(item.id))
  const manageItems = items.filter((item) => ['inventory', 'teams', 'settings'].includes(item.id))
  const extraItems = items.filter(
    (item) => !['pos', 'activity', 'report', 'inventory', 'teams', 'settings'].includes(item.id),
  )

  const renderNavCard = (item, { compact = false } = {}) => {
    const Icon = item.icon
    const isActive = item.id === currentPage
    return (
      <button
        key={item.id}
        onClick={() => onNavigate(item.id)}
        className={`ui-btn flex w-full items-center justify-start gap-3 rounded-xl border px-3 text-sm transition-all ${
          compact ? 'py-2.5' : 'py-3'
        } ${
          isActive
            ? 'border-[#7c4a32]/30 bg-[#7c4a32]/10 text-[var(--ui-primary)] shadow-sm'
            : 'border-stone-200 bg-white text-stone-700 shadow-sm hover:border-stone-300 hover:bg-stone-50'
        }`}
      >
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${
            isActive
              ? 'border-[#7c4a32]/20 bg-[#7c4a32]/15 text-[var(--ui-primary)]'
              : 'border-stone-200 bg-stone-50 text-stone-500'
          }`}
        >
          <Icon size={16} />
        </span>
        <span className="font-semibold tracking-tight">{item.name}</span>
      </button>
    )
  }

  return (
    <div className={`fixed inset-0 z-40 transition ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/35 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
      />

      <aside
        className={`absolute left-0 top-0 h-full w-[290px] border-r border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(0,0,0,0.15)] transition-transform ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-5 flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
          <div>
            <p className="font-semibold text-slate-900">{displayName}</p>
            <p className="text-xs capitalize text-slate-400">{roleLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="ui-btn ui-btn-ghost ui-icon-btn p-1 text-[var(--ui-primary)] hover:bg-[#7c4a32]/10"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="space-y-3">
          <div>
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">POS</p>
            <div className="space-y-1.5">
              {primaryItems.map((item) => renderNavCard(item, { compact: true }))}
            </div>
          </div>

          {manageItems.length > 0 && (
            <div className="ui-surface rounded-2xl p-2">
              <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">Management</p>
              <div className="space-y-1.5">
                {manageItems.map((item) => renderNavCard(item, { compact: true }))}
              </div>
            </div>
          )}
        </nav>

        {extraItems.length > 0 && <nav className="mt-2 space-y-1.5">{extraItems.map((item) => renderNavCard(item))}</nav>}

        <button
          onClick={() => {
            onClose?.()
            onSignOut?.()
          }}
          className="ui-btn ui-btn-secondary absolute bottom-4 left-4 right-4 flex items-center justify-between px-3 py-2.5 text-sm text-slate-600"
        >
          Log Out
          <LogOut size={15} className="text-[#FC4A4A]" />
        </button>
      </aside>
    </div>
  )
}
