import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    from: string;
    to: string[];
    subject: string;
    text?: string;
    html?: string;
    headers?: Record<string, string>;
    attachments?: Array<{
      filename: string;
      content_type: string;
      size: number;
    }>;
  };
}

// Spam protection tuning
const MIN_FORM_FILL_MS = 3000; // humans can't fill the contact form faster than this
const MAX_PER_SENDER_PER_DAY = 3;
const MAX_TOTAL_PER_HOUR = 20;

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const stripTags = (html: string) =>
  html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .trim();

// "Jane Doe <jane@example.com>" -> "jane@example.com"
const extractAddress = (from: string) => {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim().toLowerCase();
};

// Collapse address variants that land in the same inbox (Gmail ignores dots and +tags)
const normalizeAddress = (address: string) => {
  const [local, domain] = address.split('@');
  if (!domain) return address;
  let base = local.split('+')[0];
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    base = base.replace(/\./g, '');
    return `${base}@gmail.com`;
  }
  return `${base}@${domain}`;
};

// Bot subjects look like "gBeTkFSAYWDSxrLHSLCK": one long run of letters with random casing.
// Real CamelCase ("OscarScoresAreWrong") splits into capital + lowercase-word runs;
// random casing produces lots of multi-capital runs and 1-2 letter lowercase runs, and few vowels.
const looksLikeGibberish = (subject: string) => {
  const s = subject.replace(/^\[[^\]]*\]\s*/, '').trim();
  if (!/^[A-Za-z]{15,}$/.test(s)) return false;
  const runs = s.match(/[A-Z]+|[a-z]+/g) || [];
  if (runs.length < 6) return false;
  const oddRuns = runs.filter((run) => (/[A-Z]/.test(run) ? run.length >= 2 : run.length <= 2)).length;
  const oddRatio = oddRuns / runs.length;
  const vowelRatio = (s.match(/[aeiou]/gi) || []).length / s.length;
  return oddRatio >= 0.5 || (oddRatio >= 0.45 && vowelRatio < 0.2);
};

