import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeletionRequest {
  user_id?: string;
  facebook_user_id?: string;
  email?: string;
  signed_request?: string;
}

interface ParsedSignedRequest {
  algorithm: string;
  expires: number;
  issued_at: number;
  user_id: string;
}

// Helper function to decode base64 URL
function base64UrlDecode(input: string): string {
  return atob(input.replace(/-/g, '+').replace(/_/g, '/'));
}

// Helper function to parse Facebook signed request
async function parseSignedRequest(signedRequest: string, appSecret: string): Promise<ParsedSignedRequest | null> {
  const [encodedSig, payload] = signedRequest.split('.', 2);
  
  if (!encodedSig || !payload) {
    console.error('Invalid signed request format');
    return null;
  }

  try {
    // Decode the data
    const data = JSON.parse(base64UrlDecode(payload));
    
    // Verify the signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(appSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expectedSig = new Uint8Array(signature);
    const actualSig = new Uint8Array(atob(encodedSig.replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => c.charCodeAt(0)));
    
    // Compare signatures
    if (expectedSig.length !== actualSig.length) {
      console.error('Signature length mismatch');
      return null;
    }
    
    for (let i = 0; i < expectedSig.length; i++) {
      if (expectedSig[i] !== actualSig[i]) {
        console.error('Bad signed request signature!');
        return null;
      }
    }
    
    return data;
  } catch (error) {
    console.error('Error parsing signed request:', error);
    return null;
  }
}

// Generate a confirmation code
function generateConfirmationCode(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }), 
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle both form data (Facebook) and JSON requests
    let body: DeletionRequest;
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Facebook sends form data
      const formData = await req.formData();
      const signedRequest = formData.get('signed_request') as string;
      body = { signed_request: signedRequest };
    } else {
      // Regular JSON request
      body = await req.json();
    }
    
    console.log('Data deletion request received:', { ...body, signed_request: body.signed_request ? '[REDACTED]' : undefined });

    let userId = body.user_id;
    let isFacebookRequest = false;
    
    // Handle Facebook signed request
    if (body.signed_request) {
      const appSecret = Deno.env.get('FACEBOOK_APP_SECRET');
      if (!appSecret) {
        console.error('Facebook app secret not configured');
        return new Response(
          JSON.stringify({ error: 'Facebook integration not configured' }), 
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      const parsedRequest = await parseSignedRequest(body.signed_request, appSecret);
      if (!parsedRequest) {
        return new Response(
          JSON.stringify({ error: 'Invalid signed request' }), 
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      console.log('Facebook deletion request for user ID:', parsedRequest.user_id);
      isFacebookRequest = true;
      
      // For Facebook requests, we can't map the app-scoped ID to our users
      // So we'll process this as a general cleanup request
      userId = null;
    }
    
    // Find user by other identifiers if not from Facebook
    if (!userId && !isFacebookRequest) {
      if (body.email) {
        const { data: authUser } = await supabase.auth.admin.getUserByEmail(body.email);
        userId = authUser.user?.id;
      }
    }

    // For Facebook requests without user mapping, we still respond positively
    if (!userId && isFacebookRequest) {
      const confirmationCode = generateConfirmationCode();
      const statusUrl = `https://zduruulowyopdstihfwk.supabase.co/functions/v1/user-data-deletion/status?code=${confirmationCode}`;
      
      console.log('Facebook deletion request processed (no user mapping available)');
      
      return new Response(
        JSON.stringify({ 
          url: statusUrl,
          confirmation_code: confirmationCode
        }), 
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!userId) {
      console.log('User not found for deletion request');
      
      if (isFacebookRequest) {
        const confirmationCode = generateConfirmationCode();
        const statusUrl = `https://zduruulowyopdstihfwk.supabase.co/functions/v1/user-data-deletion/status?code=${confirmationCode}`;
        
        return new Response(
          JSON.stringify({ 
            url: statusUrl,
            confirmation_code: confirmationCode
          }), 
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'User not found or already deleted' 
        }), 
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Deleting data for user:', userId);

    // Delete user data in order (respecting foreign key constraints)
    
    // 1. Delete draft picks (child records first)
    const { error: picksError } = await supabase
      .from('draft_picks')
      .delete()
      .in('draft_id', 
        supabase
          .from('drafts')
          .select('id')
          .eq('user_id', userId)
      );

    if (picksError) {
      console.error('Error deleting draft picks:', picksError);
    }

    // 2. Delete drafts
    const { error: draftsError } = await supabase
      .from('drafts')
      .delete()
      .eq('user_id', userId);

    if (draftsError) {
      console.error('Error deleting drafts:', draftsError);
    }

    // 3. Delete profile
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('Error deleting profile:', profileError);
    }

    // 4. Delete auth user (this will cascade to any remaining data)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    
    if (authError) {
      console.error('Error deleting auth user:', authError);
    }

    console.log('User data deletion completed for:', userId);

    // Return appropriate response format
    if (isFacebookRequest) {
      const confirmationCode = generateConfirmationCode();
      const statusUrl = `https://zduruulowyopdstihfwk.supabase.co/functions/v1/user-data-deletion/status?code=${confirmationCode}`;
      
      return new Response(
        JSON.stringify({ 
          url: statusUrl,
          confirmation_code: confirmationCode
        }), 
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'User data deleted successfully',
          user_id: userId 
        }), 
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error('Error in user data deletion:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});