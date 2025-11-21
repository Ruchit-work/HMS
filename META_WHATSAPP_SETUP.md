# Meta WhatsApp API Webhook Setup Guide

This guide explains how to set up WhatsApp webhooks using Meta WhatsApp Business API to receive and respond to messages automatically.

## 📋 Prerequisites

1. **Meta Business Account** with WhatsApp Business API access
2. **WhatsApp Business Account** approved by Meta
3. **Phone Number ID** and **Access Token** from Meta
4. **Environment Variables** configured in `.env.local`

## 🔧 Environment Variables

Add these to your `.env.local` file:

```env
# Meta WhatsApp Configuration
META_WHATSAPP_ACCESS_TOKEN=your_access_token_here
META_WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
META_WHATSAPP_VERIFY_TOKEN=harmony_verify_token_97431d8b
META_WHATSAPP_API_VERSION=v22.0
```

### How to Get These Values:

1. **Access Token**:
   - Go to Meta for Developers: https://developers.facebook.com
   - Select your app → WhatsApp → API Setup
   - Copy the "Temporary access token" (or generate a permanent one)

2. **Phone Number ID**:
   - Same page (API Setup)
   - Copy the "Phone number ID"

3. **Verify Token**:
   - Create your own secure token (or use the default)
   - This is used to verify webhook ownership

## 🚀 Setup Steps

### Step 1: Configure Webhook in Meta Business Manager

1. **Go to Meta Business Manager**: https://business.facebook.com
2. **Navigate to**: WhatsApp Manager → Configuration → Webhook
3. **Click "Edit"** on your webhook
4. **Set Callback URL**:
   ```
   https://yourdomain.com/api/whatsapp/webhook
   ```
   Or for local testing with ngrok:
   ```
   https://your-ngrok-url.ngrok.io/api/whatsapp/webhook
   ```
5. **Set Verify Token**: (same as `META_WHATSAPP_VERIFY_TOKEN` in your `.env.local`)
6. **Subscribe to fields**: 
   - ✅ `messages`
   - ✅ `message_status`
7. **Save** the configuration

### Step 2: Test Locally (Optional)

For local testing, use **ngrok** to expose your local server:

```bash
# Install ngrok (if not installed)
# Download from: https://ngrok.com/download

# Start your Next.js dev server
npm run dev

# In another terminal, start ngrok
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Use this URL in Meta webhook configuration
```

### Step 3: Verify Webhook

1. **After setting webhook URL**, Meta will send a GET request to verify
2. **Check your server logs** - you should see:
   ```
   [Meta WhatsApp] ✅ Webhook verified successfully
   ```
3. **If verification fails**, check:
   - Verify token matches in `.env.local` and Meta console
   - Webhook URL is accessible (HTTPS required)
   - Server is running

## 📱 Testing the Webhook

### Test 1: Send a Message

1. **Send a WhatsApp message** to your Meta WhatsApp Business number from your phone
2. **Message**: "Hello" or "Hi"
3. **Check your server logs** - you should see:
   ```
   [Meta WhatsApp] Received message: { from: '1234567890', text: 'Hello', ... }
   [Meta WhatsApp] ✅ Response sent successfully: { to: '1234567890', messageId: 'wamid.xxx' }
   ```
4. **Check your phone** - you should receive an automated response

### Test 2: Test Different Messages

Try these messages to test different responses:

| Message | Expected Response |
|---------|------------------|
| "Hello" or "Hi" | Welcome message with options |
| "Book" | Appointment booking information |
| "Appointments" | View appointments info |
| "Help" | Support information |
| "Random text" | Default response |

## 🔍 How It Works

### Flow Diagram

```
User sends WhatsApp message
    ↓
Meta WhatsApp receives message
    ↓
Meta sends webhook POST to /api/whatsapp/webhook
    ↓
Server processes message
    ↓
Server generates automated response
    ↓
Server sends response via Meta API
    ↓
User receives response on WhatsApp
```

