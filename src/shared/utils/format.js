export function formatDate(inputDate) {
  return inputDate.toLocaleDateString('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatTime(inputDate) {
  return inputDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function convertCurrency(amount, fromCurrency = 'USD', toCurrency = 'USD', exchangeRate = 4000) {
  const value = Number(amount ?? 0)
  const from = String(fromCurrency ?? 'USD').toUpperCase()
  const to = String(toCurrency ?? 'USD').toUpperCase()

  // If same currency, return as-is
  if (from === to) return value

  // USD to KHR: multiply by exchange rate
  if (from === 'USD' && to === 'KHR') {
    return value * exchangeRate
  }

  // KHR to USD: divide by exchange rate
  if (from === 'KHR' && to === 'USD') {
    return value / exchangeRate
  }

  return value
}

export function formatCurrency(amount, currency = 'USD', exchangeRate = 4000) {
  const value = Number(amount ?? 0)
  const safeCurrency = currency === 'KHR' ? 'KHR' : 'USD'

  // Format the amount directly without conversion (amount is already in target currency)
  const fractionDigits = safeCurrency === 'KHR' ? 0 : 2

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: safeCurrency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)

  // Use professional symbols
  if (safeCurrency === 'KHR') {
    return formatted.replace('KHR', '៛')
  }
  return formatted
}
