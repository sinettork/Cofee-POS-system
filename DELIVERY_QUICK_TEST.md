# 🚀 Quick Start Guide - Website Delivery Tracking

## TL;DR - What's New

✅ **Website Checkout** - Choose "Delivery" or "Take Away"  
✅ **Live Tracking** - Customers see delivery status in real-time  
✅ **POS Integration** - Staff assign drivers and update status  
✅ **Auto-Refresh** - Everything updates every 10 seconds  

---

## 📍 URLs You'll Need

| Page | URL |
|------|-----|
| **Website** | `http://localhost:5174` |
| **POS Login** | `http://localhost:5174/pos` |
| **Checkout Page** | `http://localhost:5174/cart` |
| **Tracking Page** | `http://localhost:5174/delivery-tracking?orderId=42` |

---

## ⚡ Quick Test Workflow

### Step 1: Login to Website as Customer

```
1. Go to http://localhost:5174
2. Scroll to bottom → Login section
3. Enter phone or Gmail
4. Register if first time
```

### Step 2: Add Items to Cart

```
1. Browse products
2. Click "+" to add items
3. View cart → Go to checkout
```

### Step 3: Choose Delivery Order Type

```
1. In Checkout → Look for "Order Type"
2. See two buttons: [Take Away] or [Delivery]
3. Click "Delivery" button (turns orange)
```

### Step 4: Enter Delivery Details

```
When "Delivery" is selected, you'll see:
- Phone field (for pickup calls)
- Delivery Phone field (for driver to call)
- Delivery Address field
- Map picker button (click to pick exact location)
- Saved addresses quick-picks (Home/Work)
```

### Step 5: Complete Payment & Submit

```
1. Choose payment method (Cash, KHQR, Card)
2. Click "Place Delivery Order" button
3. Order submitted → Wait 2 seconds
4. REDIRECTED to Tracking Page! 🎉
```

### Step 6: See Delivery Tracking Page

```
You should see:
✓ Order number (#12345)
✓ Status badge (yellow = "Preparing Order")
✓ Delivery progress timeline
✓ Your delivery address
✓ "Driver will be assigned soon" message
✓ Order details at bottom
✓ Auto-refresh indicator
```

### Step 7: Login to POS as Manager

```
1. Go to http://localhost:5174/pos
2. Username: manager
3. Password: manager123
4. Click "Delivery" tab in navigation
```

### Step 8: See Delivery Queue

```
You should see:
✓ Your delivery order from Step 5
✓ Customer name
✓ Delivery address
✓ Phone number
✓ Status: "Pending"
✓ Filter buttons (Pending, Ready, Out, Delivered)
```

### Step 9: Assign Driver

```
1. Find your order in the queue
2. Scroll down on the card
3. Enter driver name: "John Driver"
4. Enter driver phone: "+1(555)888-9999"
5. Click "Assign Driver"
✓ Driver assigned successfully!
```

### Step 10: Mark Ready for Delivery

```
1. Find order with driver assigned
2. Look for button: "Mark Ready"
3. Click it
✓ Status changes to "Ready for Delivery" (blue)
✓ Timestamps get updated
```

### Step 11: Mark Out for Delivery

```
1. Continue scrolling
2. Click "Out for Delivery" button
✓ Status changes to "Out for Delivery" (purple)
✓ New timestamp recorded
```

### Step 12: Complete Delivery

```
1. Continue scrolling
2. Click "Mark Delivered" button
✓ Status changes to "Delivered" (green)
✓ Delivery complete timestamp recorded
```

### Step 13: Watch Tracking Page Update in Real-Time

```
While you're updating status in POS:
1. Return to browser with Tracking Page
2. Watch it auto-update every 10 seconds
✓ Progress timeline updates
✓ Driver info appears
✓ Status badges color-change
✓ "Updates automatically" message shown
```

---

## 🎯 Key Features to Test

### ✓ Order Type Toggle
- [x] Switch between "Take Away" and "Delivery"
- [x] Button labels change
- [x] Color changes (orange = selected)
- [x] Delivery fields appear/disappear

### ✓ Delivery Address Input
- [x] Manual text input works
- [x] Map picker shows map
- [x] Click map to pick location
- [x] Save as Home / Save as Work buttons
- [x] Load from saved presets

### ✓ Checkout Button Labels
- [x] Shows "Place Delivery Order" when Delivery selected
- [x] Shows "Place Takeaway Order" when Takeaway selected
- [x] Changes based on payment method

