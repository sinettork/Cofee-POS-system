import { Banknote, CheckCircle2, CreditCard, Loader2, QrCode, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatCurrency } from '../utils/format'

const METHODS = [
  { id: 'Cash', label: 'Cash', icon: Banknote },
  { id: 'KHQR', label: 'KHQR', icon: QrCode },
  { id: 'Card', label: 'Card', icon: CreditCard },
]

export function PaymentModal({
  totalAmount,
  currency = 'USD',
  initialPaymentMethod = 'Cash',
  loading = false,
  onClose,
  onConfirm,
}) {
  const defaultMethod = useMemo(
    () => (METHODS.some((item) => item.id === initialPaymentMethod) ? initialPaymentMethod : 'Cash'),
    [initialPaymentMethod],
  )
  const [step, setStep] = useState('method')
  const [selectedMethod, setSelectedMethod] = useState(defaultMethod)
  const [amountReceivedInput, setAmountReceivedInput] = useState(
    defaultMethod === 'Cash' ? '' : totalAmount.toFixed(2),
  )
  const [formError, setFormError] = useState('')
  const [cardProcessing, setCardProcessing] = useState(false)
  const [cardApproved, setCardApproved] = useState(false)
  const cardTimerRef = useRef(null)

  const khqrReference = useMemo(() => {
    const random = Math.random().toString(36).slice(2, 8).toUpperCase()
    return `KHQR-${Date.now().toString(36).toUpperCase()}-${random}`
  }, [])
  const khqrPixels = useMemo(() => {
    const seed = Array.from(khqrReference).reduce((sum, char) => sum + char.charCodeAt(0), 0)
    return Array.from({ length: 121 }, (_, index) => ((seed + index * 19 + (index % 11) * 7) % 9) < 4)
  }, [khqrReference])

  useEffect(() => {
    if (selectedMethod === 'Cash') return
    setAmountReceivedInput(totalAmount.toFixed(2))
  }, [selectedMethod, totalAmount])

  useEffect(
    () => () => {
      if (cardTimerRef.current) {
        clearTimeout(cardTimerRef.current)
      }
    },
    [],
  )

  const isCashPayment = selectedMethod === 'Cash'
  const parsedAmount = Number(amountReceivedInput)
  const isValidReceived = Number.isFinite(parsedAmount) && parsedAmount >= 0
  const amountReceived = isCashPayment ? (isValidReceived ? parsedAmount : 0) : totalAmount
  const remainingAmount = Math.max(0, totalAmount - amountReceived)
  const changeBackAmount = Math.max(0, amountReceived - totalAmount)

  const submitPayment = async ({ amountReceived: nextAmountReceived, changeAmount }) => {
    if (loading) return false
    setFormError('')
    const ok = await onConfirm?.({
      paymentMethod: selectedMethod,
      amountReceived: nextAmountReceived,
      changeAmount,
    })
    if (ok === false) {
      setFormError('Payment could not be completed. Please try again.')
      return false
    }
    return true
  }

  const handleCashCharge = async () => {
    if (loading) return
    if (isCashPayment && (!isValidReceived || amountReceived + 0.000001 < totalAmount)) {
      setFormError('Amount received is less than total payment.')
      return
    }
    await submitPayment({
      amountReceived,
      changeAmount: isCashPayment ? changeBackAmount : 0,
    })
  }

  const handleSelectMethod = (methodId) => {
    setSelectedMethod(methodId)
    setFormError('')
    setCardProcessing(false)
    setCardApproved(false)
  }

  const handleContinueFromMethod = () => {
    if (selectedMethod === 'Cash') {
      setStep('cash')
      return
    }
    if (selectedMethod === 'KHQR') {
      setStep('khqr')
      return
    }
    setStep('card')
  }

  const startCardProcessing = () => {
    if (loading || cardProcessing || cardApproved) return
    setFormError('')
    setCardProcessing(true)
    cardTimerRef.current = setTimeout(() => {
      setCardProcessing(false)
      setCardApproved(true)
    }, 1700)
  }

  const handleCardComplete = async () => {
    if (!cardApproved) return
    await submitPayment({
      amountReceived: totalAmount,
      changeAmount: 0,
    })
  }

  const handleKhqrComplete = async () => {
    await submitPayment({
      amountReceived: totalAmount,
      changeAmount: 0,
    })
  }

  if (step === 'method') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5">
        <div onClick={onClose} className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" />
        <section className="ui-modal-card relative z-10 w-full max-w-[420px] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment</p>
            <button
              onClick={onClose}
              className="ui-btn ui-btn-ghost ui-icon-btn h-8 w-8 text-slate-400 hover:text-slate-700"
            >
              <X size={15} />
            </button>
          </div>
          <h3 className="text-xl font-bold text-slate-900">Select Payment Method</h3>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Amount Due</p>
            <p className="mt-1 text-3xl font-black text-[#2D71F8]">{formatCurrency(totalAmount, currency)}</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {METHODS.map((method) => {
              const Icon = method.icon
              const active = selectedMethod === method.id
              return (
                <button
                  key={method.id}
                  onClick={() => handleSelectMethod(method.id)}
                  className={`rounded-xl border p-3 text-center transition-colors ${
                    active
                      ? 'border-[#2D71F8] bg-[#2D71F8]/5 text-[#2D71F8]'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="mb-1.5 flex justify-center">
                    <Icon size={20} />
                  </div>
                  <p className="text-sm font-semibold">{method.label}</p>
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onClose}
              className="ui-btn ui-btn-secondary px-3 py-2.5 text-sm text-slate-600"
            >
              Cancel
            </button>
            <button
              onClick={handleContinueFromMethod}
              className="ui-btn ui-btn-primary flex-1 px-3 py-2.5 text-sm"
            >
              Continue
            </button>
          </div>
        </section>
      </div>
    )
  }

  if (step === 'khqr') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5">
        <div onClick={onClose} className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" />
        <section className="ui-modal-card relative z-10 w-full max-w-[420px] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">KHQR Payment</p>
            <button
              onClick={onClose}
              className="ui-btn ui-btn-ghost ui-icon-btn h-8 w-8 text-slate-400 hover:text-slate-700"
            >
              <X size={15} />
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Amount Due</p>
            <p className="mt-1 text-2xl font-black text-[#2D71F8]">{formatCurrency(totalAmount, currency)}</p>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="mx-auto grid h-[188px] w-[188px] grid-cols-11 gap-0.5 rounded-md bg-white p-2">
                {khqrPixels.map((filled, index) => (
                  <span key={index} className={`rounded-[2px] ${filled ? 'bg-slate-900' : 'bg-slate-100'}`} />
                ))}
              </div>
              <p className="mt-2 text-center text-[11px] text-slate-500">Reference: {khqrReference}</p>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Customer scans KHQR and completes payment. Then confirm payment below.
            </p>
            {formError && <p className="mt-2 text-xs font-semibold text-[#FC4A4A]">{formError}</p>}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setStep('method')}
              disabled={loading}
              className="ui-btn ui-btn-secondary px-3 py-2.5 text-sm text-slate-600"
            >
              Back
            </button>
            <button
              onClick={handleKhqrComplete}
              disabled={loading}
              className="ui-btn ui-btn-primary flex-1 px-3 py-2.5 text-sm disabled:bg-slate-300 disabled:shadow-none"
            >
              {loading ? 'Processing...' : 'Payment Completed'}
            </button>
          </div>
        </section>
      </div>
    )
  }

  if (step === 'card') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5">
        <div onClick={onClose} className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" />
        <section className="ui-modal-card relative z-10 w-full max-w-[420px] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Card Payment</p>
            <button
              onClick={onClose}
              className="ui-btn ui-btn-ghost ui-icon-btn h-8 w-8 text-slate-400 hover:text-slate-700"
            >
              <X size={15} />
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Amount Due</p>
            <p className="mt-1 text-2xl font-black text-[#2D71F8]">{formatCurrency(totalAmount, currency)}</p>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
              <p>Tap/insert card on payment terminal to process this amount.</p>
              {cardProcessing && (
                <p className="mt-2 inline-flex items-center gap-2 text-[#2D71F8]">
                  <Loader2 size={14} className="animate-spin" />
                  Processing card...
                </p>
              )}
              {cardApproved && (
                <p className="mt-2 inline-flex items-center gap-2 font-semibold text-[#1C8370]">
                  <CheckCircle2 size={14} />
                  Card approved. Ready to complete order.
                </p>
              )}
            </div>
            {formError && <p className="mt-2 text-xs font-semibold text-[#FC4A4A]">{formError}</p>}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setStep('method')}
              disabled={loading || cardProcessing}
              className="ui-btn ui-btn-secondary px-3 py-2.5 text-sm text-slate-600"
            >
              Back
            </button>
            {!cardApproved ? (
              <button
                onClick={startCardProcessing}
                disabled={loading || cardProcessing}
                className="ui-btn ui-btn-primary flex-1 px-3 py-2.5 text-sm disabled:bg-slate-300 disabled:shadow-none"
              >
                {cardProcessing ? 'Processing...' : 'Start Processing'}
              </button>
            ) : (
              <button
                onClick={handleCardComplete}
                disabled={loading}
                className="ui-btn ui-btn-primary flex-1 px-3 py-2.5 text-sm disabled:bg-slate-300 disabled:shadow-none"
              >
                {loading ? 'Processing...' : 'Payment Completed'}
              </button>
            )}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5">
      <div onClick={onClose} className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" />
      <section className="ui-modal-card relative z-10 w-full max-w-[420px] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cash Payment</p>
            <button
              onClick={onClose}
              className="ui-btn ui-btn-ghost ui-icon-btn h-8 w-8 text-slate-400 hover:text-slate-700"
            >
            <X size={15} />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          {METHODS.map((method) => (
            <button
              key={method.id}
              onClick={() => {
                handleSelectMethod(method.id)
                if (method.id === 'KHQR') {
                  setStep('khqr')
                  return
                }
                if (method.id === 'Card') {
                  setStep('card')
                }
              }}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                selectedMethod === method.id
                  ? 'border-[#2D71F8] bg-[#2D71F8]/5 text-[#2D71F8]'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {method.label}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
            <p>Amount Settlement</p>
            <p>{currency}</p>
          </div>
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <p>Amount Due</p>
            <p className="font-semibold">{formatCurrency(totalAmount, currency)}</p>
          </div>
          <input
            type="number"
            min={0}
            step={0.01}
            value={amountReceivedInput}
            disabled={!isCashPayment}
            onChange={(event) => {
              setAmountReceivedInput(event.target.value)
              setFormError('')
            }}
            placeholder={`Enter paid amount (${currency})`}
            className="ui-input mb-2 px-3 py-2 text-sm font-semibold text-slate-700"
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white px-2.5 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Remaining</p>
              <p className={`text-sm font-bold ${remainingAmount > 0 ? 'text-[#FC4A4A]' : 'text-slate-700'}`}>
                {formatCurrency(remainingAmount, currency)}
              </p>
            </div>
            <div className="rounded-lg bg-white px-2.5 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Change Back</p>
              <p className="text-sm font-bold text-[#1C8370]">{formatCurrency(changeBackAmount, currency)}</p>
            </div>
          </div>
          {formError && <p className="mt-2 text-xs font-semibold text-[#FC4A4A]">{formError}</p>}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setStep('method')}
            disabled={loading}
            className="ui-btn ui-btn-secondary px-3 py-2.5 text-sm text-slate-600"
          >
            Back
          </button>
          <button
            onClick={handleCashCharge}
            disabled={loading}
            className="ui-btn ui-btn-primary flex-1 px-3 py-2.5 text-sm disabled:bg-slate-300 disabled:shadow-none"
          >
            {loading ? 'Processing...' : 'Charge & Place Order'}
          </button>
        </div>
      </section>
    </div>
  )
}
