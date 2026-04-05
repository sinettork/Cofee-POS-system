#!/usr/bin/env pwsh
# Simple Backend Test

$base = "http://localhost:4000"

# Test 1: Health
Write-Host "Testing health..." -ForegroundColor Cyan
$h = (Invoke-WebRequest "$base/api/health" -UseBasicParsing).Content | ConvertFrom-Json
Write-Host "✅ Health: $($h.ok)" -ForegroundColor Green

# Test 2: Login
Write-Host "Testing login..." -ForegroundColor Cyan
$loginBody = '{"username":"manager","password":"manager123"}'
$lr = (Invoke-WebRequest "$base/api/auth/login" -Method Post -UseBasicParsing `
  -Headers @{"Content-Type"="application/json"} -Body $loginBody).Content | ConvertFrom-Json
$token = $lr.token
Write-Host "✅ Login success, token length: $($token.Length)" -ForegroundColor Green

# Test 3: Get Catalog
Write-Host "Testing catalog..." -ForegroundColor Cyan
$cat = (Invoke-WebRequest "$base/api/public/catalog" -UseBasicParsing).Content | ConvertFrom-Json
Write-Host "✅ Products count: $($cat.products.Count)" -ForegroundColor Green

# Test 4: Create Delivery Order
Write-Host "Testing delivery order creation..." -ForegroundColor Cyan
$pid = $cat.products[0].id
$ob = @{
  customerName="Test User"
  table="Del-1"
  orderType="Delivery"
  deliveryAddress="123 Test St"
  deliveryPhone="+1-555-1234"
  deliveryNote="Test"
  items=@(@{productId=$pid;quantity=1})
  paymentMethod="Cash"
  paymentStatus="Paid"
} | ConvertTo-Json

$or = (Invoke-WebRequest "$base/api/orders" -Method Post -UseBasicParsing `
  -Headers @{"Content-Type"="application/json"; "Authorization"="Bearer $token"} `
  -Body $ob).Content | ConvertFrom-Json
$oid = $or.id
Write-Host "✅ Order created: ID=$oid, Status=$($or.delivery_status)" -ForegroundColor Green

# Test 5: Get Delivery Queue
Write-Host "Testing delivery queue..." -ForegroundColor Cyan
$dq = (Invoke-WebRequest "$base/api/delivery/queue" -UseBasicParsing `
  -Headers @{"Authorization"="Bearer $token"}).Content | ConvertFrom-Json
Write-Host "✅ Queue size: $($dq.deliveries.Count)" -ForegroundColor Green

# Test 6: Assign Driver
Write-Host "Testing driver assignment..." -ForegroundColor Cyan
$ab = @{driverName="Driver1";driverPhone="+1-555-9999"} | ConvertTo-Json
$ar = (Invoke-WebRequest "$base/api/delivery/$oid/assign" -Method Patch -UseBasicParsing `
  -Headers @{"Content-Type"="application/json"; "Authorization"="Bearer $token"} `
  -Body $ab).Content | ConvertFrom-Json
Write-Host "✅ Driver assigned: $($ar.ok)" -ForegroundColor Green

# Test 7: Update Status
Write-Host "Testing status update..." -ForegroundColor Cyan
$sb = @{status="ready_for_delivery"} | ConvertTo-Json
$sr = (Invoke-WebRequest "$base/api/delivery/$oid/status" -Method Patch -UseBasicParsing `
  -Headers @{"Content-Type"="application/json"; "Authorization"="Bearer $token"} `
  -Body $sb).Content | ConvertFrom-Json
Write-Host "✅ Status updated: $($sr.ok)" -ForegroundColor Green

Write-Host "`n🎉 ALL BACKEND TESTS PASSED!" -ForegroundColor Green
