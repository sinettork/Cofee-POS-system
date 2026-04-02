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
      <div onClick={onClose} className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" />
      <section className="ui-modal-card relative z-10 flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[2.5rem]">
        <header className="flex items-center justify-between border-b border-stone-100 px-8 py-6">
          <h3 className="text-xl font-black text-stone-800 uppercase tracking-tight">Detail Menu</h3>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-50 text-stone-400 hover:bg-stone-800 hover:text-white transition-all">
            <X size={20} />
          </button>
        </header>
        <div className="flex-1 space-y-6 overflow-y-auto p-8">
          <div className="flex gap-6">
            <img src={product.image} alt={product.name} className="h-28 w-28 rounded-3xl border border-stone-100 object-cover shadow-sm" />
            <div className="flex-1 min-w-0">
              <span className="inline-block rounded-full bg-[#1C8370]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#1C8370]">
                {product.label}
              </span>
              <h2 className="mt-2 truncate text-2xl font-black text-stone-900 leading-tight" title={product.name}>{product.name}</h2>
              <p className="mt-1 text-2xl font-black text-[#7c4a32]">{displayAmount(product.basePrice)}</p>
              <p className={`mt-1 text-[10px] font-bold uppercase tracking-widest ${isOutOfStock ? 'text-red-500' : 'text-stone-400'}`}>
                {isOutOfStock ? 'Out of stock' : `Available: ${safeMaxQuantity}`}
              </p>
            </div>
          </div>
          <p className="text-sm font-medium leading-relaxed text-stone-500">{product.description}</p>

          {product.options &&
            Object.entries(product.options).map(([group, options]) => (
              <div key={group}>
                <h4 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-stone-400">{group}</h4>
                <div className="flex flex-wrap gap-2">
                  {options.map((option) => {
                    const active = selectedOptions[group]?.name === option.name
                    return (
                      <button
                        key={option.name}
                        onClick={() =>
                          setSelectedOptions((previous) => ({ ...previous, [group]: option }))
                        }
                        className={`rounded-2xl border px-4 py-2.5 text-xs font-bold transition-all ${
                          active
                            ? 'border-[#7c4a32] bg-[#7c4a32] text-white shadow-lg shadow-amber-900/10'
                            : 'border-stone-200 text-stone-500 hover:bg-stone-50'
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {active && <CheckCircle2 size={14} />}
                          {option.name}
                          {option.price > 0 ? (
                            <span className={active ? 'text-white/70' : 'text-stone-400'}>
                              (+{displayAmount(option.price)})
                            </span>
                          ) : ''}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Order Notes</h4>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Any special requests? (e.g. less ice, no sugar)"
              rows={2}
              className="ui-input bg-stone-50/50 px-4 py-3 text-sm font-medium resize-none border-stone-100 focus:bg-white"
            />
          </div>
        </div>
        <footer className="space-y-4 border-t border-stone-100 bg-stone-50/30 p-8">
          <div className="mx-auto flex w-full max-w-[180px] items-center justify-between rounded-2xl border border-stone-200 bg-white p-1.5 shadow-sm">
            <button
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              disabled={isOutOfStock}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-stone-400 transition-colors hover:bg-stone-50 hover:text-stone-900"
            >
              <Minus size={18} />
            </button>
            <span className="w-7 text-center text-lg font-black text-stone-900 tabular-nums">{quantity}</span>
            <button
              onClick={() => setQuantity((current) => Math.min(safeMaxQuantity, current + 1))}
              disabled={isOutOfStock || quantity >= safeMaxQuantity}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-stone-400 transition-colors hover:bg-stone-50 hover:text-stone-900"
            >
              <Plus size={18} />
            </button>
          </div>
          <button
            onClick={() => onAdd(product, selectedOptions, notes, quantity)}
            disabled={isOutOfStock}
            className="ui-btn ui-btn-primary flex w-full items-center justify-between px-8 py-5 text-white shadow-xl shadow-amber-900/10 disabled:bg-stone-200 disabled:shadow-none transition-all active:scale-[0.98]"
          >
            <span className="text-lg font-black uppercase tracking-tight">{isOutOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
            <span className="text-xl font-black tabular-nums">{displayAmount(total)}</span>
          </button>
        </footer>
      </section>
    </div>
  )
}
