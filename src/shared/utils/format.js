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

export function formatCurrency(amount, currency = 'USD') {
  const value = Number(amount ?? 0)
  const safeCurrency = currency === 'KHR' ? 'KHR' : 'USD'
  const fractionDigits = safeCurrency === 'KHR' ? 0 : 2
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: safeCurrency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}
