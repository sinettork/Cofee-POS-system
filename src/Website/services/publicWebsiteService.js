import { fetchPublicCatalog, fetchPublicCustomer, fetchPublicPaymentConfig } from '@shared/api/client'
import { toSafeCurrency } from '../utils/websiteHelpers'

export async function getPublicCatalog(signal) {
  const payload = await fetchPublicCatalog(signal)
  return {
    categories: Array.isArray(payload?.categories) ? payload.categories : [],
    products: Array.isArray(payload?.products) ? payload.products : [],
    currency: toSafeCurrency(payload?.currency),
    taxRate: Number(payload?.taxRate ?? 10),
  }
}

export async function getPublicPaymentConfig(signal) {
  const payload = await fetchPublicPaymentConfig(signal)
  return {
    cashLabel: String(payload?.cashLabel ?? 'Cash on Delivery'),
    khqr: {
      enabled: Boolean(payload?.khqr?.enabled),
      qr: String(payload?.khqr?.qr ?? ''),
      merchantName: String(payload?.khqr?.merchantName ?? ''),
      merchantCity: String(payload?.khqr?.merchantCity ?? ''),
      accountId: String(payload?.khqr?.accountId ?? ''),
    },
  }
}

export async function getPublicCustomerSession(signal) {
  const payload = await fetchPublicCustomer(signal)
  return payload?.customer ?? null
}
