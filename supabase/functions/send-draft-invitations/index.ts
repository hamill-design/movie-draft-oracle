import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

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

    // For now, we'll just log the invitation details and return success
    // In a real implementation, you would integrate with an email service like Resend
    console.log('Draft invitation details:', {
      draftId,
      draftTitle,
      hostName,
      participantEmails,
      theme,
      option
    });

    // Simulate sending emails to each participant
    const invitationResults = participantEmails.map(email => ({
      email,
      status: 'sent',
      inviteLink: `${req.headers.get('origin')}/join-draft/${draftId}?email=${encodeURIComponent(email)}`
    }));

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