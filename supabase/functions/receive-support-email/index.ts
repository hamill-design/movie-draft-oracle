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
    let fromEmail: string;
    let toEmails: string[];
    let subject: string;
    let text: string | undefined;
    let html: string | undefined;
    let createdAt: string;
    
    if (requestBody.type === 'email.received' && requestBody.data) {
      // Resend webhook format
      console.log('📧 SUPPORT EMAIL WEBHOOK - Resend webhook event received');
      const webhookEvent: ResendWebhookEvent = requestBody;
      
      if (webhookEvent.type !== 'email.received') {
        console.log('📧 SUPPORT EMAIL WEBHOOK - Ignoring event type:', webhookEvent.type);
        return new Response(
          JSON.stringify({ message: 'Event type not processed' }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      fromEmail = webhookEvent.data.from;
      toEmails = webhookEvent.data.to;
      subject = webhookEvent.data.subject;
      text = webhookEvent.data.text;
      html = webhookEvent.data.html;
      createdAt = webhookEvent.created_at;
    } else if (requestBody.from && requestBody.to) {
      // Direct POST format (from Google Apps Script or other services)
      console.log('📧 SUPPORT EMAIL WEBHOOK - Direct POST request received');
      fromEmail = requestBody.from;
      toEmails = Array.isArray(requestBody.to) ? requestBody.to : [requestBody.to];
      subject = requestBody.subject || '(No Subject)';
      text = requestBody.text || requestBody.body;
      html = requestBody.html || requestBody.bodyHtml;
      createdAt = requestBody.created_at || requestBody.date || new Date().toISOString();
    } else {
      console.error('📧 SUPPORT EMAIL WEBHOOK - Invalid request format:', requestBody);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request format' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log('📧 SUPPORT EMAIL WEBHOOK - Email data:', {
      from: fromEmail,
      to: toEmails,
      subject: subject,
    });

    const { from, to, subject: emailSubject, text: emailText, html: emailHtml } = {
      from: fromEmail,
      to: toEmails,
      subject: subject,
      text: text,
      html: html
    };

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
          body_text: emailText || null,
          body_html: emailHtml || null,
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
            reply_to: from,
            subject: `[Support] ${emailSubject} - From: ${from}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
                  New Support Email Received
                </h2>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="font-size: 16px; margin-bottom: 10px;"><strong>From:</strong> <a href="mailto:${from}" style="color: #007bff; text-decoration: none;">${from}</a></p>
                  <p><strong>To:</strong> ${to.join(', ')}</p>
                  <p><strong>Subject:</strong> ${emailSubject}</p>
                  <p><strong>Received:</strong> ${new Date(createdAt || processedAt).toLocaleString()}</p>
                </div>
                
                <div style="margin: 20px 0;">
                  <h3>Message:</h3>
                  ${emailHtml || `<pre style="white-space: pre-wrap; background: #f8f9fa; padding: 15px; border-radius: 8px;">${emailText || 'No content'}</pre>`}
                </div>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                
                <p style="color: #999; font-size: 12px;">
                  This is an automated forward from the Movie Drafter support email system.<br/>
                  <strong>Reply to this email to respond directly to ${from}</strong>
                </p>
              </div>
            `,
            text: `
New Support Email Received

From: ${from}
To: ${to.join(', ')}
Subject: ${emailSubject}
Received: ${new Date(createdAt || processedAt).toLocaleString()}

Message:
${emailText || 'No text content available'}

---
This is an automated forward from the Movie Drafter support email system.
Reply to this email to respond directly to ${from}
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
          subject: `Re: ${emailSubject}`,
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

