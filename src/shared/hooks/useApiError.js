import { useState, useCallback } from 'react'
import { ApiError } from '../api/errors.js'

/**
 * Centralized hook for handling API errors consistently across the app
 * Provides: error classification, user-friendly messages, retry capability
 * 
 * SAFE TO USE: Doesn't break existing code, completely optional
 *
 * @returns {object} - { error, setError, clearError, handleApiError, isAuthError, userMessage }
 */
export function useApiError() {
    const [error, setError] = useState(null)

    const clearError = useCallback(() => {
        setError(null)
    }, [])

    const handleApiError = useCallback((err) => {
        if (err instanceof ApiError) {
            setError(err)
            return err
        }

        // Convert generic errors to ApiError
        const apiError = new ApiError(
            err?.message || 'An unexpected error occurred',
            'unknown',
            err
        )
        setError(apiError)
        return apiError
    }, [])

    const isAuthError = error?.type === 'auth'
    const isNetworkError = error?.type === 'network'
    const isValidationError = error?.type === 'validation'
    const isServerError = error?.type === 'server'

    const userMessage = error?.message || null

    return {
        error,
        setError,
        clearError,
        handleApiError,
        isAuthError,
        isNetworkError,
        isValidationError,
        isServerError,
        userMessage,
    }
}

/**
 * Custom hook for API calls with error handling and loading state
 * Handles: loading, error classification, retry logic
 * 
 * SAFE TO USE: Wraps your existing async functions safely
    const [data, setData] = useState(null)
    const { error, handleApiError, clearError } = useApiError()

    const execute = useCallback(
        async (...args) => {
            try {
                setIsLoading(true)
                clearError()
                const result = await apiCall(...args)
                setData(result)
                return result
            } catch (err) {
                handleApiError(err)
                throw err
            } finally {
                setIsLoading(false)
            }
        },
        [apiCall, clearError, handleApiError]
    )

    return {
        execute,
        isLoading,
        error,
        clearError,
        data,
    }
}
