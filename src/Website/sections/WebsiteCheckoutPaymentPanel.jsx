import { ArrowRight, QrCode } from 'lucide-react'
import KHQRCard from '@shared/components/KHQRCard'
import { PAYMENT_METHOD_ITEMS, TRACKING_STEP_LABELS } from '../constants/websiteContent'

export function WebsiteCheckoutPaymentPanel({
  paymentMethod,
  onPaymentMethodChange,
  paymentConfig,
  roundedTotalAmount,
  catalogCurrency,
  hasStaticKhqr,
  checkoutError,
  checkoutSuccess,
  latestOrder,
  trackingEtaMinutes,
  trackingStage,
  formatMoney,
  subtotal,
  resolvedTaxRate,
  taxAmount,
  totalAmount,
  onCheckout,
  checkoutDisabled,
  checkoutButtonLabel,
}) {
  return (
    <>
      <div className="eloise-payment-methods">
        <p>Payment Method</p>
        <div className="eloise-payment-options">
          {PAYMENT_METHOD_ITEMS.map((method) => {
            const Icon = method.icon
            const methodLabel = method.id === 'Cash' ? String(paymentConfig?.cashLabel || method.label) : method.label
            return (
              <button
                key={method.id}
                type="button"
                className={`eloise-payment-chip ${paymentMethod === method.id ? 'active' : ''}`}
                onClick={() => onPaymentMethodChange(method.id)}
              >
                <Icon size={14} />
                <span>{methodLabel}</span>
              </button>
            )
          })}
        </div>
      </div>

      {paymentMethod === 'KHQR' && (
        <div className="eloise-khqr-panel">
          <div className="eloise-khqr-card-wrap">
            <KHQRCard
              amount={roundedTotalAmount}
              currency={catalogCurrency}
              accountName={paymentConfig.khqr.merchantName}
              qrValue={hasStaticKhqr ? paymentConfig.khqr.qr : ''}
            />
          </div>
          <div className="eloise-khqr-meta-row">
            <span>Merchant: {paymentConfig.khqr.merchantName || '-'}</span>
            <span>{paymentConfig.khqr.merchantCity || '-'}</span>
          </div>
          <p className="eloise-khqr-inline">
            <QrCode size={14} />
            <span>Scan this KHQR directly in your banking app.</span>
          </p>
          {!hasStaticKhqr && <p className="eloise-cart-message error">KHQR is not configured on server yet.</p>}
        </div>
      )}

      {checkoutError && <p className="eloise-cart-message error">{checkoutError}</p>}
      {checkoutSuccess && <p className="eloise-cart-message success">{checkoutSuccess}</p>}
      {latestOrder && (
        <div className="eloise-tracking-card">
          <div className="eloise-tracking-header">
            <strong>{latestOrder.orderNumber}</strong>
            <span>{latestOrder.paymentMethod === 'Cash' ? 'Cash on Delivery' : latestOrder.paymentMethod}</span>
          </div>
          <p className="eloise-tracking-eta">
            {trackingEtaMinutes > 0
              ? `Estimated delivery in ${trackingEtaMinutes} min`
              : 'Estimated delivery window reached'}
          </p>
          <div className="eloise-tracking-steps">
            {TRACKING_STEP_LABELS.map((label, index) => (
              <div key={label} className={`eloise-tracking-step ${index <= trackingStage ? 'active' : ''}`}>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="eloise-cart-summary">
        <div>
          <span>Subtotal</span>
          <strong>{formatMoney(subtotal)}</strong>
        </div>
        <div>
          <span>Tax ({(resolvedTaxRate * 100).toFixed(1).replace(/\.0$/, '')}%)</span>
          <strong>{formatMoney(taxAmount)}</strong>
        </div>
        <div>
          <span>Total</span>
          <strong>{formatMoney(totalAmount)}</strong>
        </div>
      </div>

      <button type="button" className="eloise-cart-checkout" onClick={onCheckout} disabled={checkoutDisabled}>
        <span>{checkoutButtonLabel}</span>
        <ArrowRight size={15} />
      </button>
    </>
  )
}
