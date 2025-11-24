# WhatsApp Messages Not Sending - Troubleshooting Guide

## 🔍 Current Issues

You're experiencing:
- ✅ OTP works (can login)
- ❌ Account creation message not sent
- ❌ Appointment booking messages not sent  
- ❌ Campaign messages not sent

## 🐛 Most Likely Causes

### 1. **Malformed Access Token** (CRITICAL)

**Error Seen Earlier:**
```
Malformed access token EAAbi5CS4e6kBQDZE...
```

**Fix:**
1. Go to [Meta Business Suite](https://business.facebook.com)
2. Navigate to **WhatsApp Manager** → **API Setup**
3. Click **Generate** or **Copy** the access token
4. Update `.env.local`:
   ```env
   META_WHATSAPP_ACCESS_TOKEN=your_new_token_here
   ```
5. **Important:** No quotes, no spaces
6. Restart server: `npm run dev`

### 2. **Recipient Not Opted In**

Meta WhatsApp requires users to **opt-in** before receiving messages.

**Error Code:** `131048`
**Error Message:** "Recipient has not opted in to receive messages from your business."

**Solutions:**
- **Option A:** User must send a message to your WhatsApp Business number first (24-hour window opens)
- **Option B:** Create approved message templates in Meta Business Manager (can send anytime)

### 3. **Phone Number Not Registered**

**Error Code:** `131047`
**Error Message:** "Recipient phone number is not registered with WhatsApp."

**Fix:** Phone number must be registered with WhatsApp (have WhatsApp installed)

## 📊 How to Check What's Happening

### Check Server Logs

After the fixes I made, you'll now see detailed logs:

**✅ Success:**
```
[Meta WhatsApp] ✅ Message sent successfully to +919913798908, Message ID: wamid.xxx
[Appointment WhatsApp] ✅ Appointment confirmation sent successfully to: +919913798908
[Signup WhatsApp] ✅ Account creation message sent successfully to: +919913798908
```

**❌ Failure:**
```
[Meta WhatsApp] ❌ Failed to send message to +919913798908: {
  error: "Access token is invalid or expired...",
  errorCode: 190
}
```

### Check Browser Console

1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Look for WhatsApp errors

### Check Terminal/Server Logs

When you run `npm run dev`, check the terminal for:
- `[Meta WhatsApp]` logs
- Error codes and messages

## 🔧 Step-by-Step Fix

### Step 1: Fix Access Token

1. **Get New Token:**
   - Go to Meta Business Suite → WhatsApp Manager → API Setup
   - Generate new access token

2. **Update Environment:**
   ```env
   META_WHATSAPP_ACCESS_TOKEN=EAA...your_new_token_here
   META_WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
   ```

3. **Restart Server**

### Step 2: Test Message Sending

**Test 1: OTP Message**
- Try signing up with a phone number
- Check logs for OTP message status

**Test 2: Appointment Message**
- Book an appointment from website
- Check logs for appointment confirmation message

**Test 3: Campaign Message**
- Create a campaign
- Check logs for campaign message status

### Step 3: Check Error Codes

Common error codes and fixes:

| Error Code | Meaning | Fix |
|------------|---------|-----|
| `190` | Invalid/Malformed Access Token | Get new token from Meta |
| `131047` | Phone not registered with WhatsApp | User needs WhatsApp installed |
| `131048` | User not opted in | User must send message first or use template |
| `4` or `80007` | Rate limit exceeded | Wait before sending more |
| `100` | Invalid phone number format | Check phone number format |

## 📱 Message Opt-In Process

### For Users to Receive Messages:

**Method 1: User Initiates (24-Hour Window)**
1. User sends message to your WhatsApp Business number
2. You can reply with free-form messages for 24 hours
3. After 24 hours, need template messages

**Method 2: Template Messages (Always Works)**
1. Create message templates in Meta Business Manager
2. Get Meta approval (24-48 hours)
3. Can send to opted-in users anytime
4. No 24-hour window limitation

## 🔍 Debugging Checklist

- [ ] Access token is valid (not expired, no spaces/quotes)
- [ ] Phone Number ID is correct in environment
- [ ] Server restarted after updating environment
- [ ] Check server logs for `[Meta WhatsApp]` messages
- [ ] Check browser console for client-side errors
- [ ] Verify recipient phone number format (should be +91xxxxxxxxxx)
- [ ] Check if user has WhatsApp installed
- [ ] Check if user has opted in (sent message first)

## 🎯 Quick Test

To test if messaging works:

1. **Send OTP:**
   ```
   Sign up with your phone number
   → Check server logs for: [Meta WhatsApp] ✅ or ❌
   ```

2. **Book Appointment:**
   ```
   Book an appointment from website
   → Check server logs for: [Appointment WhatsApp] ✅ or ❌
   ```

3. **Check Logs:**
   ```
   Look for error codes and messages
   → Most common: 190 (invalid token) or 131048 (not opted in)
   ```

## 📝 What I Fixed

1. ✅ Added detailed error logging for all WhatsApp messages
2. ✅ Better error messages for common issues
3. ✅ Logs now show success/failure for each message
4. ✅ Error codes are logged for debugging

## 🚨 Most Common Issue Right Now

Based on the error you showed earlier, the **malformed access token** is likely causing ALL messages to fail silently.

**Fix this first:**
1. Get a new access token from Meta
2. Update environment variable
3. Restart server
4. Test again

After fixing the token, you'll see clear error messages if there are other issues (like opt-in problems).

---

**Need More Help?** Check the server logs after trying to send a message - they now show exactly what's failing and why.

