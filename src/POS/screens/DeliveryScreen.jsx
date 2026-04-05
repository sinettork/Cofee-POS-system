import {
    Clock,
    MapPin,
    Phone,
    CheckCircle2,
    Truck,
    AlertCircle,
    User,
    Send,
    Plus,
} from 'lucide-react'
import { useEffect, useState } from 'react'

export function DeliveryScreen() {
    const [deliveries, setDeliveries] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [filterStatus, setFilterStatus] = useState('pending')
    const [assigningDriver, setAssigningDriver] = useState(null)
    const [driverName, setDriverName] = useState('')
    const [driverPhone, setDriverPhone] = useState('')
    const [successMsg, setSuccessMsg] = useState('')

    const loadDeliveryQueue = async () => {
        setLoading(true)
        setError('')
        try {
            const response = await fetch('/api/delivery/queue?limit=50', {
                headers: { Authorization: `Bearer ${localStorage.getItem('tenant-pos-auth-token')}` },
            })
            if (!response.ok) throw new Error('Failed to load delivery queue')
            const data = await response.json()
            setDeliveries(data.deliveries || [])
        } catch (err) {
            setError(String(err.message))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadDeliveryQueue()
        const interval = setInterval(loadDeliveryQueue, 10000) // Refresh every 10s
        return () => clearInterval(interval)
    }, [])

    const handleAssignDriver = async (orderId) => {
        if (!driverName.trim()) {
            setError('Driver name is required')
            return
        }

        try {
            const response = await fetch(`/api/delivery/${orderId}/assign`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('tenant-pos-auth-token')}`,
                },
                body: JSON.stringify({
                    driverName: driverName.trim(),
                    driverPhone: driverPhone.trim(),
                }),
            })
            if (!response.ok) throw new Error('Failed to assign driver')

            setSuccessMsg('Driver assigned successfully!')
            setAssigningDriver(null)
            setDriverName('')
            setDriverPhone('')
            setTimeout(() => setSuccessMsg(''), 3000)
            loadDeliveryQueue()
        } catch (err) {
            setError(String(err.message))
        }
    }

    const handleUpdateStatus = async (orderId, newStatus) => {
        try {
            const response = await fetch(`/api/delivery/${orderId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('tenant-pos-auth-token')}`,
                },
                body: JSON.stringify({ status: newStatus }),
            })
            if (!response.ok) throw new Error('Failed to update status')

            setSuccessMsg(`Order marked as ${newStatus}`)
            setTimeout(() => setSuccessMsg(''), 3000)
            loadDeliveryQueue()
        } catch (err) {
            setError(String(err.message))
        }
    }

    const formatTime = (dateStr) => {
        if (!dateStr) return '--:--'
        const date = new Date(dateStr)
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return ''
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    const statusColors = {
        pending: 'bg-yellow-50 border-yellow-200',
        ready_for_delivery: 'bg-blue-50 border-blue-200',
        out_for_delivery: 'bg-purple-50 border-purple-200',
        delivered: 'bg-green-50 border-green-200',
    }

    const statusLabels = {
        pending: 'Pending Kitchen',
        ready_for_delivery: 'Ready for Delivery',
        out_for_delivery: 'Out for Delivery',
        delivered: 'Delivered',
    }

    const filteredDeliveries = deliveries.filter((d) => d.delivery_status === filterStatus)

    return (
        <div className="delivery-screen">
            <div className="delivery-header">
                <div>
                    <h1>📦 Delivery Queue</h1>
                    <p className="subtitle">Manage and track delivery orders</p>
                </div>
                <button className="refresh-btn" onClick={loadDeliveryQueue} disabled={loading}>
                    {loading ? '⟳ Loading...' : '⟳ Refresh'}
                </button>
            </div>

            {error && (
                <div className="alert alert-error">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}
            {successMsg && (
                <div className="alert alert-success">
                    <CheckCircle2 size={18} />
                    {successMsg}
                </div>
            )}

            <div className="status-filters">
                {Object.entries(statusLabels).map(([status, label]) => (
                    <button
                        key={status}
                        className={`filter-btn ${filterStatus === status ? 'active' : ''}`}
                        onClick={() => setFilterStatus(status)}
                    >
                        {label}
                        <span className="count">{deliveries.filter((d) => d.delivery_status === status).length}</span>
                    </button>
                ))}
            </div>

            {filteredDeliveries.length === 0 ? (
                <div className="empty-state">
                    <Truck size={48} opacity={0.3} />
                    <p>No {statusLabels[filterStatus] ? statusLabels[filterStatus].toLowerCase() : 'delivery'} orders</p>
                </div>
            ) : (
                <div className="deliveries-grid">
                    {filteredDeliveries.map((delivery) => (
                        <div
                            key={delivery.id}
                            className={`delivery-card ${statusColors[delivery.delivery_status] || ''}`}
                        >
                            {/* Header */}
                            <div className="card-header">
                                <div>
                                    <h3>{delivery.order_number}</h3>
                                    <p className="customer-name">
                                        <User size={14} />
                                        {delivery.customer_name}
                                    </p>
                                </div>
                                <span className={`status-badge status-${delivery.delivery_status}`}>
                                    {statusLabels[delivery.delivery_status] || delivery.delivery_status}
                                </span>
                            </div>

                            {/* Delivery Details */}
                            <div className="card-details">
                                <div className="detail-row">
                                    <MapPin size={16} />
                                    <div>
                                        <p className="label">Address</p>
                                        <p className="value">{delivery.delivery_address || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="detail-row">
                                    <Phone size={16} />
                                    <div>
                                        <p className="label">Phone</p>
                                        <p className="value">{delivery.delivery_phone || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="detail-row">
                                    <Clock size={16} />
                                    <div>
                                        <p className="label">Ordered</p>
                                        <p className="value">
                                            {formatDate(delivery.created_at)} {formatTime(delivery.created_at)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            {delivery.delivery_note && (
                                <div className="card-notes">
                                    <p className="label">Note:</p>
                                    <p className="value">{delivery.delivery_note}</p>
                                </div>
                            )}

                            {/* Driver Info */}
                            {delivery.driver_name && (
                                <div className="driver-info">
                                    <div>
                                        <p className="label">Driver</p>
                                        <p className="value">{delivery.driver_name}</p>
                                    </div>
                                    {delivery.driver_phone && (
                                        <p className="phone">{delivery.driver_phone}</p>
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="card-actions">
                                {delivery.delivery_status === 'pending' && (
                                    <>
                                        {assigningDriver === delivery.id ? (
                                            <div className="driver-form">
                                                <input
                                                    type="text"
                                                    placeholder="Driver name"
                                                    value={driverName}
                                                    onChange={(e) => setDriverName(e.target.value)}
                                                    onKeyPress={(e) => e.key === 'Enter' && handleAssignDriver(delivery.id)}
                                                />
                                                <input
                                                    type="tel"
                                                    placeholder="Driver phone"
                                                    value={driverPhone}
                                                    onChange={(e) => setDriverPhone(e.target.value)}
                                                />
                                                <button
                                                    className="btn btn-primary"
                                                    onClick={() => handleAssignDriver(delivery.id)}
                                                >
                                                    <Send size={14} /> Assign
                                                </button>
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={() => {
                                                        setAssigningDriver(null)
                                                        setDriverName('')
                                                        setDriverPhone('')
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={() => setAssigningDriver(delivery.id)}
                                                >
                                                    <Plus size={14} /> Assign Driver
                                                </button>
                                                <button
                                                    className="btn btn-success"
                                                    onClick={() => handleUpdateStatus(delivery.id, 'ready_for_delivery')}
                                                >
                                                    <CheckCircle2 size={14} /> Ready
                                                </button>
                                            </>
                                        )}
                                    </>
                                )}
                                {delivery.delivery_status === 'ready_for_delivery' && (
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => handleUpdateStatus(delivery.id, 'out_for_delivery')}
                                    >
                                        <Truck size={14} /> Out for Delivery
                                    </button>
                                )}
                                {delivery.delivery_status === 'out_for_delivery' && (
                                    <button
                                        className="btn btn-success"
                                        onClick={() => handleUpdateStatus(delivery.id, 'delivered')}
                                    >
                                        <CheckCircle2 size={14} /> Mark Delivered
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style>{`
        .delivery-screen {
          padding: 2rem;
          background: #f8f9fa;
          min-height: 100vh;
        }

        .delivery-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .delivery-header h1 {
          font-size: 2rem;
          margin: 0;
          color: #1a1a1a;
        }

        .subtitle {
          font-size: 0.9rem;
          color: #666;
          margin: 0.5rem 0 0 0;
        }

        .refresh-btn {
          padding: 0.6rem 1.2rem;
          background: #292524;
          color: #fff;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .refresh-btn:hover:not(:disabled) {
          background: #7c4a32;
          transform: translateY(-1px);
        }

        .refresh-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .alert {
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

        .alert-error {
          background: #fee2e2;
          color: #b91c1c;
          border: 1px solid #fca5a5;
        }

        .alert-success {
          background: #dcfce7;
          color: #166534;
          border: 1px solid #86efac;
        }

        .status-filters {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
          flex-wrap: wrap;
        }

        .filter-btn {
          padding: 0.7rem 1.4rem;
          border: 2px solid #ddd;
          background: white;
          border-radius: 24px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .filter-btn:hover {
          border-color: #7c4a32;
          color: #7c4a32;
        }

        .filter-btn.active {
          background: #7c4a32;
          color: white;
          border-color: #7c4a32;
        }

        .count {
          background: rgba(255, 255, 255, 0.3);
          padding: 0.2rem 0.6rem;
          border-radius: 12px;
          font-size: 0.8rem;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 2rem;
          color: #999;
        }

        .empty-state p {
          margin-top: 1rem;
          font-size: 1.1rem;
        }

        .deliveries-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 1.5rem;
        }

        .delivery-card {
          background: white;
          border: 2px solid;
          border-radius: 12px;
          padding: 1.5rem;
          transition: all 0.3s;
        }

        .delivery-card:hover {
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }

        .card-header h3 {
          margin: 0 0 0.3rem 0;
          font-size: 1.3rem;
          color: #1a1a1a;
        }

        .customer-name {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.9rem;
          color: #666;
          margin: 0;
        }

        .status-badge {
          padding: 0.4rem 0.8rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .status-pending {
          background: #fef3c7;
          color: #92400e;
        }

        .status-ready_for_delivery {
          background: #bfdbfe;
          color: #1e40af;
        }

        .status-out_for_delivery {
          background: #d8b4fe;
          color: #6b21a8;
        }

        .status-delivered {
          background: #bbf7d0;
          color: #166534;
        }

        .card-details {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
          margin-bottom: 1rem;
        }

        .detail-row {
          display: flex;
          gap: 0.8rem;
          color: #666;
          font-size: 0.9rem;
        }

        .detail-row svg {
          color: #7c4a32;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .label {
          font-weight: 600;
          color: #999;
          font-size: 0.75rem;
          text-transform: uppercase;
          margin: 0;
        }

        .value {
          margin: 0.2rem 0 0 0;
          color: #333;
        }

        .card-notes {
          background: #f9f3f0;
          padding: 0.8rem;
          border-radius: 6px;
          margin-bottom: 1rem;
          border-left: 3px solid #7c4a32;
        }

        .card-notes .label {
          font-size: 0.7rem;
        }

        .card-notes .value {
          font-size: 0.85rem;
          line-height: 1.4;
        }

        .driver-info {
          background: #eff6ff;
          padding: 0.8rem;
          border-radius: 6px;
          margin-bottom: 1rem;
          border-left: 3px solid #2d71f8;
        }

        .driver-info .label {
          font-size: 0.7rem;
        }

        .driver-info .value {
          font-weight: 600;
          color: #1a1a1a;
        }

        .phone {
          font-size: 0.8rem;
          color: #666;
          margin: 0.3rem 0 0 0;
        }

        .driver-form {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .driver-form input {
          padding: 0.6rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 0.9rem;
        }

        .driver-form input:focus {
          outline: none;
          border-color: #7c4a32;
          box-shadow: 0 0 0 3px rgba(124, 74, 50, 0.1);
        }

        .card-actions {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .btn {
          padding: 0.7rem 1rem;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #292524;
          color: white;
        }

        .btn-primary:hover {
          background: #7c4a32;
          transform: translateY(-1px);
        }

        .btn-secondary {
          background: #f5f0eb;
          color: #292524;
          border: 1px solid #e0d9d2;
        }

        .btn-secondary:hover {
          background: #e0d9d2;
        }

        .btn-success {
          background: #10b981;
          color: white;
        }

        .btn-success:hover {
          background: #059669;
          transform: translateY(-1px);
        }

        @media (max-width: 768px) {
          .delivery-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .deliveries-grid {
            grid-template-columns: 1fr;
          }

          .status-filters {
            flex-direction: column;
          }

          .filter-btn {
            width: 100%;
          }
        }
      `}</style>
        </div>
    )
}