const handler = async (req: Request): Promise<Response> => {
  console.log('📧 SUPPORT EMAIL WEBHOOK - Request received:', req.method);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log('📧 SUPPORT EMAIL WEBHOOK - Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  // Bots get the same response as a real submission so they can't tell they were filtered
  const silentlyDrop = (reason: string, detail?: unknown) => {
    console.warn(`📧 SUPPORT EMAIL WEBHOOK - Dropped (${reason}):`, detail ?? '');
    return new Response(
      JSON.stringify({ success: true, message: 'Support email processed successfully' }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  };

  try {
    // Parse the request body - can be from Resend webhook or direct POST
    let requestBody: any;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('📧 SUPPORT EMAIL WEBHOOK - Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON request body' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if this is a Resend webhook event or a direct POST
    let from: string;
    let to: string[];
    let subject: string;
    let text: string | undefined;
    let html: string | undefined;
    let createdAt: string;

    if (requestBody.type === 'email.received' && requestBody.data) {
      // Resend webhook format
      console.log('📧 SUPPORT EMAIL WEBHOOK - Resend webhook event received');
      const webhookEvent: ResendWebhookEvent = requestBody;
      from = webhookEvent.data.from;
      to = webhookEvent.data.to;
      subject = webhookEvent.data.subject;
      text = webhookEvent.data.text;
      html = webhookEvent.data.html;
      createdAt = webhookEvent.created_at;
    } else if (requestBody.from && requestBody.to) {
      // Direct POST format (website contact form, Google Apps Script, or other services)
      console.log('📧 SUPPORT EMAIL WEBHOOK - Direct POST request received');
      from = requestBody.from;
      to = Array.isArray(requestBody.to) ? requestBody.to : [requestBody.to];
      subject = requestBody.subject || '(No Subject)';
      text = requestBody.text || requestBody.body;
      html = requestBody.html || requestBody.bodyHtml;
      createdAt = requestBody.created_at || requestBody.date || new Date().toISOString();
    } else {
      console.error('📧 SUPPORT EMAIL WEBHOOK - Invalid request format');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request format' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log('📧 SUPPORT EMAIL WEBHOOK - Email data:', { from, to, subject });

    // Verify this is a support email (accept both root domain and subdomain)
    const supportEmails = ['support@moviedrafter.com', 'support@support.moviedrafter.com'];
    const isSupportEmail = to && supportEmails.some(email => to.includes(email));

    if (!isSupportEmail) {
      console.log('📧 SUPPORT EMAIL WEBHOOK - Email not addressed to support:', to);
      return new Response(
        JSON.stringify({ message: 'Not a support email' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const fromAddress = extractAddress(String(from));
    if (!EMAIL_PATTERN.test(fromAddress)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid sender email' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // --- Bot checks ---
    if (requestBody.source === 'contact-form') {
      // Hidden "website" field is invisible to people; bots fill it in
      if (typeof requestBody.website === 'string' && requestBody.website.trim() !== '') {
        return silentlyDrop('honeypot filled', fromAddress);
      }
      const elapsedMs = Number(requestBody.elapsed_ms);
      if (!Number.isFinite(elapsedMs) || elapsedMs < MIN_FORM_FILL_MS) {
        return silentlyDrop('form submitted too fast', { fromAddress, elapsedMs });
      }
    }

    if (looksLikeGibberish(String(subject))) {
      return silentlyDrop('gibberish subject', { fromAddress, subject });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('📧 SUPPORT EMAIL WEBHOOK - Missing Supabase configuration');
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const processedAt = new Date().toISOString();

    // --- Rate limits (per sender per day, and overall per hour) ---
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentEmails, error: recentError } = await supabase
      .from('support_emails')
      .select('from_email, processed_at')
      .gte('processed_at', oneDayAgo)
      .order('processed_at', { ascending: false })
      .limit(1000);

    if (recentError) {
      console.error('📧 SUPPORT EMAIL WEBHOOK - Rate limit lookup failed:', recentError);
    } else if (recentEmails) {
      const normalizedSender = normalizeAddress(fromAddress);
      const fromSameSender = recentEmails.filter(
        (row) => normalizeAddress(extractAddress(row.from_email)) === normalizedSender
      ).length;
      if (fromSameSender >= MAX_PER_SENDER_PER_DAY) {
        return silentlyDrop('per-sender daily limit', fromAddress);
      }
      const inLastHour = recentEmails.filter((row) => row.processed_at >= oneHourAgo).length;
      if (inLastHour >= MAX_TOTAL_PER_HOUR) {
        return silentlyDrop('global hourly limit', fromAddress);
      }
    }

    // Store email in database
    let emailId: string | null = null;
    try {
      const { data: emailRecord, error: dbError } = await supabase
        .from('support_emails')
        .insert({
          from_email: from,
          to_email: to,
          subject: subject,
          body_text: text || null,
          body_html: html || null,
          received_at: createdAt || processedAt,
          processed_at: processedAt,
        })
        .select('id')
        .single();

      if (dbError) {
        console.error('📧 SUPPORT EMAIL WEBHOOK - Database error:', dbError);
      } else {
        emailId = emailRecord?.id || null;
        console.log('📧 SUPPORT EMAIL WEBHOOK - Email stored in database:', emailId);
      }
    } catch (dbError) {
      console.error('📧 SUPPORT EMAIL WEBHOOK - Database exception:', dbError);
    }

    // Initialize Resend for forwarding.
    // No auto-reply is sent to the sender: anyone can type any address into the form,
    // so auto-replies let bots use our domain to email strangers.
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const forwardToEmail = Deno.env.get('SUPPORT_FORWARD_EMAIL');

    if (!resendApiKey) {
      console.warn('📧 SUPPORT EMAIL WEBHOOK - RESEND_API_KEY not found - skipping email operations');
    } else if (forwardToEmail) {
      const resend = new Resend(resendApiKey);

      // Everything submitted is untrusted, so it's rendered as escaped plain text
      const messageBody = text || (html ? stripTags(html) : '') || 'No content';
      const receivedAt = new Date(createdAt || processedAt).toLocaleString();
      const safeFrom = escapeHtml(fromAddress);

      try {
        const forwardResponse = await resend.emails.send({
          from: "Movie Drafter Support <noreply@moviedrafter.com>",
          to: [forwardToEmail],
          reply_to: fromAddress,
          subject: `[Support] ${subject} - From: ${fromAddress}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
                New Support Email Received
              </h2>

              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="font-size: 16px; margin-bottom: 10px;"><strong>From:</strong> ${safeFrom}</p>
                <p><strong>To:</strong> ${escapeHtml(to.join(', '))}</p>
                <p><strong>Subject:</strong> ${escapeHtml(String(subject))}</p>
                <p><strong>Received:</strong> ${escapeHtml(receivedAt)}</p>
              </div>

              <div style="margin: 20px 0;">
                <h3>Message:</h3>
                <pre style="white-space: pre-wrap; font-family: Arial, sans-serif; background: #f8f9fa; padding: 15px; border-radius: 8px;">${escapeHtml(messageBody)}</pre>
              </div>

              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">

              <p style="color: #999; font-size: 12px;">
                This is an automated forward from the Movie Drafter support email system.<br/>
                <strong>Reply to this email to respond directly to ${safeFrom}</strong>
              </p>
            </div>
          `,
          text: `
New Support Email Received

From: ${fromAddress}
To: ${to.join(', ')}
Subject: ${subject}
Received: ${receivedAt}

Message:
${messageBody}

---
This is an automated forward from the Movie Drafter support email system.
Reply to this email to respond directly to ${fromAddress}
          `,
        });

        if (forwardResponse.error) {
          console.error('📧 SUPPORT EMAIL WEBHOOK - Forward error:', forwardResponse.error);
        } else {
          console.log('📧 SUPPORT EMAIL WEBHOOK - Email forwarded successfully');

          // Update database record with forwarded email
          if (emailId) {
            await supabase
              .from('support_emails')
              .update({ forwarded_to: forwardToEmail })
              .eq('id', emailId);
          }
        }
      } catch (forwardError) {
        console.error('📧 SUPPORT EMAIL WEBHOOK - Forward exception:', forwardError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Support email processed successfully',
        emailId: emailId
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error("📧 SUPPORT EMAIL WEBHOOK - Critical error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal error'
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