### Webhook Verification Flow

```
Meta sends GET request
    ↓
Server checks hub.mode = "subscribe"
    ↓
Server checks hub.verify_token matches
    ↓
Server returns hub.challenge
    ↓
Meta verifies and activates webhook
```

### Code Structure

1. **GET Endpoint** (`/api/whatsapp/webhook`):
   - Handles webhook verification from Meta
   - Returns challenge token if verification succeeds

2. **POST Endpoint** (`/api/whatsapp/webhook`):
   - Receives incoming messages from Meta
   - Extracts message data (from, text, messageId)
   - Calls `generateAutoResponse()` to create response
   - Sends response using `sendTextMessage()`

3. **Response Generator** (`generateAutoResponse()`):
   - Simple keyword-based logic
   - Can be expanded for appointment booking later

4. **Message Sender** (`sendTextMessage()`):
   - Uses Meta WhatsApp Graph API
   - Handles message delivery

## 🛠️ Expanding for Appointment Booking

To add appointment booking functionality later:

1. **Add state management** (session storage in database):
   ```typescript
   // Store conversation state
   interface ConversationState {
     phone: string
     step: "initial" | "selecting_doctor" | "selecting_date" | "selecting_time"
     data: any
   }
   ```

2. **Create conversation flow**:
   ```
   User: "Book"
   Bot: "Which doctor would you like to book with?"
   User: "Dr. Smith"
   Bot: "What date? (DD/MM/YYYY)"
   User: "15/01/2024"
   Bot: "What time? (HH:MM)"
   User: "10:00"
   Bot: "Appointment confirmed!"
   ```

3. **Store appointments** in Firestore
4. **Add validation** and error handling

## 🐛 Troubleshooting

### Webhook Not Receiving Messages

1. ✅ **Check webhook URL** in Meta Business Manager is correct
2. ✅ **Verify HTTPS** - Meta requires HTTPS (use ngrok for local)
3. ✅ **Check webhook is verified** - Look for green checkmark in Meta console
4. ✅ **Check subscribed fields** - Make sure "messages" is subscribed
5. ✅ **Check server logs** for incoming requests

### Messages Not Sending

1. ✅ **Check environment variables** are set correctly
2. ✅ **Verify Access Token** is valid and not expired
3. ✅ **Check Phone Number ID** is correct
4. ✅ **Review rate limits** - Meta has daily limits
5. ✅ **Check phone number** is approved for messaging

### Webhook Verification Fails

1. ✅ **Verify token matches** in `.env.local` and Meta console
2. ✅ **Check webhook URL** is accessible (test with browser)
3. ✅ **Check server is running** and accessible
4. ✅ **Check HTTPS** - Meta requires HTTPS

### Common Errors

- **"Webhook processing failed"**: Check server logs for details
- **"Failed to send response"**: Verify Meta credentials
- **"Invalid phone number"**: Check phone number format (should be without +)
- **"Access token expired"**: Generate new access token

## 📚 Additional Resources

- **Meta WhatsApp Docs**: https://developers.facebook.com/docs/whatsapp
- **Meta Webhook Guide**: https://developers.facebook.com/docs/graph-api/webhooks
- **Meta Business Manager**: https://business.facebook.com
- **Next.js API Routes**: https://nextjs.org/docs/api-routes/introduction

## ✅ Next Steps

1. ✅ Webhook endpoint created
2. ✅ Automated responses working
3. ⏭️ Add conversation state management
4. ⏭️ Add appointment booking flow
5. ⏭️ Add database integration for sessions
6. ⏭️ Add user authentication

## 🔐 Security Notes

- **Never commit** `.env.local` to git
- **Use strong verify token** in production
- **Validate webhook requests** (consider adding signature verification)
- **Rate limit** webhook endpoints to prevent abuse
- **Monitor** webhook logs for suspicious activity

