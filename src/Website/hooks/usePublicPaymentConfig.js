import { useEffect, useState } from 'react'
import { getPublicPaymentConfig } from '../services/publicWebsiteService'

const DEFAULT_PAYMENT_CONFIG = {
  cashLabel: 'Cash on Delivery',
  khqr: {
    enabled: false,
    qr: '',
    merchantName: '',
    merchantCity: '',
    accountId: '',
  },
}

export function usePublicPaymentConfig() {
  const [paymentConfig, setPaymentConfig] = useState(DEFAULT_PAYMENT_CONFIG)

  useEffect(() => {
    const controller = new AbortController()
    getPublicPaymentConfig(controller.signal)
      .then((nextConfig) => {
        setPaymentConfig(nextConfig)
      })
      .catch(() => {
        // Keep fallback payment config when request fails.
      })
    return () => controller.abort()
  }, [])

  return { paymentConfig, setPaymentConfig }
}
