import { formatCurrency } from '@shared/utils/format'

export function ReceiptView({ data, onNewOrder }) {
  const createdAtLabel =
    data?.createdAt instanceof Date ? data.createdAt.toLocaleString() : new Date().toLocaleString()
  const items = Array.isArray(data?.items) ? data.items : []

  return (
    <div className="receipt-root rounded-xl border border-slate-200 bg-white p-4 font-mono text-sm text-slate-800">
      <p className="text-center text-lg font-bold">Bakehouse POS</p>
      <p className="text-center text-xs text-slate-500">
        {data?.orderNumber ?? 'N/A'} - {createdAtLabel}
      </p>
      <p className="mt-1 text-center text-xs text-slate-500">
        {data?.customerName ?? 'Walk-in'}
        {data?.tableName ? ` | ${data.tableName}` : ''}
        {data?.orderType ? ` | ${data.orderType}` : ''}
      </p>

      <hr className="my-3 border-slate-200" />
      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.cartId ?? `${item.product?.id ?? item.product?.name ?? 'item'}-${item.quantity ?? 1}`}
            className="flex justify-between gap-2"
          >
            <span className="line-clamp-1">
              {item.product?.name ?? 'Item'} x{Number(item.quantity ?? 0)}
            </span>
            <span>{formatCurrency(item.totalPrice ?? 0, data?.currency)}</span>
          </div>
        ))}
      </div>

      <hr className="my-3 border-slate-200" />
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatCurrency(data?.subtotal ?? 0, data?.currency)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax</span>
          <span>{formatCurrency(data?.tax ?? 0, data?.currency)}</span>
        </div>
        {Number(data?.discount ?? 0) > 0 && (
          <div className="flex justify-between text-emerald-700">
            <span>Discount</span>
            <span>-{formatCurrency(data?.discount ?? 0, data?.currency)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
          <span>Total</span>
          <span>{formatCurrency(data?.total ?? 0, data?.currency)}</span>
        </div>
      </div>

      <p className="mt-3 text-xs">Paid by: {data?.paymentMethod ?? 'N/A'}</p>
      {data?.paymentMethod === 'Cash' && (
        <>
          <p className="text-xs">Received: {formatCurrency(data?.amountReceived ?? 0, data?.currency)}</p>
          <p className="text-xs">Change: {formatCurrency(data?.changeAmount ?? 0, data?.currency)}</p>
        </>
      )}

      <div className="no-print mt-4 flex gap-2">
        <button
          onClick={() => window.print()}
          className="ui-btn ui-btn-secondary flex-1 px-3 py-2 text-sm text-slate-600"
        >
          Print Receipt
        </button>
        <button onClick={onNewOrder} className="ui-btn ui-btn-primary flex-1 px-3 py-2 text-sm">
          New Order
        </button>
      </div>
    </div>
  )
}
