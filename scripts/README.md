# Local Testing Scripts

## Testing Campaign Generation Locally

### Prerequisites

1. **Start the Next.js development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

2. **Ensure environment variables are set in `.env.local`:**
   ```env
   # Firebase Admin SDK
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=your-client-email
   FIREBASE_PRIVATE_KEY=your-private-key

   # Twilio (for WhatsApp)
   TWILIO_ACCOUNT_SID=your-account-sid
   TWILIO_AUTH_TOKEN=your-auth-token
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

   # Base URL (optional, defaults to http://localhost:3000)
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   ```

### Quick Start

1. **Test campaign generation (without WhatsApp):**
   ```bash
   npm run test:campaign
   ```

2. **Test campaign generation with WhatsApp:**
   ```bash
   npm run test:campaign:whatsapp
   ```

3. **Test for tomorrow's campaigns:**
   ```bash
   npm run test:campaign:tomorrow
   ```

### Manual Usage

You can also run the script directly with custom options:

```bash
# Generate campaigns for today (default)
node scripts/test-campaign-whatsapp.js

# Generate campaigns with WhatsApp notifications
node scripts/test-campaign-whatsapp.js --send-whatsapp

# Generate campaigns for tomorrow
node scripts/test-campaign-whatsapp.js --check=tomorrow

# Generate campaigns without publishing
node scripts/test-campaign-whatsapp.js --no-publish

# Combine options
node scripts/test-campaign-whatsapp.js --check=tomorrow --send-whatsapp

# Force generation even if no health awareness days found
node scripts/test-campaign-whatsapp.js --force
```

### Using the Admin UI

Alternatively, you can test using the admin dashboard:

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open the admin dashboard:**
   ```
   http://localhost:3000/admin-dashboard
   ```

3. **Navigate to Campaign Management tab**

4. **Click "Generate Auto Campaigns (Today) - Manual Test"**
   - Check "Send WhatsApp notifications to patients" if you want to test WhatsApp
   - Uncheck if you only want to test campaign generation

### Testing WhatsApp Locally

To test WhatsApp notifications locally:

1. **Ensure Twilio credentials are set in `.env.local`**

2. **Make sure you have test phone numbers in your Twilio account**
   - Twilio sandbox allows testing with verified numbers
   - Add test numbers in Twilio Console → Phone Numbers → Verified Caller IDs

3. **Update patient data in Firestore:**
   - Ensure test patients have valid phone numbers
   - Set patient status to "active"
   - Use phone numbers in format: `+1234567890` (with country code)

4. **Run the test:**
   ```bash
   npm run test:campaign:whatsapp
   ```

5. **Check results:**
   - Check your Twilio Console for message status
   - Check server logs for detailed WhatsApp sending information
   - Check your test phone for WhatsApp messages

### Troubleshooting

#### Server not running
```
❌ Server is not running! Please start the Next.js dev server first:
   npm run dev
```
**Solution:** Start the Next.js development server in a separate terminal.

#### No health awareness days found
```
⚠️  No health awareness days found for today
```
**Solution:** 
- Check `src/server/healthAwarenessDays.ts` for available dates
- Use `--check=tomorrow` to test with tomorrow's date
- Use `--force` to generate campaigns anyway (not recommended)

#### Firebase Admin SDK errors
```
❌ Firebase Admin initialization failed
```
**Solution:**
- Check that `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` are set in `.env.local`
- Ensure the private key is properly formatted (with `\n` for newlines)

#### Twilio WhatsApp errors
```
❌ Twilio client not configured
```
**Solution:**
- Check that `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_WHATSAPP_FROM` are set in `.env.local`
- Ensure your Twilio account has WhatsApp enabled
- Verify the WhatsApp sender number is correct

#### No patients found
```
⚠️  No active patients with phone numbers found
```
**Solution:**
- Add test patients to Firestore with `status: "active"` and valid phone numbers
- Ensure phone numbers are in international format (e.g., `+1234567890`)

### Environment Variables Reference

#### Required for Campaign Generation
- `FIREBASE_PROJECT_ID` - Your Firebase project ID
- `FIREBASE_CLIENT_EMAIL` - Firebase Admin SDK client email
- `FIREBASE_PRIVATE_KEY` - Firebase Admin SDK private key

#### Required for WhatsApp (Optional)
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_WHATSAPP_FROM` - Twilio WhatsApp sender number (format: `whatsapp:+14155238886`)

#### Optional
- `NEXT_PUBLIC_BASE_URL` - Base URL for building links (defaults to `http://localhost:3000`)
- `VERCEL_URL` - Automatically set by Vercel (not needed for local testing)

### Tips

1. **Test without WhatsApp first:**
   - Start with `npm run test:campaign` (without WhatsApp)
   - Verify campaigns are created correctly
   - Then test with WhatsApp: `npm run test:campaign:whatsapp`

2. **Check Firestore:**
   - Verify campaigns are created in the `campaigns` collection
   - Check campaign data structure
   - Verify campaign status is "published" (if publish=true)

3. **Check server logs:**
   - Watch the terminal running `npm run dev` for detailed logs
   - Look for `[auto-campaigns-generate]` log messages
   - Check for WhatsApp sending logs

4. **Test with different dates:**
   - Use `--check=tomorrow` to test with tomorrow's health awareness days
   - Modify `healthAwarenessDays.ts` to add test dates for today

5. **Use Twilio Sandbox:**
   - Twilio sandbox allows testing with verified numbers
   - Add your test phone number in Twilio Console
   - Use sandbox sender number for testing

### Next Steps

After testing locally:

1. **Verify campaigns are created correctly**
2. **Test WhatsApp messages are sent**
3. **Check campaign display on patient/doctor dashboards**
4. **Verify book appointment links work**
5. **Deploy to Vercel for production testing**

