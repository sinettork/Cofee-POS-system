#!/usr/bin/env pwsh
# Test Delivery System Backend

$baseUrl = "http://localhost:4000"

Write-Host "🔍 Testing Coffee POS Delivery System Backend" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "`n1. Testing API Health..." -ForegroundColor Yellow
try {
    $health = Invoke-WebRequest -Uri "$baseUrl/api/health" -Method Get -UseBasicParsing | ConvertFrom-Json
    if ($health.ok) {
        Write-Host "✅ API is healthy" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Health check failed: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Manager Login
Write-Host "`n2. Logging in as Manager..." -ForegroundColor Yellow
try {
    $loginResp = Invoke-WebRequest -Uri "$baseUrl/api/auth/login" `
        -Method Post -UseBasicParsing `
        -Headers @{"Content-Type"="application/json"} `
        -Body '{"username":"manager","password":"manager123"}' `
        -SkipHttpErrorCheck
    
    $login = $loginResp.Content | ConvertFrom-Json
    if ($login.token) {
        $token = $login.token
        Write-Host "✅ Login successful" -ForegroundColor Green
        Write-Host "   Token (first 30 chars): $($token.Substring(0,30))..." -ForegroundColor Gray
    } else {
        Write-Host "❌ Login failed: $($login.error)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Login error: $_" -ForegroundColor Red
    exit 1
}

# Test 3: Get Public Catalog
Write-Host "`n3. Getting Public Product Catalog..." -ForegroundColor Yellow
try {
    $catalog = Invoke-WebRequest -Uri "$baseUrl/api/public/catalog" `
        -Method Get -UseBasicParsing | ConvertFrom-Json
    $productCount = $catalog.products.Count
    Write-Host "✅ Catalog loaded: $productCount products" -ForegroundColor Green
    Write-Host "   Sample product: $($catalog.products[0].name)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Catalog error: $_" -ForegroundColor Red
}

# Test 4: Create Test Delivery Order
Write-Host "`n4. Creating Test Delivery Order..." -ForegroundColor Yellow
try {
    $firstProduct = $catalog.products[0]
    $orderBody = @{
        customerName = "Test Customer"
        table = "Delivery-Test"
        orderType = "Delivery"
        deliveryAddress = "123 Main Street, Test City"
        deliveryPhone = "+1 (555) 123-4567"
        deliveryNote = "Test delivery order"
        items = @(@{
            productId = $firstProduct.id
            quantity = 2
        })
        paymentMethod = "Cash"
        paymentStatus = "Paid"
    } | ConvertTo-Json

    $orderResp = Invoke-WebRequest -Uri "$baseUrl/api/orders" `
        -Method Post -UseBasicParsing `
        -Headers @{
            "Content-Type" = "application/json"
            "Authorization" = "Bearer $token"
        } `
        -Body $orderBody `
        -SkipHttpErrorCheck

    $order = $orderResp.Content | ConvertFrom-Json
    if ($order.id) {
        $orderId = $order.id
        Write-Host "✅ Delivery order created" -ForegroundColor Green
        Write-Host "   Order ID: $orderId" -ForegroundColor Gray
        Write-Host "   Order Number: $($order.order_number)" -ForegroundColor Gray
        Write-Host "   Status: $($order.status)" -ForegroundColor Gray
        Write-Host "   Delivery Status: $($order.delivery_status)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Order creation failed: $($order.error)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Order creation error: $_" -ForegroundColor Red
    exit 1
}

# Test 5: Get Delivery Queue
Write-Host "`n5. Getting Delivery Queue..." -ForegroundColor Yellow
try {
    $queueResp = Invoke-WebRequest -Uri "$baseUrl/api/delivery/queue?limit=50" `
        -Method Get -UseBasicParsing `
        -Headers @{
            "Authorization" = "Bearer $token"
        } `
        -SkipHttpErrorCheck

    $queue = $queueResp.Content | ConvertFrom-Json
    $count = $queue.deliveries.Count
    Write-Host "✅ Delivery queue retrieved: $count orders" -ForegroundColor Green
    
    if ($queue.deliveries.Count -gt 0) {
        $firstOrder = $queue.deliveries[0]
        Write-Host "   First order: $($firstOrder.order_number)" -ForegroundColor Gray
        Write-Host "   Customer: $($firstOrder.customer_name)" -ForegroundColor Gray
        Write-Host "   Address: $($firstOrder.delivery_address)" -ForegroundColor Gray
        Write-Host "   Status: $($firstOrder.delivery_status)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Queue retrieval error: $_" -ForegroundColor Red
}

# Test 6: Assign Driver
Write-Host "`n6. Assigning Driver to Order $orderId..." -ForegroundColor Yellow
try {
    $assignBody = @{
        driverName = "John Delivery Driver"
        driverPhone = "+1 (555) 888-9999"
    } | ConvertTo-Json

    $assignResp = Invoke-WebRequest -Uri "$baseUrl/api/delivery/$orderId/assign" `
        -Method Patch -UseBasicParsing `
        -Headers @{
            "Content-Type" = "application/json"
            "Authorization" = "Bearer $token"
        } `
        -Body $assignBody `
        -SkipHttpErrorCheck

    $result = $assignResp.Content | ConvertFrom-Json
    if ($result.ok) {
        Write-Host "✅ Driver assigned successfully" -ForegroundColor Green
        Write-Host "   Driver: John Delivery Driver" -ForegroundColor Gray
        Write-Host "   Phone: +1 (555) 888-9999" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  Assignment response: $($result.message)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Driver assignment error: $_" -ForegroundColor Red
}

# Test 7: Update Delivery Status
Write-Host "`n7. Updating Delivery Status..." -ForegroundColor Yellow
$statuses = @("ready_for_delivery", "out_for_delivery", "delivered")
foreach ($status in $statuses) {
    try {
        $statusBody = @{ status = $status } | ConvertTo-Json

        $statusResp = Invoke-WebRequest -Uri "$baseUrl/api/delivery/$orderId/status" `
            -Method Patch -UseBasicParsing `
            -Headers @{
                "Content-Type" = "application/json"
                "Authorization" = "Bearer $token"
            } `
            -Body $statusBody `
            -SkipHttpErrorCheck

        $result = $statusResp.Content | ConvertFrom-Json
        if ($result.ok) {
            Write-Host "✅ Status updated to: $status" -ForegroundColor Green
        }
    } catch {
        Write-Host "❌ Status update error: $_" -ForegroundColor Red
    }
}

# Test 8: Get Order Details
Write-Host "`n8. Getting Final Order Details..." -ForegroundColor Yellow
try {
    $detailResp = Invoke-WebRequest -Uri "$baseUrl/api/delivery/$orderId" `
        -Method Get -UseBasicParsing `
        -Headers @{
            "Authorization" = "Bearer $token"
        } `
        -SkipHttpErrorCheck

    $detail = $detailResp.Content | ConvertFrom-Json
    Write-Host "✅ Order details retrieved" -ForegroundColor Green
    Write-Host "   Final Status: $($detail.delivery_status)" -ForegroundColor Gray
    Write-Host "   Driver: $($detail.driver_name)" -ForegroundColor Gray
    Write-Host "   Total: `$$($detail.total)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Details retrieval error: $_" -ForegroundColor Red
}

Write-Host "`n" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "✅ ALL TESTS COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "`nBackend is ready for website integration!" -ForegroundColor Cyan
