import { useEffect, useState } from 'react'
import { getPublicCatalog } from '../services/publicWebsiteService'
import { isAbortRequestError } from '../utils/websiteHelpers'

const INITIAL_CATALOG = {
  categories: [],
  products: [],
  currency: 'USD',
  taxRate: 10,
}

export function usePublicCatalog() {
  const [catalog, setCatalog] = useState(INITIAL_CATALOG)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    getPublicCatalog(controller.signal)
      .then((nextCatalog) => {
        setCatalog(nextCatalog)
        setError('')
      })
      .catch((requestError) => {
        if (isAbortRequestError(requestError)) return
        setError(requestError?.message || 'Unable to load menu catalog.')
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [])

  return { catalog, loading, error }
}
