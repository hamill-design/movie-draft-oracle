import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeletionRequest {
  user_id?: string;
  facebook_user_id?: string;
  email?: string;
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

    const body: DeletionRequest = await req.json();
    console.log('Data deletion request received:', body);

    // Find user by various identifiers
    let userId = body.user_id;
    
    if (!userId && body.email) {
      const { data: authUser } = await supabase.auth.admin.getUserByEmail(body.email);
      userId = authUser.user?.id;
    }

    if (!userId) {
      console.log('User not found for deletion request');
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