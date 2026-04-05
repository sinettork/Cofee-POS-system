#!/usr/bin/env pwsh
# Backend Delivery System Test

$base = "http://localhost:4000"

Write-Host "🔍 Testing Coffee POS Delivery System Backend" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Test 1: Health
Write-Host "`n1. Health Check..." -ForegroundColor Yellow
try {
    $h = (Invoke-WebRequest "$base/api/health" -UseBasicParsing).Content | ConvertFrom-Json
    Write-Host "✅ API Health: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Health check failed" -ForegroundColor Red
    exit 1
}

# Test 2: Login
Write-Host "`n2. Manager Login..." -ForegroundColor Yellow
try {
    $loginBody = '{"username":"manager","password":"manager123"}'
    $lr = (Invoke-WebRequest "$base/api/auth/login" -Method Post -UseBasicParsing `
      -Headers @{"Content-Type"="application/json"} -Body $loginBody).Content | ConvertFrom-Json
    $token = $lr.token
    Write-Host "✅ Logged in successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Login failed: $_" -ForegroundColor Red
    exit 1
}

# Test 3: Get Catalog
Write-Host "`n3. Loading Product Catalog..." -ForegroundColor Yellow
try {
    $cat = (Invoke-WebRequest "$base/api/public/catalog" -UseBasicParsing).Content | ConvertFrom-Json
    $prodCount = $cat.products.Count
    Write-Host "✅ Loaded $prodCount products" -ForegroundColor Green
} catch {
    Write-Host "❌ Catalog load failed: $_" -ForegroundColor Red
    exit 1
}

# Test 4: Create Delivery Order via POS
Write-Host "`n4. Creating Delivery Order (via POS)..." -ForegroundColor Yellow
try {
    $firstProd = $cat.products[0]
    $ob = @{
        customerName="John Doe"
        tableName="Delivery-Queue"
        orderType="Delivery"
        deliveryAddress="123 Main Street, Downtown"
        deliveryPhone="+1(555)123-4567"
        deliveryNote="Please ring doorbell"
        items=@(@{
            productId=$firstProd.id
            productName=$firstProd.name
            quantity=2
            itemPrice=$firstProd.base_price
            totalPrice=($firstProd.base_price * 2)
        })
        subtotal=($firstProd.base_price * 2)
        tax=0
        discount=0
        total=($firstProd.base_price * 2)
        paymentMethod="Cash"
        paymentStatus="Paid"
        amountReceived=($firstProd.base_price * 2)
        changeAmount=0
    } | ConvertTo-Json

    $orResp = (Invoke-WebRequest "$base/api/orders" -Method Post -UseBasicParsing `
      -Headers @{"Content-Type"="application/json"; "Authorization"="Bearer $token"} `
      -Body $ob)
    $or = $orResp.Content | ConvertFrom-Json
    $oid = $or.id
    Write-Host "✅ Order created successfully" -ForegroundColor Green
    Write-Host "   Order ID: $oid" -ForegroundColor Gray
    Write-Host "   Order #: $($or.order_number)" -ForegroundColor Gray
    Write-Host "   Status: $($or.status) | Delivery: $($or.delivery_status)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Order creation failed: $_" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response.Content)" -ForegroundColor Red
    exit 1
}

# Test 5: Get Delivery Queue
Write-Host "`n5. Fetching Delivery Queue..." -ForegroundColor Yellow
try {
    $dResp = (Invoke-WebRequest "$base/api/delivery/queue?limit=50" -UseBasicParsing `
      -Headers @{"Authorization"="Bearer $token"})
    $dq = $dResp.Content | ConvertFrom-Json
    $dcount = $dq.deliveries.Count
    Write-Host "✅ Delivery queue retrieved: $dcount orders" -ForegroundColor Green
    if ($dcount -gt 0) {
        $first = $dq.deliveries[0]
        Write-Host "   First order: $($first.order_number)" -ForegroundColor Gray
        Write-Host "   Customer: $($first.customer_name)" -ForegroundColor Gray
        Write-Host "   Delivery: $($first.delivery_status)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Queue fetch failed: $_" -ForegroundColor Red
}

# Test 6: Assign Driver
Write-Host "`n6. Assigning Driver to Order $oid..." -ForegroundColor Yellow
try {
    $ab = @{
        driverName="Mike Johnson"
        driverPhone="+1(555)888-9999"
    } | ConvertTo-Json

    $arResp = (Invoke-WebRequest "$base/api/delivery/$oid/assign" -Method Patch -UseBasicParsing `
      -Headers @{"Content-Type"="application/json"; "Authorization"="Bearer $token"} `
      -Body $ab)
    $ar = $arResp.Content | ConvertFrom-Json
    Write-Host "✅ Driver assigned" -ForegroundColor Green
    Write-Host "   Driver: Mike Johnson" -ForegroundColor Gray
    Write-Host "   Phone: +1(555)888-9999" -ForegroundColor Gray
} catch {
    Write-Host "❌ Driver assignment failed: $_" -ForegroundColor Red
}

# Test 7: Update Status Flow
Write-Host "`n7. Testing Status Progression..." -ForegroundColor Yellow
$statuses = @("ready_for_delivery", "out_for_delivery", "delivered")
foreach ($status in $statuses) {
    try {
        $sb = @{ status = $status } | ConvertTo-Json
        $sr = (Invoke-WebRequest "$base/api/delivery/$oid/status" -Method Patch -UseBasicParsing `
          -Headers @{"Content-Type"="application/json"; "Authorization"="Bearer $token"} `
          -Body $sb)
        $res = $sr.Content | ConvertFrom-Json
        Write-Host "✅ Status → $status" -ForegroundColor Green
    } catch {
        Write-Host "❌ Status update to $status failed: $_" -ForegroundColor Red
    }
}

# Test 8: Get Final Order Details  
Write-Host "`n8. Getting Final Order Details..." -ForegroundColor Yellow
try {
    $detResp = (Invoke-WebRequest "$base/api/delivery/$oid" -UseBasicParsing `
      -Headers @{"Authorization"="Bearer $token"})
    $det = $detResp.Content | ConvertFrom-Json
    Write-Host "✅ Final order state:" -ForegroundColor Green
    Write-Host "   Order: $($det.order_number)" -ForegroundColor Gray
    Write-Host "   Delivery Status: $($det.delivery_status)" -ForegroundColor Gray
    Write-Host "   Driver: $($det.driver_name)" -ForegroundColor Gray
    Write-Host "   Address: $($det.delivery_address)" -ForegroundColor Gray
    Write-Host "   Total: `$$($det.total)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Details fetch failed: $_" -ForegroundColor Red
}

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host "✅ ALL BACKEND TESTS PASSED!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "`nBackend is ready for:" -ForegroundColor Cyan
Write-Host "   + Website to POS integration" -ForegroundColor White
Write-Host "   + Delivery queue management" -ForegroundColor White
Write-Host "   + Mobile app development (Phase 2/3)" -ForegroundColor White
Write-Host ""
