import {
    ArrowLeft,
    Clock,
    MapPin,
    Phone,
    Truck,
    CheckCircle2,
    AlertCircle,
    Loader2,
    PackageOpen,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatCurrency } from '@shared/utils/format'

export function DeliveryTrackingScreen() {
    const [delivery, setDelivery] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [orderId, setOrderId] = useState(null)

    useEffect(() => {
        // Get order ID from URL or localStorage
        const params = new URLSearchParams(window.location.search)
        const id = params.get('orderId') || localStorage.getItem('current-delivery-order-id')
        setOrderId(id)

        if (!id) {
            setError('No delivery order found. Please place an order first.')
            setLoading(false)
        }
    }, [])

    const loadDeliveryInfo = async () => {
        if (!orderId) return

        setLoading(true)
        setError('')
        try {
            const token = localStorage.getItem('tenant-customer-auth-token')
            if (!token) {
                setError('Please login to view your delivery')
                return
            }

            const response = await fetch(`/api/public/delivery/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` },
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Failed to load delivery information')
            }

            const data = await response.json()
            setDelivery(data)
        } catch (err) {
            setError(String(err.message))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!orderId) return
        loadDeliveryInfo()
        const interval = setInterval(loadDeliveryInfo, 10000) // Refresh every 10 seconds
        return () => clearInterval(interval)
    }, [orderId])

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending':
                return '#f59e0b'
            case 'ready_for_delivery':
                return '#3b82f6'
            case 'out_for_delivery':
                return '#8b5cf6'
            case 'delivered':
                return '#10b981'
            default:
                return '#6b7280'
        }
    }

    const getStatusLabel = (status) => {
        switch (status) {
            case 'pending':
                return 'Preparing Order'
            case 'ready_for_delivery':
                return 'Ready for Pickup'
            case 'out_for_delivery':
                return 'On the Way'
            case 'delivered':
                return 'Delivered'
            default:
                return 'Unknown'
        }
    }

    const formatTime = (dateString) => {
        if (!dateString) return 'Pending'
        try {
            const date = new Date(dateString)
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
            })
        } catch {
            return dateString
        }
    }

    const goBack = () => {
        window.history.back()
    }

    if (loading && !delivery) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#fef3e2] to-white p-4">
                <div className="text-center">
                    <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[var(--ui-primary)]" />
                    <p className="text-sm text-stone-600">Loading delivery information...</p>
                </div>
            </div>
        )
    }

    if (error && !delivery) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#fef3e2] to-white p-4">
                <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
                    <AlertCircle className="mx-auto mb-3 h-12 w-12 text-red-500" />
                    <h2 className="mb-2 text-lg font-bold text-slate-900">Error</h2>
                    <p className="mb-4 text-sm text-slate-600">{error}</p>
                    <button
                        onClick={goBack}
                        className="inline-block rounded-lg bg-[var(--ui-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        )
    }

    if (!delivery) {
        return null
    }

    const statusSteps = [
        { key: 'pending', label: 'Preparing' },
        { key: 'ready_for_delivery', label: 'Ready' },
        { key: 'out_for_delivery', label: 'On Way' },
        { key: 'delivered', label: 'Delivered' },
    ]

    const currentStepIndex = statusSteps.findIndex((s) => s.key === delivery.delivery_status)

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#fef3e2] to-white p-4 pb-8">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <button
                    onClick={goBack}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm hover:bg-stone-50"
                >
                    <ArrowLeft size={20} className="text-stone-700" />
                </button>
                <h1 className="text-center text-xl font-bold text-slate-900">Delivery Tracking</h1>
                <div className="h-10 w-10" />
            </div>

            {/* Main Content */}
            <div className="mx-auto max-w-2xl">
                {/* Status Card */}
                <div
                    className="mb-6 rounded-2xl p-6 text-white shadow-lg"
                    style={{ backgroundColor: getStatusColor(delivery.delivery_status) }}
                >
                    <div className="mb-2 flex items-center gap-2">
                        {delivery.delivery_status === 'delivered' ? (
                            <CheckCircle2 size={24} />
                        ) : (
                            <Truck size={24} />
                        )}
                        <h2 className="text-2xl font-bold">{getStatusLabel(delivery.delivery_status)}</h2>
                    </div>
                    <p className="text-sm opacity-90">
                        Order{' '}
                        <span className="font-semibold text-white">
                            {delivery.order_number || `#${delivery.id}`}
                        </span>
                    </p>
                </div>

                {/* Status Timeline */}
                <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 font-semibold text-slate-900">Delivery Progress</h3>
                    <div className="space-y-3">
                        {statusSteps.map((step, index) => {
                            const isCompleted = index <= currentStepIndex
                            const isCurrent = index === currentStepIndex

                            return (
                                <div key={step.key} className="flex items-center gap-3">
                                    <div
                                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${isCompleted
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-stone-100 text-stone-400'
                                            }`}
                                    >
                                        {isCompleted ? '✓' : index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <p
                                            className={`font-medium ${isCurrent ? 'text-slate-900' : 'text-stone-600'
                                                }`}
                                        >
                                            {step.label}
                                        </p>
                                        {isCurrent && (
                                            <p className="text-xs text-stone-500">In Progress...</p>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Delivery Address */}
                <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                        <MapPin size={20} className="text-[var(--ui-primary)]" />
                        <h3 className="font-semibold text-slate-900">Delivery Address</h3>
                    </div>
                    <div className="rounded-lg bg-stone-50 p-4">
                        <p className="text-sm font-medium text-slate-900">{delivery.delivery_address}</p>
                        <p className="mt-2 flex items-center gap-2 text-sm text-stone-600">
                            <Phone size={14} />
                            {delivery.delivery_phone}
                        </p>
                        {delivery.delivery_note && (
                            <p className="mt-2 text-xs italic text-stone-500">Note: {delivery.delivery_note}</p>
                        )}
                    </div>
                </div>

                {/* Driver Info */}
                {delivery.driver_name ? (
                    <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                        <div className="mb-4 flex items-center gap-2">
                            <Truck size={20} className="text-[var(--ui-primary)]" />
                            <h3 className="font-semibold text-slate-900">Driver Information</h3>
                        </div>
                        <div className="rounded-lg bg-stone-50 p-4">
                            <p className="text-sm font-medium text-slate-900">{delivery.driver_name}</p>
                            <p className="mt-2 flex items-center gap-2 text-sm text-stone-600">
                                <Phone size={14} />
                                <a
                                    href={`tel:${delivery.driver_phone}`}
                                    className="text-[var(--ui-primary)] hover:underline"
                                >
                                    {delivery.driver_phone}
                                </a>
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center gap-2 text-stone-500">
                            <Clock size={18} />
                            <p className="text-sm">Driver will be assigned soon</p>
                        </div>
                    </div>
                )}

                {/* Order Details */}
                <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                        <PackageOpen size={20} className="text-[var(--ui-primary)]" />
                        <h3 className="font-semibold text-slate-900">Order Details</h3>
                    </div>
                    <div className="space-y-2 border-t border-stone-200 pt-4">
                        <div className="flex justify-between text-sm">
                            <span className="text-stone-600">Order Number</span>
                            <span className="font-medium text-slate-900">{delivery.order_number || `#${delivery.id}`}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-stone-600">Customer Name</span>
                            <span className="font-medium text-slate-900">{delivery.customer_name}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-stone-600">Order Status</span>
                            <span className="font-medium text-slate-900">{delivery.status}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-stone-600">Delivery Status</span>
                            <span className="font-medium" style={{ color: getStatusColor(delivery.delivery_status) }}>
                                {getStatusLabel(delivery.delivery_status)}
                            </span>
                        </div>
                        {delivery.total && (
                            <div className="flex justify-between border-t border-stone-200 pt-4 text-sm font-medium">
                                <span className="text-slate-900">Order Total</span>
                                <span className="text-slate-900">
                                    {formatCurrency(delivery.total, delivery.currency || 'USD')}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Auto-refresh indicator */}
                <div className="mt-6 text-center text-xs text-stone-500">
                    <p>Updates automatically every 10 seconds</p>
                </div>
            </div>
        </div>
    )
}
