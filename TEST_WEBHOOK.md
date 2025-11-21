# Testing WhatsApp Webhook

## Quick Test Guide

### 1. Start Your Server

```bash
npm run dev
```

Your webhook will be available at: `http://localhost:3000/api/whatsapp/webhook`

### ⚠️ Important: "Forbidden" Error Explained

**If you see "Forbidden" when accessing the webhook URL in browser, this is NORMAL!**

The GET endpoint is **only for Meta's webhook verification**, not for manual testing. It expects:
- `hub.mode=subscribe`
- `hub.verify_token=your_token`
- `hub.challenge=random_string`

When you access it directly in browser (without these parameters), it correctly returns "Forbidden" for security.

**This is expected behavior - your webhook is working correctly!**

### 2. Test the GET Endpoint (Webhook Verification)

To test the GET endpoint properly, you need to simulate Meta's verification request:

```bash
# Test with correct parameters (should return challenge)
curl "http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=harmony_verify_token_97431d8b&hub.challenge=test123"

# Should return: "test123" (the challenge string)
```

**Or test in browser with full URL:**
```
http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=harmony_verify_token_97431d8b&hub.challenge=test123
```

**Expected result:** You should see `test123` (or whatever challenge you pass)

**If you see "Forbidden":**
- Check `hub.verify_token` matches your `.env.local` value
- Check `hub.mode` is exactly `subscribe`
- Check server logs for details

### 3. Test Locally with ngrok

For local testing, you need to expose your server to the internet:

```bash
# Install ngrok (if not installed)
# Download from: https://ngrok.com/download

# Start ngrok
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
```

### 4. Configure Meta Webhook

1. Go to Meta Business Manager: https://business.facebook.com
2. Navigate to: **WhatsApp Manager** → **Configuration** → **Webhook**
3. Click **Edit** or **Configure**
4. Set:
   - **Callback URL**: `https://your-ngrok-url.ngrok.io/api/whatsapp/webhook`
   - **Verify Token**: `harmony_verify_token_97431d8b` (same as in `.env.local`)
5. Subscribe to fields:
   - ✅ `messages`
   - ✅ `message_status` (optional)
6. Click **Verify and Save**
7. Meta will send a GET request to verify - check server logs for success

### 5. Test Sending a Message

1. **Send WhatsApp message** to your Meta WhatsApp Business number from your phone
2. **Message**: "Hello"
3. **Check server logs** - you should see:
   ```
   [WhatsApp Webhook] Received message: { from: 'whatsapp:+1234567890', body: 'Hello', ... }
   [WhatsApp Webhook] Response sent successfully: { to: '+1234567890', messageId: 'SM...' }
   ```
4. **Check your phone** - you should receive an automated response

### 6. Test Different Messages

Try these to test different responses:

| Message | Expected Response |
|---------|------------------|
| "Hello" or "Hi" | Welcome message with options |
| "Book" | Appointment booking information |
| "Appointments" | View appointments info |
| "Help" | Support information |
| "Random text" | Default response |

## Manual Testing with curl

### Test GET Endpoint (Webhook Verification)

```bash
# Test webhook verification (should return challenge)
curl "http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=harmony_verify_token_97431d8b&hub.challenge=test123"

# Expected: "test123" (the challenge string)
```

### Test POST Endpoint (Receive Messages)

You can simulate Meta's webhook POST request:

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

**Expected response:**
```json
{
  "success": true,
  "message": "Message received and response sent",
  "responseMessageId": "wamid.xxx"
}
```

## Expected Server Response

When working correctly, you should see in your server logs:

```
[WhatsApp Webhook] Received message: {
  from: 'whatsapp:+1234567890',
  body: 'Hello',
  messageSid: 'SM1234567890',
  timestamp: '2024-01-15T10:30:00.000Z'
}
[WhatsApp Webhook] Response sent successfully: {
  to: '+1234567890',
  messageId: 'SM9876543210'
}
```

## Troubleshooting

### Webhook Not Receiving Messages

1. ✅ Check webhook URL in Twilio console
2. ✅ Verify HTTPS (ngrok provides HTTPS)
3. ✅ Check server is running
4. ✅ Check server logs for incoming requests

### Messages Not Sending

1. ✅ Check `.env.local` has correct Twilio credentials
2. ✅ Verify Twilio account has balance
3. ✅ Check rate limits (50 messages/day in sandbox)
4. ✅ Review server logs for errors

### Common Errors

- **"Webhook processing failed"**: Check server logs for details
- **"Failed to send response"**: Verify Twilio credentials in `.env.local`
- **"No valid recipient"**: Check phone number format

## Next Steps

Once basic webhook is working:

1. ✅ Add conversation state management
2. ✅ Add appointment booking flow
3. ✅ Add database integration
4. ✅ Add user authentication

