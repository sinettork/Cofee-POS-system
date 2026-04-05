import { z } from 'zod'

/**
 * Validates API response against a Zod schema
 * @param {any} data - The data to validate
 * @param {z.ZodSchema} schema - The Zod schema to validate against
 * @returns {object} - The validated data
 * @throws {Error} - If validation fails
 */
export function validateApiResponse(data, schema) {
    try {
        return schema.parse(data)
    } catch (error) {
        if (error instanceof z.ZodError) {
            const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
            throw new Error(`Invalid API response: ${issues}`)
        }
        throw error
    }
}

/**
 * Classifies API errors into categories for consistent handling
 */
export class ApiError extends Error {
    constructor(message, type, originalError = null, statusCode = null) {
        super(message)
        this.name = 'ApiError'
        this.type = type // 'auth', 'network', 'validation', 'server', 'unknown'
        this.originalError = originalError
        this.statusCode = statusCode
    }
}

/**
 * Classifies an error based on status code and type
 */
export function classifyApiError(error, statusCode = null) {
    if (error instanceof z.ZodError) {
        return new ApiError(
            `API response validation failed: ${error.issues[0]?.message || 'Unknown'}`,
            'validation',
            error,
            statusCode
        )
    }

    if (statusCode === 401 || statusCode === 403) {
        return new ApiError(
            statusCode === 401 ? 'Session expired. Please sign in again.' : 'Access denied.',
            'auth',
            error,
            statusCode
        )
    }

    if (statusCode === 404) {
        return new ApiError('Resource not found.', 'server', error, statusCode)
    }

    if (statusCode && statusCode >= 500) {
        return new ApiError('Server error. Please try again later.', 'server', error, statusCode)
    }

    if (statusCode && statusCode >= 400) {
        return new ApiError(`Request failed (${statusCode}). ${error?.message || ''}`.trim(), 'server', error, statusCode)
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
        return new ApiError('Network error. Please check your connection.', 'network', error, statusCode)
    }

    if (error?.name === 'AbortError') {
        return new ApiError('Request timeout. Please try again.', 'network', error, statusCode)
    }

    return new ApiError(error?.message || 'Unknown error occurred', 'unknown', error, statusCode)
}

/**
 * Logs API errors with context (endpoint, method, error type)
 */
export function logApiError(endpoint, method, error) {
    if (error instanceof ApiError) {
        console.error(`[API Error] ${method} ${endpoint} [${error.type}]`, {
            message: error.message,
            statusCode: error.statusCode,
            originalError: error.originalError?.message,
        })
    } else {
        console.error(`[API Error] ${method} ${endpoint}`, error)
    }
}
