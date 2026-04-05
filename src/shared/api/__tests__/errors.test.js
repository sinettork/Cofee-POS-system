import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { validateApiResponse, ApiError, classifyApiError } from '../errors.js'
import * as schemas from '../schemas.js'

describe('API Error Handling', () => {
    describe('ApiError class', () => {
        it('should create auth error', () => {
            const error = new ApiError('Unauthorized', 'auth', null, 401)
            expect(error.type).toBe('auth')
            expect(error.statusCode).toBe(401)
        })

        it('should create network error', () => {
            const error = new ApiError('Network failed', 'network', null, null)
            expect(error.type).toBe('network')
        })

        it('should create validation error', () => {
            const error = new ApiError('Invalid response', 'validation', null, 200)
            expect(error.type).toBe('validation')
        })
    })

    describe('classifyApiError', () => {
        it('should classify 401 as auth error', () => {
            const error = new Error('Unauthorized')
            const classified = classifyApiError(error, 401)
            expect(classified.type).toBe('auth')
            expect(classified.message).toContain('Session expired')
        })

        it('should classify 403 as auth error', () => {
            const error = new Error('Forbidden')
            const classified = classifyApiError(error, 403)
            expect(classified.type).toBe('auth')
            expect(classified.message).toContain('Access denied')
        })

        it('should classify 500+ as server error', () => {
            const error = new Error('Server Error')
            const classified = classifyApiError(error, 500)
            expect(classified.type).toBe('server')
            expect(classified.message).toContain('Server error')
        })

        it('should classify network TypeError', () => {
            const error = new TypeError('fetch is not defined')
            const classified = classifyApiError(error)
            expect(classified.type).toBe('network')
        })

        it('should classify Zod validation error', () => {
            const zodError = new z.ZodError([
                {
                    code: z.ZodIssueCode.invalid_type,
                    expected: 'string',
                    received: 'number',
                    path: ['id'],
                    message: 'Expected string, received number',
                },
            ])
            const classified = classifyApiError(zodError)
            expect(classified.type).toBe('validation')
            expect(classified.message).toContain('API response validation failed')
        })
    })
})

describe('API Response Validation', () => {
    describe('Login response schema', () => {
        it('should validate correct login response', () => {
            const data = { token: 'abc123', user: { id: '1', username: 'admin', role: 'admin' } }
            const result = validateApiResponse(data, schemas.LoginResponseSchema)
            expect(result.token).toBe('abc123')
        })

        it('should allow extra fields with passthrough', () => {
            const data = { token: 'abc123', extra: 'field', user: { id: '1', username: 'admin', role: 'admin' } }
            const result = validateApiResponse(data, schemas.LoginResponseSchema)
            expect(result.extra).toBe('field')
        })

        it('should throw on missing token', () => {
            const data = { user: { id: '1', username: 'admin', role: 'admin' } }
            expect(() => validateApiResponse(data, schemas.LoginResponseSchema)).toThrow()
        })
    })

    describe('Catalog schema', () => {
        it('should validate correct catalog', () => {
            const data = {
                categories: [{ id: 'c1', name: 'Coffee' }],
                products: [{ id: 'p1', name: 'Espresso', price: 3.5 }],
            }
            const result = validateApiResponse(data, schemas.CatalogSchema)
            expect(result.categories).toHaveLength(1)
            expect(result.products).toHaveLength(1)
        })

        it('should default to empty arrays if missing', () => {
            const data = {}
            const result = validateApiResponse(data, schemas.CatalogSchema)
            expect(result.categories).toEqual([])
            expect(result.products).toEqual([])
        })

        it('should reject invalid category structure', () => {
            const data = {
                categories: [{ id: 'c1' }], // Missing name
                products: [{ id: 'p1', name: 'Espresso', price: 3.5 }],
            }
            expect(() => validateApiResponse(data, schemas.CatalogSchema)).toThrow()
        })

        it('should reject invalid product structure', () => {
            const data = {
                categories: [{ id: 'c1', name: 'Coffee' }],
                products: [{ id: 'p1', name: 'Espresso' }], // Missing price
            }
            expect(() => validateApiResponse(data, schemas.CatalogSchema)).toThrow()
        })
    })

    describe('Product schema', () => {
        it('should validate required fields', () => {
            const data = { id: 'p1', name: 'Espresso', price: 3.5 }
            const result = validateApiResponse(data, schemas.ProductSchema)
            expect(result).toEqual(data)
        })

        it('should validate optional fields', () => {
            const data = {
                id: 'p1',
                name: 'Espresso',
                price: 3.5,
                category: 'coffee',
                stock: 10,
            }
            const result = validateApiResponse(data, schemas.ProductSchema)
            expect(result.category).toBe('coffee')
            expect(result.stock).toBe(10)
        })

        it('should reject non-negative price', () => {
            const data = { id: 'p1', name: 'Espresso', price: -5 }
            expect(() => validateApiResponse(data, schemas.ProductSchema)).toThrow()
        })
    })
})
