import { createElement } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatCurrency } from '@shared/utils/format'

export function RailButton({ icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`ui-btn h-11 w-11 ${
        active
          ? 'bg-[#2D71F8] text-white shadow-[0_8px_16px_rgba(45,113,248,0.28)]'
          : 'ui-btn-ghost text-slate-400 hover:text-[#2D71F8]'
      }`}
    >
      {createElement(icon, { size: 18 })}
    </button>
  )
}

export function HeaderChip({ icon, label }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600">
      {createElement(icon, { size: 14, className: 'text-slate-400' })}
      <span>{label}</span>
    </div>
  )
}

export function GhostSelect({ text }) {
  return (
    <button className="ui-btn ui-btn-secondary flex items-center justify-between px-3 py-2.5 text-sm text-slate-700 hover:border-slate-300">
      <span>{text}</span>
      <ChevronDown size={15} className="text-slate-400" />
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
    <article className="ui-surface p-4">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-4xl font-bold leading-none text-slate-900">{value}</p>
        <p className="pb-1 text-sm text-slate-400">{unit}</p>
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
    <div className="ui-surface p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400">{unit}</p>
    </div>
  )
}

export function StatusDot({ color, label }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="text-slate-500">{label}</span>
    </div>
  )
}
