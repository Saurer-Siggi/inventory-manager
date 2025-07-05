# Testing Guide - Saurer Siggi Inventory Manager

This guide will help you systematically test all the implemented features of the Saurer Siggi Inventory Manager.

## Prerequisites

1. **Development server running**: `npm run dev` (http://localhost:5173)
2. **Database schema applied**: All tables created in Supabase
3. **Browser with dev tools**: For debugging and monitoring

## Testing Checklist

### 1. Initial Setup & Connection Test

**✅ Database Connection**
- [ ] Navigate to http://localhost:5173
- [ ] Verify you see "Connected to Supabase ✅" message
- [ ] Check that Total Inventory shows "0 bottles"
- [ ] Verify all 5 storage locations are listed with 0 quantities

**Expected Results:**
- Green connection status
- Dashboard loads without errors
- All storage locations visible: MyPlace Abteil 9073, MyPlace Abteil 9128, Aron Zuhause, Nacho Zuhause, Aiko Zuhause

---

### 2. Authentication System Testing

**✅ User Registration**
- [ ] Click "Need an account? Sign Up"
- [ ] Enter a test email: `test@example.com`
- [ ] Enter a password: `testpassword123`
- [ ] Click "Sign Up"
- [ ] Check email for verification link (if email confirmation is enabled)
- [ ] Verify redirect to dashboard after successful signup

**✅ User Login**
- [ ] If not logged in, navigate to /login
- [ ] Enter your test credentials
- [ ] Click "Sign In"
- [ ] Verify redirect to dashboard
- [ ] Check that user email appears in header: "Welcome, test@example.com"

**✅ Protected Routes**
- [ ] Sign out using the "Sign Out" button
- [ ] Try to access http://localhost:5173 directly
- [ ] Verify automatic redirect to /login
- [ ] Try to access /add, /remove, /transfer directly
- [ ] Verify all redirect to /login when not authenticated

**✅ Session Management**
- [ ] Sign in again
- [ ] Refresh the page
- [ ] Verify you remain logged in
- [ ] Open a new tab with the same URL
- [ ] Verify you're still authenticated

---

### 3. Core Inventory Operations Testing

**✅ Add Bottles Operation**
- [ ] Click "Add Bottles" button
- [ ] Select "Saurer Siggi Likör (SSL-001)" from product dropdown
- [ ] Select "MyPlace Abteil 9073" from storage dropdown
- [ ] Enter quantity: `24`
- [ ] Add notes: "Initial stock delivery"
- [ ] Click "Add Bottles"
- [ ] Verify redirect to dashboard
- [ ] Check that inventory now shows 24 bottles total
- [ ] Verify Likör count shows 24, Klopfer shows 0

**✅ Add More Bottles (Different Product)**
- [ ] Add Bottles again
- [ ] Select "Saurer Siggi Klopfer (SSK-001)"
- [ ] Select "Aron Zuhause"
- [ ] Enter quantity: `12`
- [ ] Add notes: "Home storage"
- [ ] Submit
- [ ] Verify total is now 36 bottles (24 Likör + 12 Klopfer)

**✅ Remove Bottles Operation**
- [ ] Click "Remove Bottles" button
- [ ] Select "Saurer Siggi Likör (SSL-001)"
- [ ] Select "MyPlace Abteil 9073"
- [ ] Enter quantity: `6`
- [ ] Add notes: "Delivery to Bar XYZ"
- [ ] Click "Remove Bottles"
- [ ] Verify total decreases to 30 bottles (18 Likör + 12 Klopfer)

**✅ Transfer Bottles Operation**
- [ ] Click "Transfer Bottles" button
- [ ] Select "Saurer Siggi Likör (SSL-001)"
- [ ] From Storage: "MyPlace Abteil 9073"
- [ ] To Storage: "Nacho Zuhause"
- [ ] Enter quantity: `6`
- [ ] Add notes: "Moving to Nacho's place"
- [ ] Click "Transfer Bottles"
- [ ] Verify total remains 30 bottles
- [ ] Check inventory by location shows:
  - MyPlace Abteil 9073: 12 Likör
  - Nacho Zuhause: 6 Likör
  - Aron Zuhause: 12 Klopfer

---

### 4. Real-time Updates Testing

**✅ Multi-Tab Testing**
- [ ] Open the app in two browser tabs (or different browsers)
- [ ] Sign in on both tabs
- [ ] In Tab 1: Add 5 bottles to any location
- [ ] In Tab 2: Verify the inventory updates automatically without refresh
- [ ] In Tab 2: Remove 3 bottles
- [ ] In Tab 1: Verify the change appears automatically

**✅ Real-time Synchronization**
- [ ] Perform several operations (add, remove, transfer)
- [ ] Watch the dashboard totals update in real-time
- [ ] Verify the "Inventory by Location" section updates immediately
- [ ] Check that all changes are reflected across all open tabs

---

### 5. Data Validation & Error Handling

**✅ Form Validation**
- [ ] Try to submit Add Bottles with empty fields
- [ ] Verify error message appears
- [ ] Try to enter negative quantity
- [ ] Try to enter 0 quantity
- [ ] Verify form prevents submission

**✅ Transfer Validation**
- [ ] Try to transfer from and to the same location
- [ ] Verify error: "Source and destination storage locations must be different"
- [ ] Try to transfer more bottles than available (if you have inventory)
- [ ] Note: Current implementation allows negative inventory (business decision)

**✅ Authentication Errors**
- [ ] Try to sign in with wrong password
- [ ] Verify error message displays
- [ ] Try to sign up with invalid email format
- [ ] Try to sign up with existing email

---

### 6. Database Integrity Testing

**✅ Transaction Audit Trail**
- [ ] Go to your Supabase dashboard
- [ ] Navigate to Table Editor > transactions
- [ ] Verify all your operations are recorded with:
  - Correct product_id, storage_id
  - Correct transaction_type (add/remove/transfer)
  - Your user email
  - Timestamps
  - Notes you entered

**✅ Inventory Consistency**
- [ ] Check the inventory table in Supabase
- [ ] Verify quantities match what you see in the app
- [ ] Perform a few more operations
- [ ] Refresh the inventory table
- [ ] Verify the database updates correctly

---

### 7. User Experience Testing

**✅ Mobile Responsiveness**
- [ ] Open the app on mobile device or use browser dev tools
- [ ] Test all pages in mobile view
- [ ] Verify buttons are easy to tap
- [ ] Check that forms are usable on mobile

**✅ Navigation Flow**
- [ ] Test all navigation paths
- [ ] Verify Cancel buttons work correctly
- [ ] Check that breadcrumbs/back navigation is intuitive
- [ ] Test browser back button functionality

**✅ Loading States**
- [ ] Watch for loading indicators during operations
- [ ] Test with slower internet (throttle in dev tools)
- [ ] Verify loading states prevent double-submissions

---

### 8. Advanced Testing Scenarios

**✅ Edge Cases**
- [ ] Try to remove more bottles than available
- [ ] Test with very large quantities (999+)
- [ ] Test with special characters in notes
- [ ] Test operations with empty notes

**✅ Performance Testing**
- [ ] Add 50+ transactions quickly
- [ ] Verify app remains responsive
- [ ] Check real-time updates still work with many transactions

**✅ Browser Compatibility**
- [ ] Test in Chrome, Firefox, Safari, Edge
- [ ] Verify all features work consistently

---

## Test Data Scenarios

### Scenario 1: New Business Setup
```
1. Add 100 Likör bottles to MyPlace Abteil 9073
2. Add 50 Klopfer bottles to MyPlace Abteil 9128
3. Transfer 20 Likör to Aron Zuhause
4. Transfer 15 Klopfer to Nacho Zuhause
5. Remove 10 Likör from Aron Zuhause (delivery)
```

### Scenario 2: Daily Operations
```
1. Morning: Add 30 Likör bottles (new delivery)
2. Afternoon: Remove 8 Likör bottles (customer order)
3. Evening: Transfer 12 Klopfer between locations
4. Night: Remove 5 Klopfer bottles (bar delivery)
```

## Expected Final State

After running all tests, you should have:
- ✅ Multiple products in various locations
- ✅ Complete transaction history
- ✅ Real-time updates working
- ✅ User authentication functional
- ✅ All CRUD operations working
- ✅ Data integrity maintained

## Troubleshooting

**If you encounter issues:**

1. **Check browser console** for JavaScript errors
2. **Check Supabase logs** for database errors
3. **Verify environment variables** are correct
4. **Check network tab** for failed API calls
5. **Try hard refresh** (Cmd/Ctrl + Shift + R)

**Common Issues:**
- **RLS policies**: Ensure authenticated users can access tables
- **Realtime subscriptions**: Check if Realtime is enabled in Supabase
- **Session issues**: Clear browser storage and re-login

## Success Criteria

✅ **Authentication**: Users can sign up, sign in, and stay logged in
✅ **Core Operations**: Add, remove, transfer all work correctly
✅ **Real-time Updates**: Changes appear instantly across all devices
✅ **Data Integrity**: All operations are recorded in audit trail
✅ **User Experience**: App is intuitive and responsive

---

**Happy Testing! 🧪**

Report any issues you find, and we'll address them in the next phase.