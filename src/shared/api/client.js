import {
  ApiError,
  classifyApiError,
  logApiError,
} from './errors.js'

const AUTH_TOKEN_STORAGE_KEY = 'tenant-pos-auth-token'
const CUSTOMER_AUTH_TOKEN_STORAGE_KEY = 'tenant-public-customer-token'

let authToken = ''
if (typeof window !== 'undefined') {
  authToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || ''
}

let customerAuthToken = ''
if (typeof window !== 'undefined') {
  customerAuthToken = window.localStorage.getItem(CUSTOMER_AUTH_TOKEN_STORAGE_KEY) || ''
}

export function getStoredAuthToken() {
  return authToken
}

export function setAuthToken(token) {
  authToken = String(token ?? '').trim()
  if (typeof window === 'undefined') return
  if (authToken) {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authToken)
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  }
}

export function clearAuthToken() {
  setAuthToken('')
}

export function getStoredPublicCustomerToken() {
  return customerAuthToken
}

export function setPublicCustomerToken(token) {
  customerAuthToken = String(token ?? '').trim()
  if (typeof window === 'undefined') return
  if (customerAuthToken) {
    window.localStorage.setItem(CUSTOMER_AUTH_TOKEN_STORAGE_KEY, customerAuthToken)
  } else {
    window.localStorage.removeItem(CUSTOMER_AUTH_TOKEN_STORAGE_KEY)
  }
}

export function clearPublicCustomerToken() {
  setPublicCustomerToken('')
}

export async function loginWithPassword({ username, password }) {
  const payload = await requestJson('/api/auth/login', {
    method: 'POST',
    body: { username, password },
    auth: false,
  })
  if (payload?.token) {
    setAuthToken(payload.token)
  }
  return payload
}

export async function fetchCurrentUser(signal) {
  return requestJson('/api/auth/me', { signal })
}

export async function logoutSession() {
  try {
    await requestJson('/api/auth/logout', { method: 'POST' })
  } finally {
    clearAuthToken()
  }
}

export async function fetchBootstrapData(signal) {
  return requestJson('/api/bootstrap', { signal })
}

export async function createOrder(payload) {
  return requestJson('/api/orders', {
    method: 'POST',
    body: payload,
  })
}

export async function createPublicDeliveryOrder(payload) {
  return requestJson('/api/public/orders/delivery', {
    method: 'POST',
    body: payload,
    auth: false,
  })
}

export async function updateOrderStatus(orderNumber, payload) {
  const safeOrderNumber = String(orderNumber).replace('#', '')
  return requestJson(`/api/orders/${safeOrderNumber}/status`, {
    method: 'PATCH',
    body: payload,
  })
}

export async function fetchOrderDetail(orderNumber, signal) {
  const safeOrderNumber = String(orderNumber).replace('#', '')
  return requestJson(`/api/orders/${encodeURIComponent(safeOrderNumber)}`, { signal })
}

export async function updateTableStatus(tableId, payload) {
  return requestJson(`/api/tables/${encodeURIComponent(tableId)}`, {
    method: 'PATCH',
    body: payload,
  })
}

export async function createTable(payload) {
  return requestJson('/api/tables', {
    method: 'POST',
    body: payload,
  })
}

export async function generateKhqr(payload) {
  return requestJson('/api/khqr/generate', {
    method: 'POST',
    body: payload,
  })
}

export async function fetchKhqrStatus(md5, signal) {
  return requestJson(`/api/khqr/status/${encodeURIComponent(String(md5))}`, { signal })
}

export async function generatePublicKhqr(payload) {
  return requestJson('/api/public/khqr/generate', {
    method: 'POST',
    body: payload,
    auth: false,
  })
}

export async function fetchPublicKhqrStatus(md5, signal) {
  return requestJson(`/api/public/khqr/status/${encodeURIComponent(String(md5))}`, {
    signal,
    auth: false,
  })
}

export async function fetchSettings(signal) {
  return requestJson('/api/settings', { signal })
}

export async function saveSettings(payload) {
  return requestJson('/api/settings', {
    method: 'PATCH',
    body: payload,
  })
}

