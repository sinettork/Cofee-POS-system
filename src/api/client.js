const AUTH_TOKEN_STORAGE_KEY = 'tenant-pos-auth-token'

let authToken = ''
if (typeof window !== 'undefined') {
  authToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || ''
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

export async function createPublicOrder(payload) {
  return requestJson('/api/public/orders', {
    method: 'POST',
    body: payload,
    auth: false,
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

async function requestJson(url, { method = 'GET', body, signal, auth = true } = {}) {
  const headers = {}
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (auth && authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })
  if (!response.ok) {
    const details = await safeReadError(response)
    throw new Error(details || `Request failed: ${response.status}`)
  }
  if (response.status === 204) return null
  return response.json()
}

async function safeReadError(response) {
  try {
    const body = await response.json()
    return body?.error || body?.details || ''
  } catch {
    return ''
  }
}
