import { useState, useCallback, useEffect } from 'react'

const CART_STORAGE_KEY = 'pos-cart'
const CART_VERSION = 1

/**
 * Custom hook for managing shopping cart state and persistence
 * Features: Add/remove items, update quantities, clear cart, localStorage persistence
 * 
 * SAFE TO USE: Isolated cart management, doesn't affect other code
 *
 * @returns {object} - { items, addItem, removeItem, updateQuantity, clearCart, total, itemCount }
 */
export function useCart() {
    const [items, setItems] = useState(() => {
        // Load from localStorage on initialization
        if (typeof window === 'undefined') return []
        try {
            const stored = window.localStorage.getItem(CART_STORAGE_KEY)
            if (!stored) return []
            const data = JSON.parse(stored)
            // Validate version for future compatibility
            if (data.version !== CART_VERSION) return []
            return Array.isArray(data.items) ? data.items : []
        } catch (err) {
            console.warn('Failed to load cart from localStorage:', err)
            return []
        }
    })

    // Persist to localStorage whenever items change
    useEffect(() => {
        if (typeof window === 'undefined') return
        try {
            const data = { version: CART_VERSION, items }
            window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(data))
        } catch (err) {
            console.error('Failed to save cart to localStorage:', err)
        }
    }, [items])

    const addItem = useCallback((product, quantity = 1) => {
        if (!product?.id) {
            console.warn('addItem: product must have an id')
            return
        }

        setItems((prevItems) => {
            const existingItem = prevItems.find(item => item.productId === product.id)

            if (existingItem) {
                return prevItems.map(item =>
                    item.productId === product.id
                        ? { ...item, quantity: Math.max(1, item.quantity + quantity) }
                        : item
                )
            }

            return [
                ...prevItems,
                {
                    productId: product.id,
                    name: product.name || 'Unknown Product',
                    price: product.price || 0,
                    image: product.image,
                    quantity: Math.max(1, quantity),
                },
            ]
        })
    }, [])

    const removeItem = useCallback((productId) => {
        setItems((prevItems) => prevItems.filter(item => item.productId !== productId))
    }, [])

    const updateQuantity = useCallback((productId, quantity) => {
        if (quantity <= 0) {
            removeItem(productId)
            return
        }
        setItems((prevItems) =>
            prevItems.map(item =>
                item.productId === productId ? { ...item, quantity: Math.max(1, quantity) } : item
            )
        )
    }, [removeItem])

    const clearCart = useCallback(() => {
        setItems([])
    }, [])

    const total = items.reduce((sum, item) => {
        const itemPrice = Number(item.price) || 0
        const itemQty = Number(item.quantity) || 0
        return sum + (itemPrice * itemQty)
    }, 0)

    const itemCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)

    return {
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        total,
        itemCount,
    }
}
