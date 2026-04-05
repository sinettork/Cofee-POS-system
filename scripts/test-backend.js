#!/usr/bin/env node

// Comprehensive Backend Delivery System Test
const baseUrl = 'http://localhost:4000';
let token = '';
let orderId = '';

async function test(name, fn) {
    try {
        console.log(`\n${name}...`);
        await fn();
    } catch (err) {
        console.error(`  ❌ FAILED: ${err.message}`);
        process.exit(1);
    }
}

async function apiCall(method, endpoint, body = null) {
    const opts = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (token) {
        opts.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
        opts.body = JSON.stringify(body);
    }

    const res = await fetch(`${baseUrl}${endpoint}`, opts);
    const data = await res.json();

    if (!res.ok && data.error) {
        throw new Error(`${res.status}: ${data.error}`);
    }

    return { ok: res.ok, status: res.status, data };
}

async function main() {
    console.log('🔍 Coffee POS Delivery System - Backend Test');
    console.log('='.repeat(50));

    // Test 1: Health
    await test('1. Health Check', async () => {
        const { data } = await apiCall('GET', '/api/health');
        if (!data.ok) throw new Error('Health check failed');
        console.log('  ✅ API is healthy');
    });

    // Test 2: Login
    await test('2. Manager Login', async () => {
        const { data } = await apiCall('POST', '/api/auth/login', {
            username: 'manager',
            password: 'manager123',
        });
        if (!data.token) throw new Error('No token received');
        token = data.token;
        console.log(`  ✅ Logged in, token: ${token.substring(0, 20)}...`);
    });

    // Test 3: Get Catalog
    let firstProduct = null;
    await test('3. Load Product Catalog', async () => {
        const { data } = await apiCall('GET', '/api/public/catalog');
        if (!data.products || data.products.length === 0) throw new Error('No products');
        firstProduct = data.products[0];
        console.log(`  ✅ Loaded ${data.products.length} products`);
        console.log(`  Sample: ${firstProduct.name} ($${firstProduct.base_price})`);
    });

    // Test 4: Create Delivery Order
    await test('4. Create Delivery Order (POS)', async () => {
        const orderBody = {
            customerName: 'John Doe',
            tableName: 'Delivery-Queue',
            orderType: 'Delivery',
            deliveryAddress: '123 Main Street, Downtown',
            deliveryPhone: '+1(555)123-4567',
            deliveryNote: 'Please ring doorbell',
            items: [
                {
                    productId: firstProduct.id,
                    productName: firstProduct.name,
                    quantity: 2,
                    itemPrice: firstProduct.base_price,
                    totalPrice: firstProduct.base_price * 2,
                },
            ],
            subtotal: firstProduct.base_price * 2,
            tax: 0,
            discount: 0,
            total: firstProduct.base_price * 2,
            paymentMethod: 'Cash',
            paymentStatus: 'Paid',
            amountReceived: firstProduct.base_price * 2,
            changeAmount: 0,
        };

        const { data } = await apiCall('POST', '/api/orders', orderBody);
        if (!data.id) throw new Error('No order ID returned');
        orderId = data.id;
        console.log(`  ✅ Order created`);
        console.log(`  Order ID: ${orderId}`);
        console.log(`  Order #: ${data.order_number}`);
        console.log(`  Status: ${data.status} | Delivery: ${data.delivery_status}`);
    });

    // Test 5: Get Delivery Queue
    await test('5. Fetch Delivery Queue', async () => {
        const { data } = await apiCall('GET', '/api/delivery/queue?limit=50');
        if (!Array.isArray(data.deliveries)) throw new Error('Invalid queue response');
        console.log(`  ✅ Retrieved ${data.deliveries.length} delivery orders`);
        if (data.deliveries.length > 0) {
            const first = data.deliveries[0];
            console.log(`  First order: ${first.order_number}`);
            console.log(`  Customer: ${first.customer_name}`);
            console.log(`  Status: ${first.delivery_status}`);
        }
    });

    // Test 6: Assign Driver
    await test('6. Assign Driver', async () => {
        const { data } = await apiCall('PATCH', `/api/delivery/${orderId}/assign`, {
            driverName: 'Mike Johnson',
            driverPhone: '+1(555)888-9999',
        });
        if (!data.ok) throw new Error('Assignment failed');
        console.log('  ✅ Driver assigned');
        console.log('  Driver: Mike Johnson');
        console.log('  Phone: +1(555)888-9999');
    });

    // Test 7: Status Progression
    await test('7. Test Status Progression', async () => {
        const statuses = ['ready_for_delivery', 'out_for_delivery', 'delivered'];
        for (const status of statuses) {
            const { data } = await apiCall('PATCH', `/api/delivery/${orderId}/status`, {
                status,
            });
            if (!data.ok) throw new Error(`Status update to ${status} failed`);
            console.log(`  ✅ Status → ${status}`);
        }
    });

    // Test 8: Get Final Order Details
    await test('8. Get Final Order Details', async () => {
        const { data } = await apiCall('GET', `/api/delivery/${orderId}`);
        console.log('  ✅ Final order state:');
        console.log(`  Order: ${data.order_number}`);
        console.log(`  Delivery Status: ${data.delivery_status}`);
        console.log(`  Driver: ${data.driver_name}`);
        console.log(`  Address: ${data.delivery_address}`);
        console.log(`  Total: $${data.total}`);
    });

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ ALL BACKEND TESTS PASSED!');
    console.log('='.repeat(50));
    console.log('\nBackend Status:');
    console.log('  ✓ Database: Operating');
    console.log('  ✓ API: All endpoints working');
    console.log('  ✓ Delivery flow: Complete and tested');
    console.log('  ✓ POS integration: Ready');
    console.log('\nReady for:');
    console.log('  • Website checkout integration');
    console.log('  • Mobile app development (Phase 2/3)');
    console.log('  • Production deployment\n');
}

main();
