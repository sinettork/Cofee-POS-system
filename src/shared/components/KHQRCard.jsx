import KHQRLogo from '@assets/KHQR.svg'
import { QRCodeSVG } from 'qrcode.react'

export function KHQRCard({
  accountName = '',
  amount = 0,
  currency = 'KHR',
  qrValue = '',
}) {
  const numericAmount = Number(amount || 0)
  const displayAmount =
    currency === 'KHR'
      ? Math.round(numericAmount).toLocaleString()
      : numericAmount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })

  return (
    <div className="h-[411px] w-[300px] overflow-hidden rounded-khqr bg-white shadow-khqr">
      <div className="flex h-full w-full flex-col items-center">
        <div className="flex w-full justify-center pt-0">
          <img src={KHQRLogo} alt="KHQR" className="h-auto w-full object-cover" />
        </div>

        <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 px-0 pb-12">
          <div className="flex w-full flex-col items-start gap-1 px-6">
            {accountName && <div className="text-sm font-bold leading-[19.6px] text-neutralb-600">{accountName}</div>}
            <div className="flex items-center gap-1">
              <div className="text-center text-[22px] font-bold leading-7 text-textpb-01">
                {displayAmount} {currency}
              </div>
            </div>
          </div>

          <div className="h-52 w-52">
            {qrValue ? (
              <QRCodeSVG
                value={qrValue}
                size={208}
                className="h-full w-full object-contain"
                includeMargin={false}
              />
            ) : (
              <div className="h-full w-full rounded-lg border border-dashed border-slate-300" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default KHQRCard
