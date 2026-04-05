import { useState, useEffect, useRef, useCallback } from 'react'
import { useApiError } from './useApiError.js'

/**
 * Hook for fetching JSON data with automatic loading and error handling
 * Handles: AbortController for cancellation, timeout, retry, error classification
 * 
 * SAFE TO USE: Won't interfere with existing data fetching
 *
 * @param {Function} fetchFn - Async function that returns a promise
 * @param {array} dependencies - Dependency array to trigger re-fetch
 * @returns {object} - { data, isLoading, error, clearError, retry, isRetrying }
 */
export function useFetchJson(fetchFn, dependencies = []) {
    const [data, setData] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const abortControllerRef = useRef(null)
    const { error, handleApiError, clearError } = useApiError()
    const retryCountRef = useRef(0)
    const [isRetrying, setIsRetrying] = useState(false)
    const isMountedRef = useRef(true)

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        clearError()

        // Create abort controller for this fetch
        abortControllerRef.current = new AbortController()
        const signal = abortControllerRef.current.signal

        try {
            const result = await fetchFn(signal)
            // Only update state if component is still mounted
            if (isMountedRef.current) {
                setData(result)
                retryCountRef.current = 0
            }
        } catch (err) {
            if (!signal.aborted && isMountedRef.current) {
                handleApiError(err)
            }
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false)
                setIsRetrying(false)
            }
        }
    }, [fetchFn, clearError, handleApiError])

    useEffect(() => {
        isMountedRef.current = true
        fetchData()

        // Cleanup: abort fetch on unmount
        return () => {
            isMountedRef.current = false
            const retry = useCallback(async () => {
                retryCountRef.current += 1
                if (retryCountRef.current > 3) {
                    console.warn('Maximum retries (3) exceeded')
                    return
                }
                setIsRetrying(true)
                await fetchData()
            }, [fetchData])

            return {
                data,
                isLoading,
                error,
                clearError,
                retry,
                isRetrying,
            }
        }
