import { createElement } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatCurrency } from '@shared/utils/format'

export function RailButton({ icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
        active
          ? 'bg-[var(--ui-primary)] text-white'
          : 'bg-white text-stone-400 ring-1 ring-stone-200 hover:bg-[#faf4ef] hover:text-[var(--ui-primary)]'
      }`}
    >
      {createElement(icon, { size: 18 })}
    </button>
  )
}

export function HeaderChip({ icon, label }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-600">
      {createElement(icon, { size: 14, className: 'text-stone-400' })}
      <span>{label}</span>
    </div>
  )
}

export function GhostSelect({ text }) {
  return (
    <button className="ui-btn ui-btn-secondary flex items-center justify-between px-3 py-2.5 text-sm text-stone-700 hover:border-stone-300">
      <span>{text}</span>
      <ChevronDown size={15} className="text-stone-400" />
    </button>
  )
}

export function PriceRow({ label, value, tone, currency = 'USD' }) {
  return (
    <div className="flex items-center justify-between">
      <p className={`font-medium ${tone === 'green' ? 'text-[#1C8370]' : 'text-slate-500'}`}>{label}</p>
      <p className="font-semibold text-slate-800">
        {tone === 'green' ? `- ${formatCurrency(value, currency)}` : formatCurrency(value, currency)}
      </p>
    </div>
  )
}

export function MetricCard({ title, value, unit, delta, growth, negative = false }) {
  return (
    <article className="ui-surface rounded-[22px] p-5">
      <p className="text-sm font-medium text-stone-500">{title}</p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-4xl font-bold leading-none text-stone-900">{value}</p>
        <p className="pb-1 text-sm text-stone-400">{unit}</p>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <p className={negative ? 'text-[#FC4A4A]' : 'text-[#1C8370]'}>{delta}</p>
        <p className={negative ? 'text-[#FC4A4A]' : 'text-[#1C8370]'}>{growth}</p>
      </div>
    </article>
  )
}

export function MiniMetric({ title, value, unit }) {
  return (
    <div className="ui-surface rounded-[20px] p-4">
      <p className="text-xs uppercase tracking-wide text-stone-400">{title}</p>
      <p className="mt-1 text-2xl font-bold text-stone-900">{value}</p>
      <p className="text-xs text-stone-400">{unit}</p>
    </div>
  )
}

export function StatusDot({ color, label }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="text-stone-500">{label}</span>
    </div>
  )
}
