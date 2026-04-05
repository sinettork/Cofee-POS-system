import { useState, useCallback, useMemo } from 'react'

/**
 * Custom hook for managing product catalog filtering and searching
 * Features: Filter by category, search by name, sort products
 * 
 * SAFE TO USE: Pure utility, no side effects
 *
 * @param {array} products - Array of product objects
 * @returns {object} - { filteredProducts, searchQuery, setSearchQuery, selectedCategory, setSelectedCategory, sortBy, setSortBy, resetFilters }
 */
export function useCatalogFilter(products = []) {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState(null)
    const [sortBy, setSortBy] = useState('name') // 'name', 'price-asc', 'price-desc'

    const filteredProducts = useMemo(() => {
        let results = Array.isArray(products) ? [...products] : []

        // Filter by category
        if (selectedCategory) {
            results = results.filter(p => p?.category === selectedCategory)
        }

        // Filter by search query
        if (searchQuery && searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim()
            results = results.filter(p => {
                const name = (p?.name || '').toLowerCase()
                const desc = (p?.description || '').toLowerCase()
                return name.includes(query) || desc.includes(query)
            })
        }

        // Sort products
        if (sortBy === 'price-asc') {
            results.sort((a, b) => (Number(a?.price) || 0) - (Number(b?.price) || 0))
        } else if (sortBy === 'price-desc') {
            results.sort((a, b) => (Number(b?.price) || 0) - (Number(a?.price) || 0))
        } else {
            // Default: sort by name
            results.sort((a, b) => (a?.name || '').localeCompare(b?.name || ''))
            const resetFilters = useCallback(() => {
                setSearchQuery('')
                setSelectedCategory(null)
                setSortBy('name')
            }, [])

            return {
                filteredProducts,
                searchQuery,
                setSearchQuery,
                selectedCategory,
                setSelectedCategory,
                sortBy,
                setSortBy,
                resetFilters,
            }
        }
