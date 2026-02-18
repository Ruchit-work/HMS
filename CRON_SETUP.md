# Cron Jobs Setup (Auto Campaigns & Appointment Reminders)

This app uses two scheduled jobs that run automatically:

1. **Auto Campaigns** – Creates health awareness campaigns and sends WhatsApp notifications to patients
2. **Appointment Reminders** – Sends 24-hour-before reminders to patients with upcoming appointments

## Vercel Deployment (Recommended)

If deployed on **Vercel**, cron jobs are configured in `vercel.json` and run automatically:
- **Campaigns**: Daily at 6:00 AM IST (00:30 UTC)
- **Reminders**: Daily at 11:30 AM IST (6:00 UTC)

No extra setup needed.

## External Cron (cron-job.org, etc.)

If Vercel crons are unreliable (e.g. on Hobby plan) or you self-host, use an external cron service:

### 1. Set `CRON_SECRET`

Add to your environment (Vercel → Project → Settings → Environment Variables, or `.env.local`):

```
CRON_SECRET=your-secure-random-string-here
```

Generate a random string, e.g.: `openssl rand -hex 32`

### 2. Create cron jobs

#### Auto Campaigns
- **URL**: `https://your-domain.com/api/auto-campaigns/generate?check=today&publish=true&sendWhatsApp=true`
- **Method**: GET
- **Header**: `Authorization: Bearer YOUR_CRON_SECRET` or `x-cron-secret: YOUR_CRON_SECRET`
- **Schedule**: Daily at 00:30 UTC (6:00 AM IST)

#### Appointment Reminders
- **URL**: `https://your-domain.com/api/appointments/send-reminders`
- **Method**: GET
- **Header**: `Authorization: Bearer YOUR_CRON_SECRET` or `x-cron-secret: YOUR_CRON_SECRET`
- **Schedule**: Daily at 06:00 UTC (11:30 AM IST)

### 3. Manual test

From Campaign Management, use:
- **Generate Auto Campaigns (Today)** – with "Send WhatsApp notifications" checked
- **Test Reminders Now** – sends reminders for appointments in the ±90 minute window