export async function fetchUsers(signal) {
  return requestJson('/api/users', { signal })
}

export async function createUser(payload) {
  return requestJson('/api/users', {
    method: 'POST',
    body: payload,
  })
}

export async function updateUser(userId, payload) {
  return requestJson(`/api/users/${encodeURIComponent(String(userId))}`, {
    method: 'PATCH',
    body: payload,
  })
}

export async function fetchReportSummary(signal, query = '') {
  const url = query ? `/api/reports/summary?${query}` : '/api/reports/summary'
  return requestJson(url, { signal })
}

export async function fetchProductCatalog(signal) {
  return requestJson('/api/products', { signal })
}

export async function fetchPublicCatalog(signal) {
  return requestJson('/api/public/catalog', { signal, auth: false })
}

export async function fetchPublicPaymentConfig(signal) {
  return requestJson('/api/public/payment-config', { signal, auth: false })
}

export async function registerPublicCustomer(payload) {
  const response = await requestJson('/api/public/customers/register', {
    method: 'POST',
    body: payload,
    auth: false,
  })
  if (response?.token) {
    setPublicCustomerToken(response.token)
  }
  return response
}

export async function loginPublicCustomer(payload) {
  const response = await requestJson('/api/public/customers/login', {
    method: 'POST',
    body: payload,
    auth: false,
  })
  if (response?.token) {
    setPublicCustomerToken(response.token)
  }
  return response
}

export async function fetchPublicCustomer(signal) {
  return requestJson('/api/public/customers/me', {
    signal,
    auth: false,
    customerAuth: true,
  })
}

export async function updatePublicCustomerProfile(payload) {
  return requestJson('/api/public/customers/me', {
    method: 'PATCH',
    body: payload,
    auth: false,
    customerAuth: true,
  })
}

export async function logoutPublicCustomer() {
  try {
    await requestJson('/api/public/customers/logout', {
      method: 'POST',
      auth: false,
      customerAuth: true,
    })
  } finally {
    clearPublicCustomerToken()
  }
}

export async function createPublicOrder(payload) {
  return requestJson('/api/public/orders', {
    method: 'POST',
    body: payload,
    auth: false,
    customerAuth: true,
  })
}

export async function createProductItem(payload) {
  return requestJson('/api/products', {
    method: 'POST',
    body: payload,
  })
}

export async function createCategoryItem(payload) {
  return requestJson('/api/categories', {
    method: 'POST',
    body: payload,
  })
}

export async function updateProductItem(productId, payload) {
  return requestJson(`/api/products/${encodeURIComponent(productId)}`, {
    method: 'PATCH',
    body: payload,
  })
}

export async function deleteProductItem(productId) {
  return requestJson(`/api/products/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
  })
}

export async function bulkCreateProductItems(payload) {
  return requestJson('/api/products/bulk', {
    method: 'POST',
    body: payload,
  })
}

export async function fetchInventoryMovements(limit = 80, signal) {
  const safeLimit = Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : 80
  return requestJson(`/api/inventory/movements?limit=${Math.max(1, Math.min(300, safeLimit))}`, {
    signal,
  })
}

async function requestJson(url, { method = 'GET', body, signal, auth = true, customerAuth = false, timeout = 15000 } = {}) {
  const headers = {}
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (auth && authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }
  if (customerAuth && customerAuthToken) {
    headers['X-Customer-Session'] = customerAuthToken
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  if (signal instanceof AbortSignal) {
    signal.addEventListener('abort', () => {
      clearTimeout(timeoutId)
      controller.abort()
    })
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) {
      const details = await safeReadError(response)
      const error = new Error(details || `Request failed: ${response.status}`)
      const apiError = classifyApiError(error, response.status)
      logApiError(url, method, apiError)
      throw apiError
    }
    if (response.status === 204) return null
    return await response.json()
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    const apiError = classifyApiError(error)
    logApiError(url, method, apiError)
    throw apiError
  } finally {
    clearTimeout(timeoutId)
  }
}

async function safeReadError(response) {
  try {
    const body = await response.json()
    return body?.error || body?.details || ''
  } catch {
    return ''
  }
}
