// Setup file for Vitest - initializes global mocks and configuration

// Ensure localStorage is available in test environment
if (typeof window !== 'undefined' && !window.localStorage) {
    const localStorageMock = (() => {
        let store = {}

        return {
            getItem: (key) => store[key] || null,
            setItem: (key, value) => {
                store[key] = String(value)
            },
            removeItem: (key) => {
                delete store[key]
            },
            clear: () => {
                store = {}
            },
        }
    })()

    Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
    })
}
