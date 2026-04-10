import { Paperclip, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export function CartNoteModal({ item, onClose, onSave }) {
  const [noteValue, setNoteValue] = useState(String(item?.notes ?? ''))
  const textareaRef = useRef(null)

  useEffect(() => {
    setNoteValue(String(item?.notes ?? ''))
  }, [item?.cartId, item?.notes])

  useEffect(() => {
    const focusTimer = setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.select()
    }, 0)
    return () => clearTimeout(focusTimer)
  }, [])

  if (!item) return null

  const selectedOptionsLabel = Object.values(item.selectedOptions ?? {})
    .map((option) => option?.name)
    .filter(Boolean)
    .join(' • ')
  const hasNote = noteValue.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5">
      <div onClick={onClose} className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" />
      <section className="ui-modal-card relative z-10 w-full max-w-[460px] rounded-[2.25rem] p-6 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#f3fbf8] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#1C8370]">
              <Paperclip size={12} />
              Item Note
            </div>
            <h3 className="mt-3 text-2xl font-black tracking-tight text-stone-900">
              {item.product?.name ?? 'Cart item'}
            </h3>
            <p className="mt-1 text-sm font-medium text-stone-500">
              Add kitchen instructions like less sugar, extra hot, or allergy details.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-50 text-stone-400 transition-colors hover:bg-[#faf4ef] hover:text-[var(--ui-primary)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 rounded-[24px] border border-stone-100 bg-stone-50/70 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-400">Current Item</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-black text-stone-800">{item.product?.name ?? 'Cart item'}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
                Qty {item.quantity ?? 1}
              </p>
            </div>
            {selectedOptionsLabel && (
              <div className="max-w-[180px] text-right text-[11px] font-medium text-stone-500">
                {selectedOptionsLabel}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-[10px] font-bold uppercase tracking-[0.22em] text-stone-400">
            Note for this item
          </label>
          <textarea
            ref={textareaRef}
            value={noteValue}
            onChange={(event) => setNoteValue(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault()
                onSave(noteValue)
              }
            }}
            rows={5}
            placeholder="Example: less ice, oat milk, no onions, separate sauce..."
            className="ui-input mt-3 resize-none rounded-[24px] bg-stone-50/60 px-4 py-4 text-sm font-medium leading-6 text-stone-700"
          />
          <p className="mt-2 text-xs font-medium text-stone-400">
            Press Ctrl/Cmd + Enter to save quickly.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="ui-btn ui-btn-secondary px-5 py-3 text-sm text-stone-600"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => onSave('')}
            disabled={!hasNote}
            className="ui-btn ui-btn-secondary px-5 py-3 text-sm text-stone-600 disabled:opacity-50"
          >
            <Trash2 size={15} />
            <span>Remove Note</span>
          </button>

          <button
            type="button"
            onClick={() => onSave(noteValue)}
            className="ui-btn ui-btn-primary ml-auto px-6 py-3 text-sm"
          >
            Save Note
          </button>
        </div>
      </section>
    </div>
  )
}
