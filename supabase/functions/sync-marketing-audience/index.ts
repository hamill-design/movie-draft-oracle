import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API = 'https://api.resend.com';

function splitName(full: string | null | undefined): { first_name: string; last_name: string } {
  const t = (full || '').trim();
  if (!t) return { first_name: '', last_name: '' };
  const parts = t.split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

async function resendJson(
  apiKey: string,
  path: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${RESEND_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const audienceId = Deno.env.get('RESEND_MARKETING_AUDIENCE_ID');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user?.email) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!resendApiKey || !audienceId) {
    console.warn('sync-marketing-audience: RESEND_API_KEY or RESEND_MARKETING_AUDIENCE_ID not set');
    return new Response(
      JSON.stringify({ success: true, skipped: true, reason: 'resend_not_configured' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('marketing_emails_opt_in, name')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('sync-marketing-audience profile error:', profileError);
    return new Response(JSON.stringify({ error: 'Failed to read profile' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const email = user.email;
  const encodedEmail = encodeURIComponent(email);

  const removeContact = async () => {
    const del = await resendJson(resendApiKey, `/contacts/${encodedEmail}`, { method: 'DELETE' });
    if (!del.ok && del.status !== 404) {
      console.warn('sync-marketing-audience: delete contact', del.status, del.data);
    }
    return del;
  };

  if (!profile?.marketing_emails_opt_in) {
    await removeContact();
    return new Response(
      JSON.stringify({ success: true, action: 'removed_or_absent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (!user.email_confirmed_at) {
    return new Response(
      JSON.stringify({ success: true, skipped: true, reason: 'email_not_confirmed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const { first_name, last_name } = splitName(profile.name);

  const createBody = {
    audience_id: audienceId,
    email,
    first_name: first_name || undefined,
    last_name: last_name || undefined,
    unsubscribed: false,
  };

  let post = await resendJson(resendApiKey, '/contacts', {
    method: 'POST',
    body: JSON.stringify(createBody),
  });

  if (!post.ok) {
    const errObj = post.data as { message?: string; name?: string } | null;
    const msg = (errObj?.message || '').toLowerCase();
    const isDuplicate = post.status === 409 || post.status === 422 || msg.includes('already') || msg.includes('exist');

    if (isDuplicate) {
      const patch = await resendJson(resendApiKey, `/contacts/${encodedEmail}`, {
        method: 'PATCH',
        body: JSON.stringify({
          first_name: first_name || undefined,
          last_name: last_name || undefined,
          unsubscribed: false,
        }),
      });
      if (!patch.ok) {
        console.error('sync-marketing-audience: patch contact failed', patch.status, patch.data);
        return new Response(
          JSON.stringify({ error: 'Failed to update marketing contact', details: patch.data }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({ success: true, action: 'updated' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.error('sync-marketing-audience: create contact failed', post.status, post.data);
    return new Response(
      JSON.stringify({ error: 'Failed to create marketing contact', details: post.data }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({ success: true, action: 'created' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
