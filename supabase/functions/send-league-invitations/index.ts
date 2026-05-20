import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface LeagueInviteRequest {
  leagueId: string;
  leagueName: string;
  adminName: string;
  emails: string[];
}

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

function buildLeagueInviteHtml(params: {
  baseUrl: string;
  joinLink: string;
  leagueName: string;
  adminName: string;
  recipientEmail: string;
}): string {
  const { baseUrl, joinLink, leagueName, adminName, recipientEmail } = params;
  const e = escapeHtml;
  const hrefJoin = escapeHtmlAttr(joinLink);

  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#100029;opacity:0;">
  You've been invited to join a Movie Drafter league — open to accept.
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
              League invite
            </p>
            <h1 style="margin:0 0 16px 0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:600;line-height:1.3;letter-spacing:0.02em;color:#fcffff;">
              You're invited to join a league
            </h1>
            <p style="margin:0 0 20px 0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#bdc3c2;">
              <strong style="color:#fcffff;">${e(adminName)}</strong> invited you to join the league <strong style="color:#fcffff;">"${e(leagueName)}"</strong> on Movie Drafter.
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px 0;border-collapse:separate;">
              <tr>
                <td style="background-color:#161618;border:1px solid #2c2b2d;border-radius:4px;padding:18px 20px;">
                  <p style="margin:0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#bdc3c2;">
                    Compete with friends across multiple drafts. Track standings, compare picks, and see who comes out on top across the whole season.
                  </p>
                </td>
              </tr>
            </table>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 24px auto;">
              <tr>
                <td align="center" bgcolor="#7142ff" style="border-radius:2px;mso-padding-alt:14px 28px;">
                  <a href="${hrefJoin}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;line-height:1.2;color:#fcffff;text-decoration:none;border-radius:2px;">
                    Join league
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 12px 0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#9e9ca3;">
              If the button does not work, copy and paste this link into your browser:
            </p>
            <p style="margin:0 0 24px 0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;word-break:break-all;">
              <a href="${hrefJoin}" target="_blank" rel="noopener noreferrer" style="color:#907aff;text-decoration:underline;">${e(joinLink)}</a>
            </p>
            <p style="margin:0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#666469;border-top:1px solid #2c2b2d;padding-top:20px;">
              This invitation was sent to <strong style="color:#9e9ca3;">${e(recipientEmail)}</strong>. If you did not expect it, you can ignore this email. This link expires in 7 days.
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the calling user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { leagueId, leagueName, adminName, emails }: LeagueInviteRequest =
      await req.json();

    if (!leagueId || !leagueName || !emails?.length) {
      throw new Error("Missing required fields");
    }

    // Verify the caller is the league admin
    const { data: league, error: leagueError } = await supabase
      .from("leagues")
      .select("id, admin_id")
      .eq("id", leagueId)
      .single();

    if (leagueError || !league) throw new Error("League not found");
    if (league.admin_id !== user.id) throw new Error("Only the league admin can send invites");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = emails.filter((e) => emailRegex.test(e));

    const originRaw =
      req.headers.get("origin") ||
      req.headers.get("referer") ||
      "https://moviedrafter.com";
    const origin = siteBaseUrl(originRaw);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    const results: { email: string; status: string; error?: string }[] = [];

    for (const email of validEmails) {
      // Create or reuse invite record
      const { data: existing } = await supabase
        .from("league_invites")
        .select("id, token, status")
        .eq("league_id", leagueId)
        .eq("invited_email", email)
        .maybeSingle();

      let token: string;

      if (existing && existing.status === "pending") {
        token = existing.token;
      } else {
        const { data: newInvite, error: insertError } = await supabase
          .from("league_invites")
          .upsert(
            {
              league_id: leagueId,
              invited_by: user.id,
              invited_email: email,
              status: "pending",
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            },
            { onConflict: "league_id,invited_email" }
          )
          .select("token")
          .single();

        if (insertError || !newInvite) {
          results.push({ email, status: "failed", error: insertError?.message });
          continue;
        }
        token = newInvite.token;
      }

      const joinLink = `${origin}/league/join?token=${token}`;

      if (!resend) {
        results.push({ email, status: "simulated" });
        continue;
      }

      try {
        await resend.emails.send({
          from: "Movie Draft <noreply@moviedrafter.com>",
          to: [email],
          subject: `You're invited to join "${leagueName}" on Movie Drafter`,
          html: buildLeagueInviteHtml({
            baseUrl: origin,
            joinLink,
            leagueName,
            adminName,
            recipientEmail: email,
          }),
        });
        results.push({ email, status: "sent" });
      } catch (err) {
        results.push({
          email,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          sent: results.filter((r) => r.status === "sent").length,
          failed: results.filter((r) => r.status === "failed").length,
          simulated: results.filter((r) => r.status === "simulated").length,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
