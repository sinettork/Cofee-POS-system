import { Banknote, CheckCircle2, CreditCard, Loader2, QrCode, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchKhqrStatus, generateKhqr } from '@shared/api/client'
import KHQRCard from '@shared/components/KHQRCard'
import { formatCurrency } from '@shared/utils/format'
import { ReceiptView } from './ReceiptView'

const METHODS = [
  { id: 'Cash', label: 'Cash', icon: Banknote },
  { id: 'KHQR', label: 'KHQR', icon: QrCode },
  { id: 'Card', label: 'Card', icon: CreditCard },
]

const KHQR_SALE_WINDOW_SECONDS = 180

function createKhqrBillNumber() {
  const stamp = new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14)
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `INV-${stamp}-${random}`
}

function formatCountdown(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0))
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0')
  const remain = String(safeSeconds % 60).padStart(2, '0')
  return `${minutes}:${remain}`
}

export function PaymentModal({
                               totalAmount,
                               currency = 'USD',
                               initialPaymentMethod = 'Cash',
                               loading = false,
                               cart = [],
                               customerName = '',
                               tableName = '',
                               orderType = '',
                               subtotal = 0,
                               tax = 0,
                               discount = 0,
                               onClose,
                               onConfirm,
                               onNewOrder,
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
  const [receiptData, setReceiptData] = useState(null)
  const [khqrData, setKhqrData] = useState(null)
  const [khqrLoading, setKhqrLoading] = useState(false)
  const [khqrPolling, setKhqrPolling] = useState(false)
  const [khqrStatusMessage, setKhqrStatusMessage] = useState('')
  const [khqrCountdownSeconds, setKhqrCountdownSeconds] = useState(0)

  const cardTimerRef = useRef(null)
  const khqrSubmittingRef = useRef(false)
  const khqrAutoAttemptedRef = useRef(false)
  const khqrExpiredByTimerRef = useRef(false)

  useEffect(() => {
    if (selectedMethod === 'Cash') return
    setAmountReceivedInput(totalAmount.toFixed(2))
  }, [selectedMethod, totalAmount])

  useEffect(
      () => () => {
        if (cardTimerRef.current) clearTimeout(cardTimerRef.current)
      },
      [],
  )

  const isCashPayment = selectedMethod === 'Cash'
  const parsedAmount = Number(amountReceivedInput)
  const isValidReceived = Number.isFinite(parsedAmount) && parsedAmount >= 0
  const amountReceived = isCashPayment ? (isValidReceived ? parsedAmount : 0) : totalAmount
  const remainingAmount = Math.max(0, totalAmount - amountReceived)
  const changeBackAmount = Math.max(0, amountReceived - totalAmount)
  const hasAmountInput = String(amountReceivedInput).trim().length > 0
  const quickCashAdjustments = currency === 'KHR' ? [1000, 5000, 10000] : [1, 5, 10]
  const canChargeCash = !loading && isCashPayment && isValidReceived && amountReceived + 0.000001 >= totalAmount

  const submitPayment = useCallback(
    async ({ amountReceived: nextAmountReceived, changeAmount }) => {
      if (loading) return false

      setFormError('')
      const cartSnapshot = cart.map((item) => ({ ...item }))

      let result
      try {
        result = await onConfirm?.({
          paymentMethod: selectedMethod,
          amountReceived: nextAmountReceived,
          changeAmount,
        })

        if (result === false || !result) {
          setFormError('Payment could not be completed. Please try again.')
          return false
        }
      } catch (error) {
        setFormError(error.message || 'Payment could not be completed. Please try again.')
        return false
      }

      setReceiptData({
        orderNumber: String(result.orderNumber ?? 'N/A'),
        customerName: customerName || 'Walk-in',
        tableName: tableName || '',
        orderType: orderType || '',
        items: cartSnapshot,
        subtotal: Number(subtotal ?? 0),
        tax: Number(tax ?? 0),
        discount: Number(discount ?? 0),
        total: Number(totalAmount ?? 0),
        paymentMethod: selectedMethod,
        amountReceived: Number(nextAmountReceived ?? 0),
        changeAmount: Number(changeAmount ?? 0),
        receiverName: selectedMethod === 'KHQR' ? String(khqrData?.merchantName ?? '') : '',
        receiverAccount: selectedMethod === 'KHQR' ? String(khqrData?.accountId ?? '') : '',
        currency,
        createdAt: new Date(),
      })

      return true
    },
    [
      cart,
      currency,
      customerName,
      discount,
      loading,
      onConfirm,
      orderType,
      selectedMethod,
      subtotal,
      tableName,
      tax,
      totalAmount,
      khqrData?.merchantName,
      khqrData?.accountId,
    ],
  )

  const createKhqrCode = useCallback(async () => {
    setFormError('')
    setKhqrStatusMessage('')
    setKhqrLoading(true)
    setKhqrCountdownSeconds(0)
    khqrSubmittingRef.current = false
    khqrExpiredByTimerRef.current = false

    try {
      const billNumber = createKhqrBillNumber()
      const rawAmount = Number(totalAmount ?? 0)
      const khqrAmount = currency === 'KHR' ? Math.round(rawAmount) : Number(rawAmount.toFixed(2))

      const payload = await generateKhqr({
        amount: khqrAmount,
        billNumber,
        currency,
      })

      setKhqrData(payload)
      setKhqrCountdownSeconds(KHQR_SALE_WINDOW_SECONDS)
      setKhqrStatusMessage('Waiting for customer payment confirmation...')
    } catch (error) {
      setKhqrData(null)
      setKhqrCountdownSeconds(0)
      setFormError(error.message || 'Unable to generate KHQR right now.')
    } finally {
      setKhqrLoading(false)
    }
  }, [currency, totalAmount])

  const checkKhqrStatusOnce = useCallback(async () => {
    if (!khqrData?.md5 || khqrSubmittingRef.current) return

    setKhqrPolling(true)
    setFormError('')

    try {
      const status = await fetchKhqrStatus(khqrData.md5)

      if (status?.status === 'EXPIRED') {
        khqrSubmittingRef.current = true
        setKhqrStatusMessage('KHQR expired. Please regenerate a new QR.')
        setKhqrCountdownSeconds(0)
        return
      }

      if (!status?.paid) {
        setKhqrStatusMessage('Waiting for customer payment confirmation...')
        return
      }

      setKhqrStatusMessage('Payment received. Completing order...')
      khqrSubmittingRef.current = true

      const ok = await submitPayment({
        amountReceived: Number(totalAmount),
        changeAmount: 0,
      })

      if (!ok) khqrSubmittingRef.current = false
    } catch (error) {
      setFormError(error.message || 'Unable to check KHQR payment status.')
    } finally {
      setKhqrPolling(false)
    }
  }, [khqrData?.md5, submitPayment, totalAmount])

  useEffect(() => {
    if (step !== 'khqr' || selectedMethod !== 'KHQR') {
      khqrAutoAttemptedRef.current = false
      return
    }
    if (khqrData || khqrLoading || khqrAutoAttemptedRef.current) return
    khqrAutoAttemptedRef.current = true
    createKhqrCode()
  }, [khqrData, khqrLoading, selectedMethod, step, totalAmount, currency, createKhqrCode])

  useEffect(() => {
    if (step !== 'khqr' || selectedMethod !== 'KHQR' || !khqrData?.md5) return undefined
    if (khqrCountdownSeconds <= 0) return undefined

    const timeoutId = setTimeout(() => {
      setKhqrCountdownSeconds((previous) => Math.max(0, previous - 1))
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [khqrCountdownSeconds, khqrData, selectedMethod, step])

  useEffect(() => {
    if (step !== 'khqr' || selectedMethod !== 'KHQR' || !khqrData?.md5) {
      khqrExpiredByTimerRef.current = false
      return
    }

    if (khqrCountdownSeconds > 0 || khqrExpiredByTimerRef.current) return

    khqrExpiredByTimerRef.current = true
    khqrSubmittingRef.current = true
    setKhqrData(null)
    setKhqrStatusMessage('KHQR expired after 180 seconds. Seller needs to start again.')
  }, [khqrCountdownSeconds, khqrData, selectedMethod, step])

  useEffect(() => {
    if (step !== 'khqr' || selectedMethod !== 'KHQR' || !khqrData?.md5) return undefined

    let active = true
    let timerId

    const tick = async () => {
      if (!active) return
      await checkKhqrStatusOnce()
    }

    tick()
    timerId = setInterval(tick, 5000)

    return () => {
      active = false
      clearInterval(timerId)
    }
  }, [khqrData, selectedMethod, step, checkKhqrStatusOnce])

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

  const applyQuickReceivedAmount = (mode) => {
    if (!isCashPayment) return

    if (mode === 'exact') {
      setAmountReceivedInput(totalAmount.toFixed(2))
      setFormError('')
      return
    }

    const increment = Number(mode)
    if (!Number.isFinite(increment) || increment <= 0) return

    const current = isValidReceived ? parsedAmount : 0
    const next = current + increment
    setAmountReceivedInput(next.toFixed(currency === 'KHR' ? 0 : 2))
    setFormError('')
  }

  const handleSelectMethod = (methodId) => {
    setSelectedMethod(methodId)
    setFormError('')
    setCardProcessing(false)
    setCardApproved(false)
    setKhqrData(null)
    setKhqrCountdownSeconds(0)
    setKhqrStatusMessage('')
    khqrSubmittingRef.current = false
    khqrAutoAttemptedRef.current = false
    khqrExpiredByTimerRef.current = false
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

  if (receiptData) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" />
          <section className="ui-modal-card relative z-10 w-full max-w-[440px] p-4 rounded-[2.5rem]">
            <ReceiptView
                data={receiptData}
                onNewOrder={() => {
                  const completedReceipt = receiptData
                  setReceiptData(null)
                  if (onNewOrder) {
                    onNewOrder(completedReceipt)
                    return
                  }
                  onClose?.()
                }}
            />
          </section>
        </div>
    )
  }

  if (step === 'method') {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5">
          <div onClick={onClose} className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" />
          <section className="ui-modal-card relative z-10 w-full max-w-[420px] p-8 rounded-[2.5rem]">
            <div className="mb-6 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Payment</p>
              <button
                  onClick={onClose}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-50 text-stone-400 hover:bg-stone-800 hover:text-white transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <h3 className="text-2xl font-black text-stone-800 uppercase tracking-tight">Payment Method</h3>

            <div className="mt-6 rounded-3xl border border-stone-100 bg-stone-50/50 p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Amount Due</p>
              <p className="mt-1 text-4xl font-black text-[#7c4a32] tabular-nums">
                {formatCurrency(totalAmount, currency)}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {METHODS.map((method) => {
                const Icon = method.icon
                const active = selectedMethod === method.id
                return (
                    <button
                        key={method.id}
                        onClick={() => handleSelectMethod(method.id)}
                        className={`flex flex-col items-center gap-3 rounded-2xl border-2 p-4 transition-all duration-300 ${
                            active
                                ? 'border-[#7c4a32] bg-[#7c4a32] text-white shadow-lg shadow-amber-900/10'
                                : 'border-stone-100 bg-white text-stone-500 hover:border-stone-200 hover:bg-stone-50'
                        }`}
                    >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-white/20' : 'bg-stone-50 text-stone-400'}`}>
                           <Icon size={20} />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest">{method.label}</span>
                    </button>
                )
              })}
            </div>

            <div className="mt-8 flex items-center gap-3">
              <button
                  onClick={onClose}
                  className="ui-btn ui-btn-secondary px-6 py-4 text-sm font-bold text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                  onClick={handleContinueFromMethod}
                  className="ui-btn ui-btn-primary flex-1 py-4 text-lg font-black uppercase tracking-tight shadow-xl shadow-amber-900/10 transition-all active:scale-[0.98]"
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

          <section className="ui-modal-card relative z-10 w-full max-w-[460px] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                KHQR Payment
              </p>
              <button
                  onClick={onClose}
                  className="ui-btn ui-btn-ghost ui-icon-btn h-8 w-8 text-slate-400 hover:text-slate-700"
              >
                <X size={15} />
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
              <div className="mx-auto w-full max-w-[300px]">
                <KHQRCard
                  amount={totalAmount}
                  currency={currency}
                  accountName={khqrData?.merchantName || ''}
                  qrValue={khqrData?.qr || ''}
                />
              </div>

              <div className="mx-auto mt-4 w-full max-w-[320px]">
                <div className="flex items-center justify-center">
                  <span
                      className={`rounded-full px-4 py-1.5 text-base font-black tabular-nums ${
                          khqrCountdownSeconds > 30
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                      }`}
                  >
                  {formatCountdown(khqrCountdownSeconds)}
                </span>
                </div>

                {khqrLoading && (
                    <div className="mt-3 flex items-center justify-center text-sm text-slate-500">
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Generating KHQR...
                    </div>
                )}

                {khqrStatusMessage && (
                    <p className="mt-2 inline-flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-[#1C8370]">
                      <CheckCircle2 size={13} />
                      {khqrStatusMessage}
                    </p>
                )}

                {formError && (
                    <p className="mt-2 text-center text-xs font-semibold text-[#FC4A4A]">
                      {formError}
                    </p>
                )}
              </div>
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
                  onClick={createKhqrCode}
                  disabled={loading || khqrLoading}
                  className="ui-btn ui-btn-secondary px-3 py-2.5 text-sm text-slate-600"
              >
                {khqrData?.qr ? 'Regenerate' : 'Start Again'}
              </button>

              <button
                  onClick={checkKhqrStatusOnce}
                  disabled={
                      loading ||
                      khqrLoading ||
                      !khqrData?.md5 ||
                      khqrSubmittingRef.current ||
                      khqrCountdownSeconds <= 0
                  }
                  className="ui-btn ui-btn-primary flex-1 px-3 py-2.5 text-sm disabled:bg-slate-300 disabled:shadow-none"
              >
                {khqrPolling ? 'Checking...' : 'Check Now'}
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
              <p className="mt-1 text-2xl font-black text-[#2D71F8]">
                {formatCurrency(totalAmount, currency)}
              </p>

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
        <div onClick={onClose} className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" />
        <section className="ui-modal-card relative z-10 w-full max-w-[420px] p-8 rounded-[2.5rem]">
          <div className="mb-6 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Cash Payment</p>
            <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-50 text-stone-400 hover:bg-stone-800 hover:text-white transition-all"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mb-6 rounded-3xl border border-stone-100 bg-stone-50/50 p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Amount due</p>
            <p className="tabular-nums mt-1 text-4xl font-black tracking-tight text-[#7c4a32]">
              {formatCurrency(totalAmount, currency)}
            </p>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-3">
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
                    className={`rounded-2xl border-2 px-3 py-3 text-xs font-bold uppercase tracking-widest transition-all ${
                        selectedMethod === method.id
                            ? 'border-[#7c4a32] bg-[#7c4a32] text-white shadow-lg shadow-amber-900/10'
                            : 'border-stone-100 bg-white text-stone-500 hover:border-stone-200 hover:bg-stone-50'
                    }`}
                >
                  {method.label}
                </button>
            ))}
          </div>

          <div className="rounded-3xl border border-stone-100 bg-white p-6 shadow-sm ring-1 ring-stone-100">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Received</p>
              <p className="rounded-lg bg-stone-100 px-3 py-1 text-[10px] font-black text-stone-600">
                {currency}
              </p>
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
                placeholder={`Enter amount...`}
                className="ui-input mb-4 px-4 py-4 text-2xl font-black tabular-nums text-stone-800 bg-stone-50/30"
            />

            {isCashPayment && hasAmountInput && isValidReceived && remainingAmount > 0 && (
                <p className="mb-4 text-xs font-bold text-red-500">
                  Need {formatCurrency(remainingAmount, currency)} more.
                </p>
            )}

            {!isValidReceived && hasAmountInput && (
                <p className="mb-4 text-xs font-bold text-red-500">Invalid amount.</p>
            )}

            <div className="mb-6 grid grid-cols-4 gap-2">
              <button
                  onClick={() => applyQuickReceivedAmount('exact')}
                  disabled={!isCashPayment}
                  className="ui-btn ui-btn-secondary h-10 rounded-xl px-2 text-[10px] font-black uppercase tracking-widest text-stone-600 hover:bg-stone-50"
              >
                Exact
              </button>

              {quickCashAdjustments.map((value) => (
                  <button
                      key={`cash-add-${value}`}
                      onClick={() => applyQuickReceivedAmount(value)}
                      disabled={!isCashPayment}
                      className="ui-btn ui-btn-secondary h-10 rounded-xl px-2 text-[10px] font-black uppercase tracking-widest text-stone-600 hover:bg-stone-50"
                  >
                    +{formatCurrency(value, currency)}
                  </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-0 overflow-hidden rounded-2xl border border-stone-100 bg-stone-50/50">
              <div className="border-r border-stone-100 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Remaining</p>
                <p
                    className={`tabular-nums text-2xl leading-tight font-black ${
                        remainingAmount > 0 ? 'text-red-500' : 'text-stone-700'
                    }`}
                >
                  {formatCurrency(remainingAmount, currency)}
                </p>
              </div>
              <div className="px-4 py-3 text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Change back</p>
                <p className="tabular-nums text-2xl leading-tight font-black text-[#1C8370]">
                  {formatCurrency(changeBackAmount, currency)}
                </p>
              </div>
            </div>
          </div>

          {formError && (
              <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-500">
                {formError}
              </p>
          )}

          <div className="mt-8 flex items-center gap-3">
            <button
                onClick={() => setStep('method')}
                disabled={loading}
                className="ui-btn ui-btn-secondary px-6 py-4 text-sm font-bold text-stone-600 hover:bg-stone-50"
            >
              Back
            </button>
            <button
                onClick={handleCashCharge}
                disabled={!canChargeCash}
                className="ui-btn ui-btn-primary flex-1 py-4 text-lg font-black uppercase tracking-tight shadow-xl shadow-amber-900/10 transition-all active:scale-[0.98]"
            >
              {loading ? 'Processing...' : 'Charge Cash'}
            </button>
          </div>
        </section>
      </div>
  )
}
