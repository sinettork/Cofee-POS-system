// Optional: Safe validation layer - only log warnings, never block API calls
// This allows you to catch issues WITHOUT breaking production

import { z } from 'zod'

/**
 * Safely validates data without throwing errors
 * Returns { isValid, errors } instead of breaking the app
 * Great for logging issues in development without blocking users
 */
export function safeValidate(data, schema) {
    try {
        schema.parse(data)
        return { isValid: true, errors: [] }
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors = error.issues.map(issue => ({
                path: issue.path.join('.'),
                message: issue.message,
            }))
            return { isValid: false, errors }
        }
        return { isValid: false, errors: [{ message: 'Unknown validation error' }] }
    }
}

/**
 * Logs validation issues to console in development
 * Useful for debugging API response mismatches
 */
export function logValidationWarning(endpoint, method, validation) {
    if (!validation.isValid && process.env.NODE_ENV === 'development') {
        console.warn(`[API Validation] ${method} ${endpoint}`, {
            issues: validation.errors,
            note: 'This is a development-only warning. API call still succeeded.',
        })
    }
}
