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

    const { draftId, draftTitle, hostName, participantEmails, theme, option }: DraftInviteRequest = requestBody;

    console.log('📧 EDGE FUNCTION - Processing invitations:', { 
      draftId, 
      draftTitle,
      hostName,
      emailCount: participantEmails?.length,
      theme,
      option,
      emails: participantEmails
    });

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
    const origin = req.headers.get('origin') || req.headers.get('referer') || 'https://movie-draft-app.lovable.app';
    console.log('📧 EDGE FUNCTION - Using origin:', origin);

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

    // Send emails to each valid participant
    const invitationResults = await Promise.all(
      validEmails.map(async (email) => {
        const inviteLink = `${origin}/join-draft?code=${inviteCode}&email=${encodeURIComponent(email)}`;
        
        console.log('📧 EDGE FUNCTION - Processing email for:', email);
        
        try {
          if (resend) {
            console.log('📧 EDGE FUNCTION - Sending real email to:', email);
            
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
                    <strong>Invite Code:</strong> ${inviteCode}<br>
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
              console.error('📧 EDGE FUNCTION - Resend error for', email, ':', emailResponse.error);
              return { 
                email, 
                status: 'failed', 
                error: emailResponse.error.message, 
                inviteLink,
                inviteCode 
              };
            }

            console.log('📧 EDGE FUNCTION - Email sent successfully to:', email, 'ID:', emailResponse.data?.id);
            return { 
              email, 
              status: 'sent', 
              inviteLink, 
              inviteCode,
              emailId: emailResponse.data?.id 
            };
          } else {
            console.log('📧 EDGE FUNCTION - Simulating email to:', email, 'with link:', inviteLink);
            return { 
              email, 
              status: 'simulated', 
              inviteLink,
              inviteCode,
              reason: 'No RESEND_API_KEY configured'
            };
          }
        } catch (error) {
          console.error('📧 EDGE FUNCTION - Exception sending email to:', email, ':', error);
          return { 
            email, 
            status: 'failed', 
            error: error.message, 
            inviteLink,
            inviteCode
          };
        }
      })
    );

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