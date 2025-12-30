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

const handler = async (req: Request): Promise<Response> => {
  console.log('📧 SUPPORT EMAIL WEBHOOK - Request received:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log('📧 SUPPORT EMAIL WEBHOOK - Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse the webhook payload from Resend
    let webhookEvent: ResendWebhookEvent;
    try {
      webhookEvent = await req.json();
    } catch (parseError) {
      console.error('📧 SUPPORT EMAIL WEBHOOK - Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON request body' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    console.log('📧 SUPPORT EMAIL WEBHOOK - Event type:', webhookEvent.type);
    console.log('📧 SUPPORT EMAIL WEBHOOK - Email data:', {
      from: webhookEvent.data?.from,
      to: webhookEvent.data?.to,
      subject: webhookEvent.data?.subject,
    });

    // Only process email.received events
    if (webhookEvent.type !== 'email.received') {
      console.log('📧 SUPPORT EMAIL WEBHOOK - Ignoring event type:', webhookEvent.type);
      return new Response(
        JSON.stringify({ message: 'Event type not processed' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { from, to, subject, text, html } = webhookEvent.data;

    // Verify this is a support email
    const supportEmail = 'support@moviedrafter.com';
    if (!to || !to.includes(supportEmail)) {
      console.log('📧 SUPPORT EMAIL WEBHOOK - Email not addressed to support:', to);
      return new Response(
        JSON.stringify({ message: 'Not a support email' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
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
          received_at: webhookEvent.created_at || processedAt,
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

    // Initialize Resend for forwarding and auto-reply
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const forwardToEmail = Deno.env.get('SUPPORT_FORWARD_EMAIL');
    
    if (!resendApiKey) {
      console.warn('📧 SUPPORT EMAIL WEBHOOK - RESEND_API_KEY not found - skipping email operations');
    } else {
      const resend = new Resend(resendApiKey);

      // Forward email to personal email
      if (forwardToEmail) {
        try {
          const forwardResponse = await resend.emails.send({
            from: "Movie Drafter Support <noreply@moviedrafter.com>",
            to: [forwardToEmail],
            subject: `[Support] ${subject}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
                  New Support Email Received
                </h2>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p><strong>From:</strong> ${from}</p>
                  <p><strong>To:</strong> ${to.join(', ')}</p>
                  <p><strong>Subject:</strong> ${subject}</p>
                  <p><strong>Received:</strong> ${new Date(webhookEvent.created_at || processedAt).toLocaleString()}</p>
                </div>
                
                <div style="margin: 20px 0;">
                  <h3>Message:</h3>
                  ${html || `<pre style="white-space: pre-wrap; background: #f8f9fa; padding: 15px; border-radius: 8px;">${text || 'No content'}</pre>`}
                </div>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                
                <p style="color: #999; font-size: 12px;">
                  This is an automated forward from the Movie Drafter support email system.
                </p>
              </div>
            `,
            text: `
New Support Email Received

From: ${from}
To: ${to.join(', ')}
Subject: ${subject}
Received: ${new Date(webhookEvent.created_at || processedAt).toLocaleString()}

Message:
${text || 'No text content available'}
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

      // Send auto-reply to the sender
      try {
        const autoReplyResponse = await resend.emails.send({
          from: "Movie Drafter Support <support@moviedrafter.com>",
          to: [from],
          subject: `Re: ${subject}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <p>Thank you for contacting Movie Drafter support!</p>
              
              <p>We've received your message and will get back to you as soon as possible.</p>
              
              <p>Best regards,<br>The Movie Drafter Team</p>
            </div>
          `,
          text: `Thank you for contacting Movie Drafter support!\n\nWe've received your message and will get back to you as soon as possible.\n\nBest regards,\nThe Movie Drafter Team`,
        });

        if (autoReplyResponse.error) {
          console.error('📧 SUPPORT EMAIL WEBHOOK - Auto-reply error:', autoReplyResponse.error);
        } else {
          console.log('📧 SUPPORT EMAIL WEBHOOK - Auto-reply sent successfully');
          
          // Update database record with auto-reply status
          if (emailId) {
            await supabase
              .from('support_emails')
              .update({ auto_replied: true })
              .eq('id', emailId);
          }
        }
      } catch (autoReplyError) {
        console.error('📧 SUPPORT EMAIL WEBHOOK - Auto-reply exception:', autoReplyError);
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

