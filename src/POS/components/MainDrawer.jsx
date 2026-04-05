import { LogOut, X } from 'lucide-react'

export function MainDrawer({ open, currentPage, items, currentUser, onNavigate, onClose, onSignOut }) {
  const roleLabel = String(currentUser?.role ?? 'cashier')
  const displayName = String(currentUser?.displayName ?? 'Tenant User')
  const orderedNavItems = [
    ...items.filter((item) => ['pos', 'activity', 'delivery', 'report'].includes(item.id)),
    ...items.filter((item) => ['inventory', 'teams', 'settings'].includes(item.id)),
    ...items.filter((item) => !['pos', 'activity', 'delivery', 'report', 'inventory', 'teams', 'settings'].includes(item.id)),
  ]

  const renderNavCard = (item, { compact = false } = {}) => {
    const Icon = item.icon
    const isActive = item.id === currentPage
    return (
      <button
        key={item.id}
        onClick={() => onNavigate(item.id)}
        className={`flex w-full appearance-none items-center justify-start gap-3.5 rounded-2xl px-3.5 text-sm transition-colors ${compact ? 'py-3' : 'py-3.5'
          } ${isActive
            ? 'bg-[#f6eee8] text-[var(--ui-primary)]'
            : 'bg-transparent text-stone-700 hover:bg-[#faf4ef]'
          }`}
      >
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${isActive
              ? 'bg-[var(--ui-primary)] text-white'
              : 'bg-stone-50 text-stone-400 ring-1 ring-stone-100'
            }`}
        >
          <Icon size={16} />
        </span>
        <span className={`tracking-tight ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.name}</span>
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
        className={`absolute left-0 top-0 h-full w-[290px] border-r border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(0,0,0,0.15)] transition-transform ${open ? 'translate-x-0' : '-translate-x-full'
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

        <nav className="space-y-1">
          {orderedNavItems.map((item) => renderNavCard(item, { compact: true }))}
        </nav>

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
