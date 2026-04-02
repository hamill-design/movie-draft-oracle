import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { Webhook } from 'npm:svix@1.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

interface ContactUpdatedPayload {
  type: string;
  created_at: string;
  data: {
    id: string;
    audience_id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    unsubscribed: boolean;
  };
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

  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET');
  const audienceId = Deno.env.get('RESEND_MARKETING_AUDIENCE_ID');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!secret || !audienceId || !supabaseUrl || !supabaseServiceKey) {
    console.error('resend-marketing-webhook: missing env');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response(JSON.stringify({ error: 'Missing webhook signatures' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const payload = await req.text();

  let evt: ContactUpdatedPayload;
  try {
    const wh = new Webhook(secret);
    evt = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ContactUpdatedPayload;
  } catch (e) {
    console.error('resend-marketing-webhook: verify failed', e);
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (evt.type !== 'contact.updated') {
    return new Response(JSON.stringify({ received: true, ignored: evt.type }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data } = evt;
  if (!data?.email || data.audience_id !== audienceId) {
    return new Response(JSON.stringify({ received: true, ignored: 'wrong_audience_or_email' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!data.unsubscribed) {
    return new Response(JSON.stringify({ received: true, ignored: 'not_unsubscribe' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey);
  const email = data.email.trim();

  const { data: rows, error: findError } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .limit(10);

  if (findError) {
    console.error('resend-marketing-webhook: profile lookup', findError);
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!rows?.length) {
    return new Response(JSON.stringify({ received: true, ignored: 'no_profile' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  for (const row of rows) {
    const { error: updError } = await admin
      .from('profiles')
      .update({
        marketing_emails_opt_in: false,
        marketing_emails_opt_in_at: null,
        marketing_emails_opt_out_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    if (updError) {
      console.error('resend-marketing-webhook: update profile', updError);
    }
  }

  return new Response(JSON.stringify({ received: true, updated: rows.length }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
