# Debug Guide: Completion WhatsApp Message

## The fix should work locally - no deployment needed!

The code changes are already in place. If it's still not working, follow these debugging steps:

## Step 1: Check Browser Console

1. Open your browser's Developer Tools (F12)
2. Go to the **Console** tab
3. Complete an appointment as a doctor
4. Look for these log messages:
   - `[Completion WhatsApp] Sending completion message:`
   - `[Completion WhatsApp] Success:` or `[Completion WhatsApp] Failed to send:`

## Step 2: Check Server Logs (Terminal)

1. Look at your terminal where `npm run dev` is running
2. When you complete an appointment, you should see:
   - `[send-completion-whatsapp] Request received`
   - `[send-completion-whatsapp] Authentication successful`
   - `[send-completion-whatsapp] Request body:`
   - `[send-completion-whatsapp] Appointment document found in hospital collection`
   - `[send-completion-whatsapp] Sending WhatsApp message to:`
   - `[send-completion-whatsapp] WhatsApp send result:`

## Step 3: Common Issues & Fixes

### Issue 1: "Authentication failed"
**Check:** Make sure you're logged in as a doctor
**Fix:** Log out and log back in as a doctor

### Issue 2: "Appointment document not found"
**Check:** Look for this in server logs: `[send-completion-whatsapp] Appointment document not found`
**Possible causes:**
- Hospital ID not being passed correctly
- Appointment stored in different collection

**Fix:** Check if `hospitalId` is being passed in the request. Look for:
```
[send-completion-whatsapp] Request body: { hospitalId: '...' }
```

### Issue 3: "Patient phone number not found"
**Check:** Look for: `[send-completion-whatsapp] Patient phone number not found`
**Fix:** 
- Make sure the appointment has `patientPhone` field
- Or the patient document has `phone` or `phoneNumber` field

### Issue 4: "Meta WhatsApp credentials not configured"
**Check:** Look for: `Meta WhatsApp credentials not configured`
**Fix:** Make sure these environment variables are set in `.env.local`:
```
META_WHATSAPP_ACCESS_TOKEN=your_token_here
META_WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
```

## Step 4: Test the API Directly

You can test the API endpoint directly using curl or Postman:

```bash
curl -X POST http://localhost:3000/api/doctor/send-completion-whatsapp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "appointmentId": "YOUR_APPOINTMENT_ID",
    "patientId": "YOUR_PATIENT_ID",
    "patientPhone": "+1234567890",
    "patientName": "Test Patient",
    "hospitalId": "YOUR_HOSPITAL_ID"
  }'
```

## Step 5: Verify Data Flow

1. **Check appointment completion:**
   - Complete an appointment
   - Check if appointment status changes to "completed" in Firestore

2. **Check API call:**
   - Open Network tab in browser DevTools
   - Filter by "send-completion-whatsapp"
   - Check if the request is being made
   - Check the response status and body

3. **Check Firestore:**
   - Go to Firebase Console
   - Check `hospitals/{hospitalId}/appointments/{appointmentId}`
   - Verify the appointment exists and has `patientPhone` field

## Quick Test Checklist

- [ ] Doctor is logged in
- [ ] Hospital ID is selected/active
- [ ] Appointment exists in `hospitals/{hospitalId}/appointments/`
- [ ] Appointment has `patientPhone` field
- [ ] Environment variables are set (META_WHATSAPP_ACCESS_TOKEN, etc.)
- [ ] Server logs show API request received
- [ ] Browser console shows no errors

## Still Not Working?

If it's still not working after checking all the above:

1. **Share the server logs** - Copy the console output when completing an appointment
2. **Share browser console errors** - Any red errors in the browser console
3. **Check Network tab** - Screenshot of the API request/response

The code changes are correct, so the issue is likely:
- Missing environment variables
- Appointment data structure mismatch
- Authentication issue
- WhatsApp API configuration issue

