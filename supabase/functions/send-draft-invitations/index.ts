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
  option: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { draftId, draftTitle, hostName, participantEmails, theme, option }: DraftInviteRequest = await req.json();

    console.log('Sending draft invitations:', { draftId, participantEmails: participantEmails.length });

    // Initialize Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.warn('RESEND_API_KEY not found - emails will not be sent');
    }

    const resend = resendApiKey ? new Resend(resendApiKey) : null;
    const origin = req.headers.get('origin') || 'https://your-app-domain.com';

    // Send emails to each participant
    const invitationResults = await Promise.all(
      participantEmails.map(async (email) => {
        const inviteLink = `${origin}/join-draft/${draftId}?email=${encodeURIComponent(email)}`;
        
        try {
          if (resend) {
            const emailResponse = await resend.emails.send({
              from: "Movie Draft <noreply@resend.dev>",
              to: [email],
              subject: `🎬 You're invited to join "${draftTitle}"`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
                    🎬 Movie Draft Invitation
                  </h1>
                  
                  <p>Hi there!</p>
                  
                  <p><strong>${hostName}</strong> has invited you to join their movie draft: <strong>"${draftTitle}"</strong></p>
                  
                  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #007bff;">Draft Details</h3>
                    <p><strong>Theme:</strong> ${theme}</p>
                    <p><strong>Category:</strong> ${option}</p>
                  </div>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${inviteLink}" 
                       style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                      Join Draft Session
                    </a>
                  </div>
                  
                  <p style="color: #666; font-size: 14px;">
                    If the button doesn't work, copy and paste this link into your browser:<br>
                    <a href="${inviteLink}">${inviteLink}</a>
                  </p>
                  
                  <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                  
                  <p style="color: #999; font-size: 12px;">
                    This invitation was sent to ${email}. If you didn't expect this invitation, you can safely ignore this email.
                  </p>
                </div>
              `,
            });

            if (emailResponse.error) {
              console.error(`Failed to send email to ${email}:`, emailResponse.error);
              return { email, status: 'failed', error: emailResponse.error.message, inviteLink };
            }

            return { email, status: 'sent', inviteLink, emailId: emailResponse.data?.id };
          } else {
            console.log(`Would send email to ${email} with link: ${inviteLink}`);
            return { email, status: 'simulated', inviteLink };
          }
        } catch (error) {
          console.error(`Error sending email to ${email}:`, error);
          return { email, status: 'failed', error: error.message, inviteLink };
        }
      })
    );

    return new Response(JSON.stringify({ 
      success: true, 
      invitations: invitationResults,
      message: `Invitations sent to ${participantEmails.length} participants` 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-draft-invitations function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);