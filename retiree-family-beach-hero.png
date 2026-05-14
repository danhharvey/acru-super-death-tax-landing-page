# ACru Lead Submit Edge Function

This function receives the landing page form payload, stores it in Supabase, sends the eligible customer auto-reply, and optionally emails ACru a lead notification.

## Required setup

1. Run `supabase/schema.sql` in the Supabase SQL editor.
2. Deploy this function as `acru-lead-submit`.
3. Configure these function secrets:

```bash
supabase secrets set RESEND_API_KEY="..."
supabase secrets set CUSTOMER_EMAIL_FROM="ACru Wealth <verified-sender@yourdomain.com>"
supabase secrets set TEAM_NOTIFICATION_EMAIL="danacrubud@gmail.com"
supabase secrets set TEAM_EMAIL_FROM="ACru Wealth Leads <verified-sender@yourdomain.com>"
```

`SUPABASE_URL` and Supabase's service role/secret key are supplied by Supabase in the Edge Function environment. The function supports either `SUPABASE_SERVICE_ROLE_KEY` or Supabase's newer `SUPABASE_SECRET_KEYS` JSON.

## Landing page setup

Copy the deployed function URL into the HTML:

```js
const leadSubmitEndpoint = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/acru-lead-submit';
```

For email delivery, use a verified sender/domain with your email provider. The example function uses Resend.
