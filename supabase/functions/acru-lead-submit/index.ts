import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type LeadPayload = {
  lead?: {
    name?: string;
    email?: string;
    phone?: string;
    dob?: string;
    address?: string;
    message?: string;
    retired_status?: string;
  };
  eligibility?: { eligible?: boolean; reason?: string };
  calculator?: Record<string, unknown>;
  eligibleAutoReply?: {
    from?: string;
    to?: string;
    subject?: string;
    body?: string;
  } | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function assertEmail(value: string | undefined) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

async function sendEmail(email: { from: string; to: string; subject: string; body: string }) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) return { skipped: true, reason: "RESEND_API_KEY is not configured" };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: email.from,
      to: email.to,
      subject: email.subject,
      text: email.body,
    }),
  });

  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function getSupabaseSecretKey() {
  const legacyServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyServiceRoleKey) return legacyServiceRoleKey;

  const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!secretKeysJson) return null;

  try {
    const secretKeys = JSON.parse(secretKeysJson) as Record<string, string>;
    return secretKeys.service_role || secretKeys.secret || Object.values(secretKeys)[0] || null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const payload = (await req.json()) as LeadPayload;
    const lead = payload.lead ?? {};

    if (!lead.name || !assertEmail(lead.email)) {
      return jsonResponse({ error: "Name and valid email are required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = getSupabaseSecretKey();
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase environment variables are not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await supabase
      .from("acru_death_tax_leads")
      .insert({
        name: lead.name,
        email: lead.email,
        phone: lead.phone ?? null,
        dob: lead.dob || null,
        address: lead.address ?? null,
        message: lead.message ?? null,
        retired_status: lead.retired_status ?? null,
        eligibility: payload.eligibility ?? {},
        calculator: payload.calculator ?? {},
        eligible_auto_reply: payload.eligibleAutoReply ?? null,
      })
      .select("id")
      .single();

    if (error) throw error;

    let customerEmailResult = null;
    if (payload.eligibility?.eligible && payload.eligibleAutoReply && lead.email) {
      customerEmailResult = await sendEmail({
        from: Deno.env.get("CUSTOMER_EMAIL_FROM") || payload.eligibleAutoReply.from || "ACru Wealth <danacrubud@gmail.com>",
        to: lead.email,
        subject: payload.eligibleAutoReply.subject || "Thank you for getting in touch with ACru Wealth",
        body: payload.eligibleAutoReply.body || "Thank you for getting in touch. A team member will get in touch with you in the next day or two.",
      });
    }

    const teamEmail = Deno.env.get("TEAM_NOTIFICATION_EMAIL");
    let teamEmailResult = null;
    if (teamEmail) {
      teamEmailResult = await sendEmail({
        from: Deno.env.get("TEAM_EMAIL_FROM") || "ACru Wealth Leads <danacrubud@gmail.com>",
        to: teamEmail,
        subject: `New super death tax lead: ${lead.name}`,
        body: [
          `Name: ${lead.name}`,
          `Email: ${lead.email}`,
          `Phone: ${lead.phone ?? ""}`,
          `DOB: ${lead.dob ?? ""}`,
          `Address: ${lead.address ?? ""}`,
          `Eligibility: ${payload.eligibility?.eligible ? "Eligible" : "Not eligible / review"}`,
          `Reason: ${payload.eligibility?.reason ?? ""}`,
          `Message: ${lead.message ?? ""}`,
          `Supabase lead id: ${data.id}`,
        ].join("\n"),
      });
    }

    return jsonResponse({ ok: true, leadId: data.id, customerEmailResult, teamEmailResult });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
