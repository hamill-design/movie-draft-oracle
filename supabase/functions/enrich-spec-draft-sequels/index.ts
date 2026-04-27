// @ts-ignore Deno
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveIsSequelFromTmdbId } from '../_shared/sequelTmdb.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SEQUEL_CATEGORY = 'Sequel';

async function authorize(
  req: Request,
  body: Record<string, unknown>,
  supabaseUrl: string,
  anonKey: string
): Promise<{
  ok: boolean;
  useServiceRole: boolean;
  authHeader?: string;
  error?: string;
}> {
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (token && serviceRole && token === serviceRole) {
    return { ok: true, useServiceRole: true, authHeader };
  }
  const secret = typeof body.secret === 'string' ? body.secret : '';
  const expected = Deno.env.get('ENRICH_SEQUEL_SECRET');
  if (expected && secret && secret === expected) {
    return { ok: true, useServiceRole: true, authHeader };
  }
  if (token) {
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (!error && user) {
      return { ok: true, useServiceRole: false, authHeader };
    }
  }
  return { ok: false, useServiceRole: false, error: 'Unauthorized' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const tmdbKey = Deno.env.get('TMDB') ?? Deno.env.get('TMDB_API_KEY');

    if (!supabaseUrl || !serviceRole) {
      return new Response(JSON.stringify({ error: 'Missing Supabase config' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!tmdbKey) {
      return new Response(JSON.stringify({ error: 'Missing TMDB API key' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!anonKey) {
      return new Response(JSON.stringify({ error: 'Missing SUPABASE_ANON_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const auth = await authorize(req, body, supabaseUrl, anonKey);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = auth.useServiceRole
      ? createClient(supabaseUrl, serviceRole)
      : createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: auth.authHeader ?? '' } },
        });
    const force = body.force === true;
    const specDraftMovieId =
      typeof body.spec_draft_movie_id === 'string' ? body.spec_draft_movie_id : null;
    const specDraftId = typeof body.spec_draft_id === 'string' ? body.spec_draft_id : null;
    const limit = typeof body.limit === 'number' && body.limit > 0
      ? Math.min(body.limit, 100)
      : 25;

    const processOne = async (row: {
      id: string;
      movie_tmdb_id: number;
      sequel_enriched_at: string | null;
    }) => {
      if (!force && row.sequel_enriched_at != null) {
        return { id: row.id, skipped: true, reason: 'already_enriched' as const };
      }
      const { isSequel, ok, error } = await resolveIsSequelFromTmdbId(row.movie_tmdb_id, tmdbKey);
      if (!ok) {
        return { id: row.id, error: error || 'tmdb_failed' };
      }
      const now = new Date().toISOString();
      const { error: upErr } = await supabase
        .from('spec_draft_movies')
        .update({ is_sequel: isSequel, sequel_enriched_at: now })
        .eq('id', row.id);
      if (upErr) {
        return { id: row.id, error: upErr.message };
      }

      if (isSequel) {
        const { data: existing } = await supabase
          .from('spec_draft_movie_categories')
          .select('id')
          .eq('spec_draft_movie_id', row.id)
          .eq('category_name', SEQUEL_CATEGORY)
          .maybeSingle();
        if (!existing) {
          await supabase.from('spec_draft_movie_categories').insert({
            spec_draft_movie_id: row.id,
            category_name: SEQUEL_CATEGORY,
            is_automated: true,
          });
        }
      } else {
        await supabase
          .from('spec_draft_movie_categories')
          .delete()
          .eq('spec_draft_movie_id', row.id)
          .eq('category_name', SEQUEL_CATEGORY)
          .eq('is_automated', true);
      }

      return { id: row.id, isSequel, sequel_enriched_at: now };
    };

    if (specDraftMovieId) {
      const { data: row, error: fetchErr } = await supabase
        .from('spec_draft_movies')
        .select('id, movie_tmdb_id, sequel_enriched_at')
        .eq('id', specDraftMovieId)
        .single();
      if (fetchErr || !row) {
        return new Response(JSON.stringify({ error: 'spec_draft_movie not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const result = await processOne(row);
      return new Response(JSON.stringify({ results: [result] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let query = supabase
      .from('spec_draft_movies')
      .select('id, movie_tmdb_id, sequel_enriched_at')
      .is('sequel_enriched_at', null)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (specDraftId) {
      query = query.eq('spec_draft_id', specDraftId);
    }

    const { data: rows, error: listErr } = await query;
    if (listErr) {
      return new Response(JSON.stringify({ error: listErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: unknown[] = [];
    for (const row of rows || []) {
      results.push(await processOne(row as { id: string; movie_tmdb_id: number; sequel_enriched_at: string | null }));
    }

    return new Response(JSON.stringify({ results, processed: results.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
