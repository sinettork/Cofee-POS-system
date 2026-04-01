import { CheckCircle2, Minus, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { formatCurrency } from '../utils/format'

export function ProductModal({
  product,
  onClose,
  onAdd,
  currency = 'USD',
  exchangeRateKHR = 4100,
  maxQuantity = 99,
}) {
  const defaults = {}
  if (product.options) {
    Object.entries(product.options).forEach(([group, options]) => {
      defaults[group] = options[0]
    })
  }

  const [selectedOptions, setSelectedOptions] = useState(defaults)
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const safeMaxQuantity = Math.max(0, Math.floor(Number(maxQuantity ?? 0)))
  const isOutOfStock = safeMaxQuantity <= 0

  const optionCost = Object.values(selectedOptions).reduce((sum, item) => sum + item.price, 0)
  const total = (product.basePrice + optionCost) * quantity
  const displayAmount = (usdAmount) =>
    formatCurrency(currency === 'KHR' ? usdAmount * exchangeRateKHR : usdAmount, currency)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5">
      <div onClick={onClose} className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" />
      <section className="ui-modal-card relative z-10 flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-3xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Detail Menu</h3>
          <button onClick={onClose} className="ui-btn ui-btn-danger ui-icon-btn h-8 w-8 p-1.5 text-red-400">
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="flex gap-4">
            <img src={product.image} alt={product.name} className="h-24 w-24 rounded-2xl border border-slate-100 object-cover" />
            <div>
              <span className="inline-block rounded-md bg-[#1C8370]/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[#1C8370]">
                {product.label}
              </span>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">{product.name}</h2>
              <p className="mt-1 text-2xl font-black text-[#2D71F8]">{displayAmount(product.basePrice)}</p>
              <p className={`mt-1 text-xs font-semibold ${isOutOfStock ? 'text-[#FC4A4A]' : 'text-slate-400'}`}>
                {isOutOfStock ? 'Out of stock' : `Available: ${safeMaxQuantity}`}
              </p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-slate-500">{product.description}</p>

          {product.options &&
            Object.entries(product.options).map(([group, options]) => (
              <div key={group}>
                <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">{group}</h4>
                <div className="flex flex-wrap gap-2">
                  {options.map((option) => {
                    const active = selectedOptions[group]?.name === option.name
                    return (
                      <button
                        key={option.name}
                        onClick={() =>
                          setSelectedOptions((previous) => ({ ...previous, [group]: option }))
                        }
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                          active
                            ? 'border-[#2D71F8]/50 bg-[#2D71F8]/5 text-[#2D71F8]'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {active && <CheckCircle2 size={14} />}
                          {option.name}
                          {option.price > 0 ? ` (+${displayAmount(option.price)})` : ''}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add notes to your order..."
            className="ui-input bg-slate-50 px-3 py-2.5 text-sm"
          />
        </div>
        <footer className="space-y-3 border-t border-slate-100 bg-slate-50/70 p-5">
          <div className="mx-auto flex w-full max-w-[180px] items-center justify-between rounded-xl border border-slate-200 bg-white p-1.5">
            <button
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              disabled={isOutOfStock}
              className="ui-btn ui-btn-ghost rounded-lg p-2 text-slate-400 hover:text-slate-700"
            >
              <Minus size={16} />
            </button>
            <span className="w-7 text-center text-lg font-semibold text-slate-900">{quantity}</span>
            <button
              onClick={() => setQuantity((current) => Math.min(safeMaxQuantity, current + 1))}
              disabled={isOutOfStock || quantity >= safeMaxQuantity}
              className="ui-btn ui-btn-ghost rounded-lg p-2 text-slate-400 hover:text-slate-700"
            >
              <Plus size={16} />
            </button>
          </div>
          <button
            onClick={() => onAdd(product, selectedOptions, notes, quantity)}
            disabled={isOutOfStock}
            className="ui-btn ui-btn-primary flex w-full items-center justify-between px-5 py-3.5 text-white disabled:bg-slate-300 disabled:shadow-none"
          >
            <span className="text-base font-bold">{isOutOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
            <span className="text-lg font-bold">{displayAmount(total)}</span>
          </button>
        </footer>
      </section>
    </div>
  )
}
