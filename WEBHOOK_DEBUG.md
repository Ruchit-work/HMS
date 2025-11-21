# Webhook Debugging Guide

## Understanding the Logs

### What You're Seeing:

```
[Meta WhatsApp] Webhook verification attempt: { 
  mode: null, 
  tokenReceived: 'none', 
  tokenExpected: '***1d8b' 
}
[Meta WhatsApp] ❌ Invalid mode: null
[Meta WhatsApp] ❌ Token mismatch
```

### What This Means:

1. **`mode: null`** - The `hub.mode` parameter is missing
2. **`tokenReceived: 'none'`** - The `hub.verify_token` parameter is missing
3. **This is NOT a Meta verification request** - It's likely:
   - A direct browser access (without parameters)
   - A test request without proper parameters
   - Meta hasn't sent the verification request yet

## Solutions

### ✅ Solution 1: Test with Proper Parameters

If you're testing manually, use this URL:

```
http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=harmony_verify_token_97431d8b&hub.challenge=test123
```

**Expected logs:**
```
[Meta WhatsApp] Webhook verification attempt: { 
  mode: 'subscribe', 
  tokenReceived: '***1d8b', 
  tokenExpected: '***1d8b' 
}
[Meta WhatsApp] ✅ Webhook verified successfully
```

**Expected response:** `test123` (the challenge string)

### ✅ Solution 2: Configure Webhook in Meta

1. **Go to Meta Business Manager**: https://business.facebook.com
2. **Navigate to**: WhatsApp Manager → Configuration → Webhook
3. **Set Callback URL**: `https://your-domain.com/api/whatsapp/webhook`
   - For local: Use ngrok URL: `https://your-ngrok-url.ngrok.io/api/whatsapp/webhook`
4. **Set Verify Token**: `harmony_verify_token_97431d8b` (must match your `.env.local`)
5. **Click "Verify and Save"**

**When Meta verifies, you'll see:**
```
[Meta WhatsApp] Webhook verification attempt: { 
  mode: 'subscribe', 
  tokenReceived: '***1d8b', 
  tokenExpected: '***1d8b' 
}
[Meta WhatsApp] ✅ Webhook verified successfully
```

### ✅ Solution 3: Check Your Environment Variables

Make sure your `.env.local` has:

```env
META_WHATSAPP_VERIFY_TOKEN=harmony_verify_token_97431d8b
```

**Important:** The verify token in `.env.local` must **exactly match** the one you set in Meta Business Manager.

## Common Issues

### Issue 1: Direct Browser Access

**Problem:** Opening `http://localhost:3000/api/whatsapp/webhook` in browser

**Why it fails:** No query parameters are sent

**Solution:** Add the required parameters or use Meta's verification

### Issue 2: Verify Token Mismatch

**Problem:** Token in `.env.local` doesn't match Meta console

**Solution:** 
1. Check `.env.local` - `META_WHATSAPP_VERIFY_TOKEN`
2. Check Meta Business Manager - Webhook Verify Token
3. Make sure they match exactly (case-sensitive)

### Issue 3: Meta Verification Not Triggered

**Problem:** Meta hasn't sent verification request yet

**Solution:**
1. Make sure webhook URL is set in Meta
2. Click "Verify and Save" in Meta console
3. Check server logs when Meta sends the request
4. Make sure server is accessible (use ngrok for local)

## Testing Checklist

- [ ] `.env.local` has `META_WHATSAPP_VERIFY_TOKEN` set
- [ ] Webhook URL is configured in Meta Business Manager
- [ ] Verify token in Meta matches `.env.local` exactly
- [ ] Server is running (`npm run dev`)
- [ ] Server is accessible (use ngrok for local testing)
- [ ] Clicked "Verify and Save" in Meta console
- [ ] Checked server logs when Meta sends verification

## Quick Test Commands

### Test GET Endpoint (Manual):

```bash
# Should return the challenge string
curl "http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=harmony_verify_token_97431d8b&hub.challenge=test123"
```

**Expected:** `test123`

### Test POST Endpoint (Simulate Message):

```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "1234567890",
            "id": "wamid.test123",
            "type": "text",
            "text": {
              "body": "Hello"
            }
          }]
        }
      }]
    }]
  }'
```

## Next Steps

1. **If testing manually:** Use the URL with parameters above
2. **If setting up with Meta:** Configure webhook in Meta Business Manager
3. **If using ngrok:** Make sure ngrok is running and URL is set in Meta
4. **Check logs:** Watch server logs when Meta sends verification request

