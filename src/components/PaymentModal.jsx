import { Banknote, CheckCircle2, CreditCard, Loader2, QrCode, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchKhqrStatus, generateKhqr } from '../api/client'
import { formatCurrency } from '../utils/format'
import KHQRCard from './KHQRCard'
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
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" />
          <section className="ui-modal-card relative z-10 w-full max-w-[440px] p-4">
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
              <p className="mt-1 text-3xl font-black text-[#2D71F8]">
                {formatCurrency(totalAmount, currency)}
              </p>
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
                  qrValue={khqrData?.qr || ''}
                />
              </div>

              <div className="mx-auto mt-4 w-full max-w-[320px]">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Bill: {khqrData?.billNumber || '-'}</span>
                  <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${
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
        <div onClick={onClose} className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" />
        <section className="ui-modal-card relative z-10 w-full max-w-[420px] p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Cash Payment</p>
            <button
                onClick={onClose}
                className="ui-btn ui-btn-ghost ui-icon-btn h-8 w-8 text-slate-400 hover:text-slate-700"
            >
              <X size={15} />
            </button>
          </div>

          <div className="mb-3 rounded-xl border border-[#2D71F8]/20 bg-[#2D71F8]/[0.04] p-3.5">
            <p className="text-xs font-medium text-[#2D71F8]/80">Amount due</p>
            <p className="tabular-nums mt-1 text-4xl font-semibold tracking-tight text-[#2D71F8]">
              {formatCurrency(totalAmount, currency)}
            </p>
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
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                        selectedMethod === method.id
                            ? 'border-[#2D71F8] bg-[#2D71F8]/5 text-[#2D71F8]'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  {method.label}
                </button>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <p className="font-medium">Received</p>
              <p className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium">
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
                placeholder={`Enter paid amount (${currency})`}
                className="ui-input mb-2 px-3 py-2.5 text-base font-medium tabular-nums text-slate-700"
            />

            {isCashPayment && hasAmountInput && isValidReceived && remainingAmount > 0 && (
                <p className="mb-2 text-xs font-medium text-[#FC4A4A]">
                  Need {formatCurrency(remainingAmount, currency)} more.
                </p>
            )}

            {!isValidReceived && hasAmountInput && (
                <p className="mb-2 text-xs font-medium text-[#FC4A4A]">Invalid amount.</p>
            )}

            <div className="mb-2 grid grid-cols-4 gap-2">
              <button
                  onClick={() => applyQuickReceivedAmount('exact')}
                  disabled={!isCashPayment}
                  className="ui-btn ui-btn-secondary h-8 rounded-xl px-2 text-xs font-medium text-slate-600"
              >
                Exact
              </button>

              {quickCashAdjustments.map((value) => (
                  <button
                      key={`cash-add-${value}`}
                      onClick={() => applyQuickReceivedAmount(value)}
                      disabled={!isCashPayment}
                      className="ui-btn ui-btn-secondary h-8 rounded-xl px-2 text-xs font-medium text-slate-600"
                  >
                    +{formatCurrency(value, currency)}
                  </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-0 rounded-lg border border-slate-200 bg-slate-50/70">
              <div className="border-r border-slate-200 px-3 py-2">
                <p className="text-[11px] font-medium text-slate-400">Remaining</p>
                <p
                    className={`tabular-nums text-[26px] leading-none font-medium ${
                        remainingAmount > 0 ? 'text-[#FC4A4A]' : 'text-slate-700'
                    }`}
                >
                  {formatCurrency(remainingAmount, currency)}
                </p>
              </div>

              <div className="px-3 py-2">
                <p className="text-[11px] font-medium text-slate-400">Change back</p>
                <p className="tabular-nums text-[26px] leading-none font-medium text-[#1C8370]">
                  {formatCurrency(changeBackAmount, currency)}
                </p>
              </div>
            </div>

            {formError && <p className="mt-2 text-xs font-medium text-[#FC4A4A]">{formError}</p>}
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
                disabled={!canChargeCash}
                className="ui-btn ui-btn-primary flex-1 px-3 py-2.5 text-sm disabled:bg-slate-300 disabled:shadow-none"
            >
              {loading ? 'Processing...' : 'Charge'}
            </button>
          </div>
        </section>
      </div>
  )
}
