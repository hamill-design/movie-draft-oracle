// What a signed-in player could do with the browser's developer tools: write straight to the
// database tables. These tests run real statements AS the app's own database roles.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { newDb, makePlayer, actAs, setMode, rpcJson, uuid, inHours } from './helpers.mjs';

let n = 0;
const nm = (b) => `${b} ${++n}`;

describe('public table write guards', () => {
  let db;
  before(async () => {
    db = await newDb({ publicPlay: true });
    await setMode(db, 'on');
    // Give the app roles raw table access, like the live API has (row policies aside), so we
    // test the guards themselves and not "permission denied".
    await db.exec(`GRANT ALL ON public.drafts, public.draft_participants, public.draft_picks TO authenticated, anon, service_role`);
  });

  const mk = (b, x = {}) => makePlayer(db, { publicName: nm(b), ...x });
  const asRole = async (role, fn) => {
    await db.exec(`SET ROLE ${role}`);
    try { return await fn(); } finally { await db.exec('RESET ROLE'); }
  };

  async function publicTable(host, o = {}) {
    await actAs(db, host);
    const r = await rpcJson(db, 'create_public_table', 'Guarded', 'year', '1999', ['Comedy', 'Drama/Romance'], o.size ?? 4, o.clock ?? 3600, true, null);
    return r.draft_id;
  }
  async function privateDraft(owner) {
    const { rows: [d] } = await db.query(
      `INSERT INTO public.drafts (user_id, title, categories, is_multiplayer) VALUES ($1, 'Friends', ARRAY['Comedy'], true) RETURNING id`, [owner.id]);
    await db.query(`INSERT INTO public.draft_participants (draft_id, user_id, participant_name, is_host) VALUES ($1, $2, 'Owner', true)`, [d.id, owner.id]);
    return d.id;
  }

  describe('private drafts keep working exactly as before', () => {
    test('a player can create, edit and delete their own private draft, add participants and picks', async () => {
      const owner = await mk('Private Pat');
      const friend = await makePlayer(db, { name: 'Friend Fran' });
      await actAs(db, owner);
      await asRole('authenticated', async () => {
        const { rows: [d] } = await db.query(
          `INSERT INTO public.drafts (user_id, title, categories, is_multiplayer) VALUES ($1, 'Mine', ARRAY['Comedy'], true) RETURNING id`, [owner.id]);
        await db.query(`UPDATE public.drafts SET title = 'Renamed', pick_clock_seconds = 90, is_complete = true WHERE id = $1`, [d.id]);
        await db.query(`INSERT INTO public.draft_participants (draft_id, user_id, participant_name) VALUES ($1, $2, 'Friend')`, [d.id, friend.id]);
        await db.query(`UPDATE public.draft_participants SET is_host = true WHERE draft_id = $1 AND user_id = $2`, [d.id, friend.id]);
        await db.query(`INSERT INTO public.draft_picks (draft_id, player_id, player_name, movie_id, movie_title, category, pick_order) VALUES ($1, 1, 'Friend', 5001, 'x', 'Comedy', 1)`, [d.id]);
        await db.query(`UPDATE public.draft_picks SET movie_title = 'y' WHERE draft_id = $1`, [d.id]);
        await db.query(`DELETE FROM public.draft_picks WHERE draft_id = $1`, [d.id]);
        await db.query(`DELETE FROM public.drafts WHERE id = $1`, [d.id]);
      });
    });
  });

  describe('drafts', () => {
    test('a player cannot create a public, rated or "open" draft directly', async () => {
      const p = await mk('Direct Dan');
      await actAs(db, p);
      await asRole('authenticated', async () => {
        await assert.rejects(db.query(`INSERT INTO public.drafts (user_id, title, categories, lobby_visibility, match_source, referee_enabled, pick_clock_seconds) VALUES ($1, 'sneaky', ARRAY['Comedy'], 'public', 'open', true, 60)`, [p.id]), /created from the Play page/);
        await assert.rejects(db.query(`INSERT INTO public.drafts (user_id, title, categories, rated) VALUES ($1, 'sneaky', ARRAY['Comedy'], true)`, [p.id]), /created from the Play page/);
        await assert.rejects(db.query(`INSERT INTO public.drafts (user_id, title, categories, match_source) VALUES ($1, 'sneaky', ARRAY['Comedy'], 'quick')`, [p.id]), /created from the Play page/);
      });
    });

    test('a player cannot flip their private draft to public, rated, or quick', async () => {
      const p = await mk('Flipper Flo');
      const id = await privateDraft(p);
      await asRole('authenticated', async () => {
        await assert.rejects(db.query(`UPDATE public.drafts SET lobby_visibility = 'public' WHERE id = $1`, [id]), /Play page|drafts_public_needs_clock/);
        await assert.rejects(db.query(`UPDATE public.drafts SET rated = true WHERE id = $1`, [id]), /Play page/);
        await assert.rejects(db.query(`UPDATE public.drafts SET match_source = 'open' WHERE id = $1`, [id]), /Play page/);
      });
    });

    test('on a public table, the host cannot edit the clock, status, order, owner or settings', async () => {
      const host = await mk('Greedy Host');
      const id = await publicTable(host);
      await asRole('authenticated', async () => {
        for (const set of [
          `pick_clock_seconds = 86400`,
          `current_turn_deadline_at = now() + interval '9 days'`,
          `is_complete = true`,
          `current_pick_number = 99`,
          `categories = ARRAY['Wild Card']`,
          `title = 'Renamed'`,
          `table_size = 6`,
          `cancelled_at = now()`,
          `scheduled_start_at = now() + interval '1 day'`,
          `host_handoff_count = 5`,
          `referee_claim_until = now() + interval '1 hour'`,
          `user_id = '${uuid()}'`,
        ]) {
          await assert.rejects(db.query(`UPDATE public.drafts SET ${set} WHERE id = $1`, [id]), /run by the game/, set);
        }
      });
    });

    test('...but can still do the voting setup after the draft (the one thing left open)', async () => {
      const host = await mk('Voting Host');
      const id = await publicTable(host);
      await asRole('authenticated', async () => {
        await db.query(`UPDATE public.drafts SET allow_public_voting = true, is_public = true, voting_ends_at = now() + interval '1 hour', updated_at = now() WHERE id = $1`, [id]);
      });
    });

    test('a public table cannot be deleted by a player; cancelling it is the way', async () => {
      const host = await mk('Deleter Dee');
      const id = await publicTable(host);
      await asRole('authenticated', async () => {
        await assert.rejects(db.query(`DELETE FROM public.drafts WHERE id = $1`, [id]), /cannot be deleted/);
      });
      await actAs(db, host);
      await asRole('authenticated', async () => {
        await db.query(`SELECT public.cancel_public_table($1)`, [id]); // the game's own function still works
      });
    });
  });

  describe('participants', () => {
    test('a player cannot make themselves host, mark themselves ready, or remove another player', async () => {
      const host = await mk('Real Host');
      const id = await publicTable(host);
      const sneak = await mk('Sneaky Sid');
      await actAs(db, sneak);
      await rpcJson(db, 'join_public_table', id);

      await asRole('authenticated', async () => {
        await assert.rejects(db.query(`UPDATE public.draft_participants SET is_host = true WHERE draft_id = $1 AND user_id = $2`, [id, sneak.id]), /run by the game/);
        await assert.rejects(db.query(`UPDATE public.draft_participants SET ready_at = now() WHERE draft_id = $1 AND user_id = $2`, [id, sneak.id]), /run by the game/);
        await assert.rejects(db.query(`UPDATE public.draft_participants SET participant_name = 'Admin' WHERE draft_id = $1 AND user_id = $2`, [id, sneak.id]), /run by the game/);
        await assert.rejects(db.query(`DELETE FROM public.draft_participants WHERE draft_id = $1 AND user_id = $2`, [id, host.id]), /run by the game/);
      });
      const hosts = (await db.query(`SELECT user_id FROM public.draft_participants WHERE draft_id = $1 AND is_host`, [id])).rows;
      assert.deepEqual(hosts.map((h) => h.user_id), [host.id]);
    });

    test('a player cannot sit down with a direct insert', async () => {
      const host = await mk('Door Host');
      const id = await publicTable(host);
      const gatecrasher = await mk('Gate Crasher');
      await asRole('authenticated', async () => {
        await assert.rejects(
          db.query(`INSERT INTO public.draft_participants (draft_id, user_id, participant_name) VALUES ($1, $2, 'x')`, [id, gatecrasher.id]),
          /Play page/
        );
      });
    });

    test('the invite-code route cannot be used to bypass seat limits, blocks or bans', async () => {
      // The live invite-code functions are SECURITY DEFINER, so the role check alone would not stop them.
      // Simulate one: a definer function that inserts a participant the way they do.
      await db.exec(`
        CREATE OR REPLACE FUNCTION public.test_fake_invite_join(p_draft uuid, p_user uuid) RETURNS void
        LANGUAGE plpgsql SECURITY DEFINER AS $$
        BEGIN
          INSERT INTO public.draft_participants (draft_id, user_id, participant_name, status, joined_at)
          VALUES (p_draft, p_user, 'invite joiner', 'joined', now());
        END $$;`);
      const host = await mk('Code Host');
      const id = await publicTable(host, { size: 2 });
      await actAs(db, await mk('Code Friend'));
      const friend = await mk('Code Friend Two');
      await assert.rejects(db.query(`SELECT public.test_fake_invite_join($1, $2)`, [id, friend.id]), /Play page/);
      // but on a PRIVATE draft the same function works, as today
      const priv = await privateDraft(host);
      await db.query(`SELECT public.test_fake_invite_join($1, $2)`, [priv, friend.id]);
    });

    test('bots and the proper join door still work', async () => {
      const host = await mk('Proper Host');
      const id = await publicTable(host, { size: 3 });
      const j = await mk('Proper Joiner');
      await actAs(db, j);
      await asRole('authenticated', async () => {
        await db.query(`SELECT public.join_public_table($1)`, [id]);
      });
      await actAs(db, host);
      await asRole('authenticated', async () => {
        const out = (await db.query(`SELECT public.start_public_table($1, true) AS r`, [id])).rows[0].r;
        assert.equal(out.bots_added, 1);
      });
    });
  });

  describe('picks', () => {
    test('on a public table nobody can forge, edit or delete a pick by writing to the table', async () => {
      const host = await mk('Pick Host');
      const id = await publicTable(host, { size: 2 });
      await actAs(db, await mk('Pick Joiner'));
      await rpcJson(db, 'join_public_table', id);
      await actAs(db, host);
      await rpcJson(db, 'start_public_table', id, false);
      // the game makes a pick the proper way
      await db.query(`UPDATE public.drafts SET current_turn_deadline_at = clock_timestamp() - interval '1 second' WHERE id = $1`, [id]);
      const claim = (await db.query(`SELECT public.referee_claim_turn($1) AS r`, [id])).rows[0].r;
      await db.query(`SELECT public.referee_apply_pick($1, $2, 7001, 'Real Pick', 1999, 'Comedy', 'Comedy', NULL)`, [id, claim.pick_number]);

      await asRole('authenticated', async () => {
        await assert.rejects(db.query(`INSERT INTO public.draft_picks (draft_id, player_id, player_name, movie_id, movie_title, category, pick_order) VALUES ($1, 1, 'x', 7002, 'Forged', 'Comedy', 2)`, [id]), /pick buttons/);
        await assert.rejects(db.query(`UPDATE public.draft_picks SET movie_title = 'Edited', pick_source = 'player' WHERE draft_id = $1`, [id]), /pick buttons/);
        await assert.rejects(db.query(`DELETE FROM public.draft_picks WHERE draft_id = $1`, [id]), /pick buttons/);
      });
      assert.equal((await db.query(`SELECT count(*)::int AS c FROM public.draft_picks WHERE draft_id = $1`, [id])).rows[0].c, 1);
    });
  });

  describe('the server and the game itself are not blocked', () => {
    test('the service role (the server) can write to public tables', async () => {
      const host = await mk('Server Host');
      const id = await publicTable(host);
      await asRole('service_role', async () => {
        await db.query(`UPDATE public.drafts SET title = 'Server edit' WHERE id = $1`, [id]);
        await db.query(`UPDATE public.draft_participants SET last_seen_at = now() WHERE draft_id = $1`, [id]);
      });
    });

    test('a player can play a whole public table through the game\'s own functions, as the signed-in role', async () => {
      const host = await mk('Full Host');
      const guest = await mk('Full Guest');
      await actAs(db, host);
      let id;
      await asRole('authenticated', async () => {
        id = (await db.query(`SELECT public.create_public_table('Roles','year','1999',ARRAY['Comedy'],2,3600,true,NULL) AS r`)).rows[0].r.draft_id;
      });
      await actAs(db, guest);
      await asRole('authenticated', async () => { await db.query(`SELECT public.join_public_table($1)`, [id]); });
      await actAs(db, host);
      await asRole('authenticated', async () => {
        const r = (await db.query(`SELECT public.start_public_table($1, false) AS r`, [id])).rows[0].r;
        assert.equal(r.status, 'started');
      });
      const d = (await db.query(`SELECT turn_order FROM public.drafts WHERE id = $1`, [id])).rows[0];
      assert.equal(d.turn_order.length, 2);
    });
  });
});
