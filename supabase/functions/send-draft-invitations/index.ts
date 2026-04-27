// Optional: add a similar one-line P.S. in Supabase Dashboard → Authentication → Email Templates
// (confirm signup / reset password) pointing users to /profile to opt in to marketing email.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DraftInviteRequest {
  draftId: string;
  draftTitle: string;
  hostName: string;
  participantEmails: string[];
  theme: string;
  /** Stored draft option (e.g. spec UUID); use optionLabel for human-readable email copy. */
  option: string;
  /** When set (e.g. spec draft name), shown as "Category" in the email instead of option. */
  optionLabel?: string;
}

/** Strip path from Origin/Referer so join links and assets use the site root. */
function siteBaseUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "https://moviedrafter.com";
  try {
    const u = new URL(t.includes("://") ? t : `https://${t}`);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "https://moviedrafter.com";
  }
}

const RESEND_BATCH_SIZE = 100;
const RESEND_INTER_BATCH_DELAY_MS = 200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtmlAttr(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Readable theme line for email (DB uses slugs like spec-draft). */
function displayThemeForEmail(theme: string): string {
  switch (theme) {
    case "spec-draft":
      return "Special draft";
    case "people":
      return "Person";
    case "year":
      return "Year";
    default:
      return theme;
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function looksLikeUuid(s: string): boolean {
  return UUID_RE.test(String(s).trim());
}

function buildDraftInvitationHtml(params: {
  baseUrl: string;
  inviteLink: string;
  draftTitle: string;
  hostName: string;
  themeDisplay: string;
  optionDisplay: string;
  inviteCode: string | null;
  recipientEmail: string;
}): string {
  const {
    baseUrl,
    inviteLink,
    draftTitle,
    hostName,
    themeDisplay,
    optionDisplay,
    inviteCode,
    recipientEmail,
  } = params;
  const e = escapeHtml;
  const hrefInvite = escapeHtmlAttr(inviteLink);
  const codeRow =
    inviteCode != null && inviteCode !== ""
      ? `<p style="margin:0 0 12px 0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#9e9ca3;">
              <strong style="color:#fcffff;">Invite code:</strong> <span style="font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:0.04em;color:#d9e0df;">${e(inviteCode)}</span>
            </p>`
      : "";

  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#100029;opacity:0;">
  Join a Movie Drafter multiplayer draft — open this email for your personal link.
</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0;padding:0;background-color:#100029;background-image:linear-gradient(140deg,#100029 16%,#160038 50%,#100029 83%);">
  <tr>
    <td align="center" style="padding:40px 16px 0 16px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;border-collapse:separate;">
        <tr>
          <td align="center" style="padding:4px 32px;">
            <a href="${escapeHtmlAttr(baseUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
              <img src="${escapeHtmlAttr(baseUrl)}/wordmark-email.png" width="200" height="58" alt="Movie Drafter" border="0" style="display:block;margin:0 auto;width:200px;height:58px;max-width:100%;" />
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:32px 16px 0 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;margin:0 auto;border-collapse:separate;">
        <tr>
          <td style="background-color:#0e0e0f;border-radius:4px;padding:32px 28px 28px 28px;border:1px solid #49474b;box-shadow:0 0 6px rgba(59,3,148,0.35);">
            <p style="margin:0 0 8px 0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;line-height:1.4;letter-spacing:0.06em;text-transform:uppercase;color:#907aff;">
              Multiplayer draft
            </p>
            <h1 style="margin:0 0 16px 0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:600;line-height:1.3;letter-spacing:0.02em;color:#fcffff;">
              You're invited
            </h1>
            <p style="margin:0 0 20px 0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#bdc3c2;">
              <strong style="color:#fcffff;">${e(hostName)}</strong> invited you to join the draft <strong style="color:#fcffff;">"${e(draftTitle)}"</strong>.
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px 0;border-collapse:separate;">
              <tr>
                <td style="background-color:#161618;border:1px solid #2c2b2d;border-radius:4px;padding:18px 20px;">
                  <p style="margin:0 0 10px 0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#9e9ca3;">
                    Draft details
                  </p>
                  <p style="margin:0 0 8px 0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#bdc3c2;">
                    <strong style="color:#fcffff;">Theme:</strong> ${e(themeDisplay)}
                  </p>
                  <p style="margin:0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#bdc3c2;">
                    <strong style="color:#fcffff;">Category:</strong> ${e(optionDisplay)}
                  </p>
                </td>
              </tr>
            </table>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 24px auto;">
              <tr>
                <td align="center" bgcolor="#7142ff" style="border-radius:2px;mso-padding-alt:14px 28px;">
                  <a href="${hrefInvite}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;line-height:1.2;color:#fcffff;text-decoration:none;border-radius:2px;">
                    Join draft
                  </a>
                </td>
              </tr>
            </table>
            ${codeRow}
            <p style="margin:0 0 12px 0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#9e9ca3;">
              If the button does not work, copy and paste this link into your browser:
            </p>
            <p style="margin:0 0 24px 0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;word-break:break-all;">
              <a href="${hrefInvite}" target="_blank" rel="noopener noreferrer" style="color:#907aff;text-decoration:underline;">${e(inviteLink)}</a>
            </p>
            <p style="margin:0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#666469;border-top:1px solid #2c2b2d;padding-top:20px;">
              This invitation was sent to <strong style="color:#9e9ca3;">${e(recipientEmail)}</strong>. If you did not expect it, you can ignore this email.
              <br /><br />
              <strong>P.S.</strong> Want occasional product updates? Opt in anytime from your
              <a href="${escapeHtmlAttr(baseUrl)}/profile" style="color:#7142ff;text-decoration:none;font-weight:600;">profile settings</a>
              (account required).
              <br /><br />
              <a href="${escapeHtmlAttr(baseUrl)}" style="color:#7142ff;text-decoration:none;font-weight:600;">moviedrafter.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:28px 16px 48px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;margin:0 auto;border-collapse:collapse;">
        <tr>
          <td style="border-top:1px solid #7142ff;padding:0;line-height:0;font-size:0;">&nbsp;</td>
        </tr>
        <tr>
          <td align="center" style="padding:18px 12px 0 12px;">
            <a href="https://www.instagram.com/moviedrafter/" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-block;">
              <img src="https://moviedrafter.com/Instagram-Icon-white.png" width="28" height="28" alt="Follow Movie Drafter on Instagram" border="0" style="display:block;margin:0 auto 10px auto;width:28px;height:28px;" />
            </a>
            <a href="https://www.instagram.com/moviedrafter/" target="_blank" rel="noopener noreferrer" style="font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:500;line-height:20px;color:#d9e0df;text-decoration:underline;display:block;">
              Follow us on Instagram
            </a>
            <a href="https://www.instagram.com/moviedrafter/" target="_blank" rel="noopener noreferrer" style="font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#bdc3c2;text-decoration:underline;display:block;margin-top:4px;">
              @moviedrafter
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('📧 EDGE FUNCTION - Request received:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log('📧 EDGE FUNCTION - Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    console.log('📧 EDGE FUNCTION - Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('📧 EDGE FUNCTION - Missing authorization header');
      throw new Error('Missing authorization header');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    console.log('📧 EDGE FUNCTION - Supabase config:', { 
      hasUrl: !!supabaseUrl, 
      hasKey: !!supabaseKey 
    });

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('📧 EDGE FUNCTION - Failed to parse request body:', parseError);
      throw new Error('Invalid JSON request body');
    }

    const {
      draftId,
      draftTitle,
      hostName,
      participantEmails,
      theme,
      option,
      optionLabel,
    }: DraftInviteRequest = requestBody;

    const themeDisplay = displayThemeForEmail(theme);
    let optionDisplay = (optionLabel != null && String(optionLabel).trim() !== "")
      ? String(optionLabel).trim()
      : option;

    // Validate required fields
    if (!draftId || !draftTitle || !participantEmails || !Array.isArray(participantEmails)) {
      console.error('📧 EDGE FUNCTION - Missing required fields:', {
        hasDraftId: !!draftId,
        hasDraftTitle: !!draftTitle,
        hasEmails: !!participantEmails,
        isEmailsArray: Array.isArray(participantEmails)
      });
      throw new Error('Missing required fields in request');
    }

    // Spec drafts store `option` as spec_drafts.id; always show the template name in email.
    if (theme === "spec-draft" && option?.trim() && looksLikeUuid(option.trim())) {
      const clientSentReadableLabel =
        optionLabel != null &&
        String(optionLabel).trim() !== "" &&
        !looksLikeUuid(String(optionLabel).trim());
      if (!clientSentReadableLabel) {
        const { data: specRow, error: specErr } = await supabase
          .from("spec_drafts")
          .select("name")
          .eq("id", option.trim())
          .maybeSingle();
        if (specErr) {
          console.warn("📧 EDGE FUNCTION - spec_drafts lookup:", specErr.message);
        }
        if (specRow?.name) {
          optionDisplay = specRow.name;
        } else if (looksLikeUuid(String(optionDisplay).trim()) && draftTitle.trim()) {
          optionDisplay = draftTitle.trim();
        }
      }
    }

    console.log('📧 EDGE FUNCTION - Processing invitations:', { 
      draftId, 
      draftTitle,
      hostName,
      emailCount: participantEmails?.length,
      theme,
      option,
      optionLabel: optionLabel ?? null,
      optionDisplayForEmail: optionDisplay,
      emails: participantEmails
    });

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = participantEmails.filter(email => {
      const isValid = emailRegex.test(email);
      if (!isValid) {
        console.warn('📧 EDGE FUNCTION - Invalid email format:', email);
      }
      return isValid;
    });

    console.log('📧 EDGE FUNCTION - Email validation:', {
      total: participantEmails.length,
      valid: validEmails.length,
      invalid: participantEmails.length - validEmails.length
    });

    // Initialize Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    console.log('📧 EDGE FUNCTION - Resend API key status:', {
      hasKey: !!resendApiKey,
      keyLength: resendApiKey?.length || 0
    });
    
    if (!resendApiKey) {
      console.warn('📧 EDGE FUNCTION - RESEND_API_KEY not found - emails will be simulated');
    }

    const resend = resendApiKey ? new Resend(resendApiKey) : null;
    const originRaw =
      req.headers.get("origin") || req.headers.get("referer") ||
      "https://moviedrafter.com";
    const origin = siteBaseUrl(originRaw);
    console.log("📧 EDGE FUNCTION - Using site base URL:", origin);

    // Get draft invite code for fallback
    let inviteCode = null;
    try {
      const { data: draftData, error: draftError } = await supabase
        .from('drafts')
        .select('invite_code')
        .eq('id', draftId)
        .single();
      
      if (draftError) {
        console.error('📧 EDGE FUNCTION - Failed to get invite code:', draftError);
      } else {
        inviteCode = draftData.invite_code;
        console.log('📧 EDGE FUNCTION - Retrieved invite code:', inviteCode);
      }
    } catch (error) {
      console.error('📧 EDGE FUNCTION - Exception getting invite code:', error);
    }

    type InviteRow = {
      email: string;
      status: string;
      inviteLink: string;
      inviteCode: typeof inviteCode;
      error?: string;
      emailId?: string;
      reason?: string;
    };

    const invitationResults: InviteRow[] = [];

    if (resend && validEmails.length > 0) {
      for (let i = 0; i < validEmails.length; i += RESEND_BATCH_SIZE) {
        const chunk = validEmails.slice(i, i + RESEND_BATCH_SIZE);
        const payloads = chunk.map((email) => {
          const inviteLink = `${origin}/join-draft/${draftId}?email=${encodeURIComponent(email)}&auto=true`;
          return {
            from: "Movie Draft <noreply@moviedrafter.com>",
            to: [email],
            subject: `🎬 You're invited to join "${draftTitle}"`,
            html: buildDraftInvitationHtml({
              baseUrl: origin,
              inviteLink,
              draftTitle,
              hostName,
              themeDisplay,
              optionDisplay,
              inviteCode,
              recipientEmail: email,
            }),
          };
        });

        try {
          console.log('📧 EDGE FUNCTION - Batch send chunk', Math.floor(i / RESEND_BATCH_SIZE) + 1, 'size', chunk.length);
          const batchResponse = await resend.batch.send(payloads);

          if (batchResponse.error) {
            const errMsg =
              typeof batchResponse.error === 'object' &&
                batchResponse.error !== null &&
                'message' in batchResponse.error
                ? String((batchResponse.error as { message: string }).message)
                : 'Resend batch send failed';
            console.error('📧 EDGE FUNCTION - Resend batch error:', batchResponse.error);
            for (const email of chunk) {
              invitationResults.push({
                email,
                status: 'failed',
                error: errMsg,
                inviteLink: `${origin}/join-draft/${draftId}?email=${encodeURIComponent(email)}&auto=true`,
                inviteCode,
              });
            }
          } else {
            const raw = batchResponse.data as
              | { data?: Array<{ id?: string }> }
              | Array<{ id?: string }>
              | undefined;
            const ids = Array.isArray(raw) ? raw : raw?.data ?? [];
            chunk.forEach((email, idx) => {
              const inviteLink = `${origin}/join-draft/${draftId}?email=${encodeURIComponent(email)}&auto=true`;
              console.log('📧 EDGE FUNCTION - Email sent (batch) to:', email, 'ID:', ids[idx]?.id);
              invitationResults.push({
                email,
                status: 'sent',
                inviteLink,
                inviteCode,
                emailId: ids[idx]?.id,
              });
            });
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error('📧 EDGE FUNCTION - Batch send exception:', error);
          for (const email of chunk) {
            invitationResults.push({
              email,
              status: 'failed',
              error: errMsg,
              inviteLink: `${origin}/join-draft/${draftId}?email=${encodeURIComponent(email)}&auto=true`,
              inviteCode,
            });
          }
        }

        if (i + RESEND_BATCH_SIZE < validEmails.length) {
          await delay(RESEND_INTER_BATCH_DELAY_MS);
        }
      }
    } else {
      for (const email of validEmails) {
        const inviteLink = `${origin}/join-draft/${draftId}?email=${encodeURIComponent(email)}&auto=true`;
        console.log('📧 EDGE FUNCTION - Simulating email to:', email, 'with link:', inviteLink);
        invitationResults.push({
          email,
          status: 'simulated',
          inviteLink,
          inviteCode,
          reason: 'No RESEND_API_KEY configured',
        });
      }
    }

    // Include results for invalid emails too
    const invalidEmailResults = participantEmails
      .filter(email => !emailRegex.test(email))
      .map(email => ({
        email,
        status: 'failed',
        error: 'Invalid email format',
        inviteCode
      }));

    const allResults = [...invitationResults, ...invalidEmailResults];
    const successCount = allResults.filter(r => r.status === 'sent').length;
    const failedCount = allResults.filter(r => r.status === 'failed').length;
    const simulatedCount = allResults.filter(r => r.status === 'simulated').length;

    console.log('📧 EDGE FUNCTION - Final results:', {
      total: allResults.length,
      sent: successCount,
      failed: failedCount,
      simulated: simulatedCount,
      inviteCode
    });

    const response = { 
      success: true, 
      invitations: allResults,
      summary: {
        total: allResults.length,
        sent: successCount,
        failed: failedCount,
        simulated: simulatedCount
      },
      inviteCode,
      message: `Processed ${allResults.length} invitations: ${successCount} sent, ${simulatedCount} simulated, ${failedCount} failed`
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("📧 EDGE FUNCTION - Critical error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        details: error.stack?.split('\n')[0] || 'Unknown error location'
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);