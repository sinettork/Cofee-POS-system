#!/usr/bin/env node

/**
 * Real-Time Sync Verification Test
 * Tests the complete delivery workflow with real-time updates
 */

const baseUrl = 'http://localhost:4000';
let managerToken = '';
let customerToken = '';
let orderId = '';
let testResults = {
    passed: 0,
    failed: 0,
    tests: [],
};

async function apiCall(method, endpoint, body = null, token = null) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
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

function logTest(name, passed, message = '') {
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${name}${message ? ': ' + message : ''}`);
    testResults.tests.push({ name, passed, message });
    if (passed) {
        testResults.passed++;
    } else {
        testResults.failed++;
    }
}

async function setupTokens() {
    console.log('\n📝 Setup: Getting authentication tokens...\n');

    try {
        const managerResp = await apiCall('POST', '/api/auth/login', {
            username: 'manager',
            password: 'manager123',
        });
        managerToken = managerResp.data.token;
        logTest('Manager login', !!managerToken);

        try {
            const regResp = await apiCall('POST', '/api/public/customers/register', {
                fullName: 'Sync Test Customer',
                phone: '+1-555-sync-' + Date.now().toString().slice(-5),
                address: '123 Sync Test St',
                password: 'synctest@123',
            });
            customerToken = regResp.data.token;
            logTest('Customer registration', !!customerToken);
        } catch (regErr) {
            logTest('Customer registration', false, String(regErr.message));
            throw regErr;
        }
    } catch (err) {
        logTest('Setup tokens', false, String(err.message));
        throw err;
    }
}

async function createDeliveryOrder() {
    console.log('\n📦 Step 1: Creating delivery order...\n');

    try {
        const catalogResp = await apiCall('GET', '/api/public/catalog');
        const products = catalogResp.data.products;

        if (products.length === 0) {
            throw new Error('No products in catalog');
        }

        const product = products[0];
        logTest('Product catalog loaded', true, `${products.length} products`);

        const orderResp = await apiCall('POST', '/api/orders', {
            customerName: 'Sync Test Order',
            tableName: 'Sync-Test',
            orderType: 'Delivery',
            deliveryAddress: '123 Test St',
            deliveryPhone: '+1-555-1234',
            deliveryNote: 'Real-time sync test',
            items: [
                {
                    productId: product.id,
                    productName: product.name,
                    quantity: 1,
                    itemPrice: product.base_price,
                    totalPrice: product.base_price,
                },
            ],
            subtotal: product.base_price,
            tax: 0,
            discount: 0,
            total: product.base_price,
            paymentMethod: 'Cash',
            paymentStatus: 'Paid',
            amountReceived: product.base_price,
            changeAmount: 0,
        }, managerToken);

        orderId = orderResp.data.orderId;
        logTest('Delivery order created', orderId > 0, `Order ID: ${orderId}`);
    } catch (err) {
        logTest('Create delivery order', false, String(err.message));
        throw err;
    }
}

async function verifyInitialStatus() {
    console.log('\n🔍 Step 2: Verifying initial order status...\n');

    try {
        const resp = await apiCall('GET', `/api/public/delivery/${orderId}`, null, customerToken);
        const delivery = resp.data;

        logTest('Order retrieved', delivery.id > 0, `Status: ${delivery.delivery_status}`);
        logTest('Initial status is pending', delivery.delivery_status === 'pending');
        logTest('No driver assigned yet', !delivery.driver_name);

        return delivery;
    } catch (err) {
        logTest('Verify initial status', false, String(err.message));
        throw err;
    }
}

async function testRealtimeSync() {
    console.log('\n⚡ Step 3: Testing real-time sync (driver assignment)...\n');

    try {
        let syncDetected = false;
        let syncDetectionTime = 0;

        console.log('    Starting tracking...');
        await new Promise((resolve) => setTimeout(resolve, 1000));

        console.log('    Assigning driver in 3 seconds...');
        setTimeout(async () => {
            try {
                await apiCall('PATCH', `/api/delivery/${orderId}/assign`, {
                    driverName: 'John Sync Test',
                    driverPhone: '+1-555-9999',
                }, managerToken);
                console.log('    [POS] Driver assigned at T+3s');
            } catch (err) {
                console.error('    [POS] Assignment failed:', err.message);
            }
        }, 3000);

        for (let i = 0; i < 12; i++) {
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const resp = await apiCall('GET', `/api/public/delivery/${orderId}`, null, customerToken);
            const delivery = resp.data;

            if (delivery.driver_name && !syncDetected) {
                syncDetected = true;
                syncDetectionTime = i;
                console.log(`    [TRACKING] Driver detected at T+${i}s`);
            }
        }

        logTest('Driver assignment synced', syncDetected, `Detected in ${syncDetectionTime}s`);
        logTest('Sync within 10 seconds', syncDetectionTime <= 10);
    } catch (err) {
        logTest('Real-time sync test', false, String(err.message));
    }
}

async function testStatusProgression() {
    console.log('\n📊 Step 4: Testing status progression sync...\n');

    const statuses = [
        ['ready_for_delivery', 'Ready'],
        ['out_for_delivery', 'Out'],
        ['delivered', 'Delivered'],
    ];

    for (const [statusKey, label] of statuses) {
        console.log(`    Testing: ${label}...`);

        let statusDetected = false;
        let detectionTime = 0;

        setTimeout(async () => {
            try {
                await apiCall('PATCH', `/api/delivery/${orderId}/status`, { status: statusKey }, managerToken);
                console.log(`    [POS] Status "${label}" at T+2s`);
            } catch (err) {
                console.error(`    [POS] Status update failed:`, err.message);
            }
        }, 2000);

        for (let i = 0; i < 12; i++) {
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const resp = await apiCall('GET', `/api/public/delivery/${orderId}`, null, customerToken);
            const delivery = resp.data;

            if (delivery.delivery_status === statusKey && !statusDetected) {
                statusDetected = true;
                detectionTime = i;
                console.log(`    [TRACKING] Status detected at T+${i}s`);
            }
        }

        logTest(`Sync: ${label}`, statusDetected, `${detectionTime}s`);
    }
}

async function testConcurrentRequests() {
    console.log('\n🔄 Step 5: Testing concurrent requests...\n');

    try {
        const promises = [];
        for (let i = 0; i < 5; i++) {
            promises.push(apiCall('GET', `/api/public/delivery/${orderId}`, null, customerToken));
        }

        const results = await Promise.all(promises);
        const allSuccessful = results.every((r) => r.ok);
        const allSame = results.every((r) => r.data.id === orderId);

        logTest('Concurrent requests successful', allSuccessful, `${results.length} requests`);
        logTest('All responses consistent', allSame);
    } catch (err) {
        logTest('Concurrent requests', false, String(err.message));
    }
}

async function testQueueRefresh() {
    console.log('\n📋 Step 6: Testing delivery queue...\n');

    try {
        const resp = await apiCall('GET', '/api/delivery/queue?limit=50', null, managerToken);
        const queue = resp.data.deliveries;
        const testOrder = queue.find((o) => o.id === orderId);

        logTest('Test order in queue', !!testOrder, `Status: ${testOrder?.delivery_status}`);
        logTest('Queue shows final status', testOrder?.delivery_status === 'delivered');
    } catch (err) {
        logTest('Queue refresh', false, String(err.message));
    }
}

async function runTests() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   REAL-TIME SYNC VERIFICATION TEST                      ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    try {
        await setupTokens();
        await createDeliveryOrder();
        await verifyInitialStatus();
        await testRealtimeSync();
        await testStatusProgression();
        await testConcurrentRequests();
        await testQueueRefresh();
    } catch (err) {
        console.error('\n❌ Fatal error:', err.message);
    }

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║   TEST SUMMARY                                           ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`\nTotal Tests: ${testResults.passed + testResults.failed}`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    const rate = testResults.passed + testResults.failed > 0
        ? Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)
        : 0;
    console.log(`Success Rate: ${rate}%`);

    if (testResults.failed === 0) {
        console.log('\n🎉 ALL TESTS PASSED - Real-time sync is working smoothly!');
    } else {
        console.log('\n⚠️ Some tests failed - Review details below');
    }

    console.log('\n📊 Test Details:');
    testResults.tests.forEach((t) => {
        console.log(`   ${t.passed ? '✅' : '❌'} ${t.name}${t.message ? ': ' + t.message : ''}`);
    });

    console.log('\n');
}

runTests().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
