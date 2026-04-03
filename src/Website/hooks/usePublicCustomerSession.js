import { useEffect, useState } from 'react'
import { getStoredPublicCustomerToken } from '@shared/api/client'
import { getPublicCustomerSession } from '../services/publicWebsiteService'

export function usePublicCustomerSession() {
  const hasStoredToken = Boolean(getStoredPublicCustomerToken())
  const [customerSession, setCustomerSession] = useState(null)
  const [customerReady, setCustomerReady] = useState(() => !hasStoredToken)

  useEffect(() => {
    if (!hasStoredToken) return undefined
    const controller = new AbortController()
    getPublicCustomerSession(controller.signal)
      .then((nextSession) => {
        setCustomerSession(nextSession)
      })
      .catch(() => {
        setCustomerSession(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setCustomerReady(true)
      })
    return () => controller.abort()
  }, [hasStoredToken])

  return { customerSession, setCustomerSession, customerReady }
}