### ✓ Redirect to Tracking Page
- [x] After delivery order placed
- [x] URL shows orderId in query param
- [x] Tracking page loads automatically
- [x] 2-second delay before redirect

### ✓ Live Delivery Tracking
- [x] Shows all order details
- [x] Timeline shows all 4 steps
- [x] Auto-completes filled steps
- [x] Displays driver info when assigned
- [x] Shows delivery address & phone
- [x] Auto-refreshes every 10 seconds
- [x] Back button works

### ✓ POS Delivery Management
- [x] Delivery tab shows orders
- [x] Can filter by status
- [x] Driver assignment form visible
- [x] Can assign driver
- [x] Status buttons update correctly
- [x] Queue auto-refreshes
- [x] Multiple orders work

### ✓ Real-Time Sync
- [x] Update in POS → Tracking page shows update
- [x] Happens within 10 seconds (auto-refresh)
- [x] Both pages stay in sync
- [x] No manual refresh needed

---

## 🐛 Troubleshooting

### Tracking Page Shows "No delivery order found"
**Fix:** 
- Check browser console for errors
- Verify login token exists in localStorage
- Check URL has `?orderId=42` parameter
- Try refreshing the page

### Order Not Appearing in POS Delivery Queue
**Fix:**
- Make sure order was placed with "Delivery" type
- Wait a few seconds or refresh
- Check POS token is manager/operator role
- Check order status is "Active" not "Done"

### Driver Phone Not Showing in Tracking Page
**Fix:**
- Go back to POS
- Find the order
- Scroll down to driver assignment section
- Make sure driver was actually assigned
- Refresh tracking page

### Not Redirecting to Tracking Page After Order
**Fix:**
- Check browser console for errors
- Wait 2 seconds (redirect delay)
- Try refreshing page manually
- Check localStorage has order ID

### Auto-Refresh Not Working
**Fix:**
- Check browser network tab
- Verify API calls to `/api/delivery/{orderId}`
- Check token is valid (not expired)
- Browser might be throttling - try Chrome DevTools
- Check no console errors

---

## 📊 Testing Data

**Test Login Credentials:**
```
POS Manager:
  Username: manager
  Password: manager123

Website Customer:
  Email: test@test.com
  Password: password123
  OR
  Phone: +1-555-1234
```

**Test Product IDs (for API):**
```
Use any from your product catalog, typically:
  m01   - Most Coffee item
  s01   - Some Snack item
  d01   - Some Drink item
```

**Test Delivery Address:**
```
123 Main Street, Downtown
456 Oak Avenue, Apartment 4B
Pick using map picker for exact coordinates
```

---

## 📱 Mobile Testing

Website works on mobile:
1. Desktop: http://localhost:5174
2. Mobile: http://YOUR_IP:5174
3. Can place delivery orders
4. Tracking page responsive
5. All features work on small screens

---

## ✅ Full Test Checklist

```
Website Features:
☐ Can select "Delivery" order type
☐ Can select "Take Away" order type
☐ Delivery phone field appears for delivery
☐ Can enter delivery address
☐ Map picker works
☐ Can save home/work addresses
☐ Can load saved addresses
☐ Can use current location
☐ Gets redirected to tracking page
☐ Checkout buttons show correct labels

Tracking Page:
☐ Shows order number
☐ Shows delivery status
☐ Shows delivery address
☐ Shows delivery phone
☐ Shows order details
☐ Timeline shows all 4 steps
☐ Refreshes every 10 seconds
☐ Back button works

POS Delivery Queue:
☐ Delivery tab visible
☐ Queue shows delivery orders
☐ Can filter by status
☐ Can assign driver
☐ Can mark ready
☐ Can mark out
☐ Can mark delivered
☐ Queue refreshes automatically

Real-Time Sync:
☐ POS update appears on tracking page
☐ Sync happens within 10 seconds
☐ No manual refresh needed
☐ Timestamps update correctly

Backend:
☐ Order created successfully
☐ Delivery fields populated
☐ Status updates persist
☐ No database errors
```

---

## 🎉 You're Done!

When all tests pass:
1. **Backend is ready** for mobile app development
2. **Website delivery checkout works** end-to-end
3. **POS delivery management works** smoothly
4. **Real-time tracking works** reliably

Ready to start **Phase 2: Mobile Customer App**!

