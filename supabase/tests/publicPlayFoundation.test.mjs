import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { newDb, makePlayer, actAs, setMode, rpc, rpcJson, ADMIN_EMAIL, uuid } from './helpers.mjs';

describe('public play foundation (switch, names, blocks, reports, bans)', () => {
  let db;
  before(async () => { db = await newDb({ publicPlay: true }); });

  describe('the on/off switch (database-enforced)', () => {
    test('defaults to admin_only: a regular player is kept out, the admin is let in', async () => {
      await setMode(db, 'admin_only');
      const player = await makePlayer(db, { publicName: 'Plain Player' });
      const admin = await makePlayer(db, { email: ADMIN_EMAIL, publicName: 'Robert H' });

      await actAs(db, player);
      assert.equal((await rpcJson(db, 'public_play_status')).available, false);
      await assert.rejects(rpc(db, 'list_public_tables'), /not open yet/);

      await actAs(db, admin);
      const s = await rpcJson(db, 'public_play_status');
      assert.equal(s.available, true);
      assert.equal(s.is_admin, true);
      await rpc(db, 'list_public_tables'); // does not throw
    });

    test('"off" shuts everyone out, including the admin', async () => {
      await setMode(db, 'off');
      const admin = await makePlayer(db, { email: ADMIN_EMAIL, publicName: 'Robert H2' });
      await actAs(db, admin);
      assert.equal((await rpcJson(db, 'public_play_status')).available, false);
      await assert.rejects(rpc(db, 'list_public_tables'), /not open yet/);
    });

    test('"on" opens it to every signed-in player', async () => {
      await setMode(db, 'on');
      const player = await makePlayer(db, { publicName: 'Anyone Here' });
      await actAs(db, player);
      assert.equal((await rpcJson(db, 'public_play_status')).available, true);
      await rpc(db, 'list_public_tables');
    });

    test('signed-out visitors never get in, and can still ask for the status safely', async () => {
      await setMode(db, 'on');
      await actAs(db, null);
      const s = await rpcJson(db, 'public_play_status');
      assert.equal(s.signed_in, false);
      await assert.rejects(rpc(db, 'list_public_tables'), /Sign in/);
    });

    test('only the admin can change the switch', async () => {
      const player = await makePlayer(db, { publicName: 'Sneaky One' });
      await actAs(db, player);
      await assert.rejects(rpcJson(db, 'set_public_play_mode', 'on'), /Admins only/);
      const admin = await makePlayer(db, { email: ADMIN_EMAIL, publicName: 'Robert H3' });
      await actAs(db, admin);
      assert.equal(await rpcJson(db, 'set_public_play_mode', 'admin_only'), 'admin_only');
      await assert.rejects(rpcJson(db, 'set_public_play_mode', 'everyone'), /Mode must be/);
      await setMode(db, 'on');
    });

    test('the direct table is closed: players cannot read or write the switch', async () => {
      const player = await makePlayer(db, { publicName: 'Direct Dan' });
      await actAs(db, player);
      try {
        await db.exec('SET ROLE authenticated');
        await assert.rejects(db.query(`UPDATE public.public_play_settings SET mode = 'on'`), /permission denied|row-level/);
      } finally {
        await db.exec('RESET ROLE');
      }
    });
  });

  describe('public display names', () => {
    const tryName = async (who, name) => { await actAs(db, who); return rpcJson(db, 'set_public_name', name); };

    test('a good name is saved and shows in the status', async () => {
      const p = await makePlayer(db);
      assert.equal((await tryName(p, 'Film Fan 99')).public_name, 'Film Fan 99');
      const s = await rpcJson(db, 'public_play_status');
      assert.equal(s.has_public_name, true);
      assert.equal(s.public_name, 'Film Fan 99');
    });

    test('whitespace is tidied', async () => {
      const p = await makePlayer(db);
      assert.equal((await tryName(p, '  Spaced   Out  ')).public_name, 'Spaced Out');
    });

    test('too short, too long, and odd characters are refused', async () => {
      const p = await makePlayer(db);
      await assert.rejects(tryName(p, 'ab'), /3 to 20/);
      await assert.rejects(tryName(p, 'x'.repeat(21)), /3 to 20/);
      await assert.rejects(tryName(p, '<b>bold</b>'), /letters, numbers/);
      await assert.rejects(tryName(p, '-leading'), /letters, numbers/);
    });

    test('bad words are refused, including look-alike spellings and dotted-out ones', async () => {
      const p = await makePlayer(db);
      for (const bad of ['fuckface', 'Sh1t Show', 'f.u.c.k', 'B1TCH', 'A55 Man', 'Mr Dick']) {
        await assert.rejects(tryName(p, bad), /not allowed/, bad);
      }
    });

    test('ordinary names that merely CONTAIN short bad-word letters are fine', async () => {
      for (const ok of ['Cassidy', 'Dickens', 'Bassist', 'Tito', 'Hamilton', 'Classic Cinema']) {
        const p = await makePlayer(db);
        assert.equal((await tryName(p, ok)).public_name, ok, ok);
      }
    });

    test('staff-impersonating names are refused', async () => {
      const p = await makePlayer(db);
      await assert.rejects(tryName(p, 'Site Admin'), /not allowed/);
      await assert.rejects(tryName(p, 'Moderator Mike'), /not allowed/);
    });

    test('anything that looks like an email or a link is refused', async () => {
      const p = await makePlayer(db);
      // '@' is refused by the character rule; ".com" by the email/link rule. Either way: refused.
      await assert.rejects(tryName(p, 'me@site.com'), /letters, numbers|email address or a link/);
      await assert.rejects(tryName(p, 'cool.com'), /email address or a link/);
      await assert.rejects(tryName(p, 'https:fake'), /letters, numbers|email address or a link/);
    });

    test('a name can never be the start of the player\'s own email', async () => {
      const p = await makePlayer(db, { email: 'robert.hamill@example.test' });
      await assert.rejects(tryName(p, 'Robert Hamill'), /not your email/);
      await assert.rejects(tryName(p, 'robert_hamill'), /not your email/);
      assert.equal((await tryName(p, 'Robert Hm')).public_name, 'Robert Hm');
    });

    test('names are unique, ignoring capitals', async () => {
      const a = await makePlayer(db);
      const b = await makePlayer(db);
      await tryName(a, 'Only One');
      await assert.rejects(tryName(b, 'only one'), /already taken/);
    });

    test('a name can be changed once a day', async () => {
      const p = await makePlayer(db);
      await tryName(p, 'First Name');
      await assert.rejects(tryName(p, 'Second Name'), /once a day/);
      await db.query(`UPDATE public.profiles SET public_name_changed_at = now() - interval '2 days' WHERE id = $1`, [p.id]);
      assert.equal((await tryName(p, 'Second Name')).public_name, 'Second Name');
    });

    test('signed-out visitors cannot choose a name', async () => {
      await actAs(db, null);
      await assert.rejects(rpcJson(db, 'set_public_name', 'Ghost Writer'), /Sign in/);
    });

    test('get_public_profiles hands out ONLY name and avatar, and skips people with no public name', async () => {
      const named = await makePlayer(db, { name: 'Real Full Name', email: 'secret.person@example.test', publicName: 'Visible Vic' });
      const unnamed = await makePlayer(db, { name: 'Another Real Name' });
      await actAs(db, named);
      const rows = await rpc(db, 'get_public_profiles', [named.id, unnamed.id]);
      assert.equal(rows.length, 1);
      assert.deepEqual(Object.keys(rows[0]).sort(), ['avatar_url', 'public_name', 'user_id']);
      assert.equal(rows[0].public_name, 'Visible Vic');
      assert.ok(!JSON.stringify(rows).includes('secret.person'));
      assert.ok(!JSON.stringify(rows).includes('Real Full Name'));
    });
  });

  describe('blocking', () => {
    test('block, list, and unblock', async () => {
      const a = await makePlayer(db, { publicName: 'Blocker Bea' });
      const b = await makePlayer(db, { publicName: 'Blocked Bob' });
      await actAs(db, a);
      await db.query(`SELECT public.block_player($1)`, [b.id]);
      await db.query(`SELECT public.block_player($1)`, [b.id]); // doing it twice is harmless
      const mine = await rpc(db, 'my_blocks');
      assert.equal(mine.length, 1);
      assert.equal(mine[0].public_name, 'Blocked Bob');
      await db.query(`SELECT public.unblock_player($1)`, [b.id]);
      assert.equal((await rpc(db, 'my_blocks')).length, 0);
    });

    test('you cannot block yourself, and you only see your own blocks', async () => {
      const a = await makePlayer(db, { publicName: 'Self Sam' });
      const b = await makePlayer(db, { publicName: 'Other Olly' });
      const c = await makePlayer(db, { publicName: 'Third Thea' });
      await actAs(db, a);
      await assert.rejects(db.query(`SELECT public.block_player($1)`, [a.id]), /cannot block yourself/);
      await db.query(`SELECT public.block_player($1)`, [b.id]);
      await actAs(db, c);
      assert.equal((await rpc(db, 'my_blocks')).length, 0);
    });

    test('a block works in both directions', async () => {
      const a = await makePlayer(db, { publicName: 'Dir Dee' });
      const b = await makePlayer(db, { publicName: 'Dir Dom' });
      await actAs(db, a);
      await db.query(`SELECT public.block_player($1)`, [b.id]);
      const ab = (await db.query(`SELECT public._blocked_between($1, $2) AS r`, [a.id, b.id])).rows[0].r;
      const ba = (await db.query(`SELECT public._blocked_between($1, $2) AS r`, [b.id, a.id])).rows[0].r;
      assert.equal(ab, true);
      assert.equal(ba, true);
    });
  });

  describe('reporting and banning', () => {
    test('a report needs a real reason, and not against yourself', async () => {
      const a = await makePlayer(db, { publicName: 'Rep Rita' });
      const b = await makePlayer(db, { publicName: 'Rep Rob' });
      await actAs(db, a);
      await assert.rejects(db.query(`SELECT public.report_player($1, NULL, 'harassment', NULL)`, [a.id]), /cannot report yourself/);
      await assert.rejects(db.query(`SELECT public.report_player($1, NULL, 'because', NULL)`, [b.id]), /Choose a reason/);
      await db.query(`SELECT public.report_player($1, NULL, 'harassment', 'rude in the lobby')`, [b.id]);
      const n = (await db.query(`SELECT count(*)::int AS n FROM public.player_reports WHERE reported_id = $1`, [b.id])).rows[0].n;
      assert.equal(n, 1);
    });

    test('reporting the same person at the same table twice in a day is recorded once', async () => {
      const a = await makePlayer(db, { publicName: 'Dup Dina' });
      const b = await makePlayer(db, { publicName: 'Dup Dave' });
      const table = uuid();
      await actAs(db, a);
      await db.query(`SELECT public.report_player($1, $2, 'spam', NULL)`, [b.id, table]);
      await db.query(`SELECT public.report_player($1, $2, 'spam', NULL)`, [b.id, table]);
      const n = (await db.query(`SELECT count(*)::int AS n FROM public.player_reports WHERE reporter_id = $1`, [a.id])).rows[0].n;
      assert.equal(n, 1);
    });

    test('there is a daily cap on reports so the queue cannot be flooded', async () => {
      const a = await makePlayer(db, { publicName: 'Flood Fay' });
      await actAs(db, a);
      for (let i = 0; i < 10; i++) {
        const target = await makePlayer(db, { publicName: `Target Number ${i}` });
        await actAs(db, a);
        await db.query(`SELECT public.report_player($1, NULL, 'spam', NULL)`, [target.id]);
      }
      const extra = await makePlayer(db, { publicName: 'Target Eleven' });
      await actAs(db, a);
      await assert.rejects(db.query(`SELECT public.report_player($1, NULL, 'spam', NULL)`, [extra.id]), /lot of reports/);
    });

    test('players cannot read the reports table, and only the admin can use the review tools', async () => {
      const a = await makePlayer(db, { publicName: 'Snoop Sid' });
      await actAs(db, a);
      await assert.rejects(rpc(db, 'admin_list_reports'), /Admins only/);
      await assert.rejects(db.query(`SELECT public.admin_unban($1)`, [a.id]), /Admins only/);
      try {
        await db.exec('SET ROLE authenticated');
        await assert.rejects(db.query(`SELECT * FROM public.player_reports`), /permission denied|row-level/);
      } finally {
        await db.exec('RESET ROLE');
      }
    });

    test('the admin sees reports with names, and a ban stops the player at the door', async () => {
      await setMode(db, 'on');
      const reporter = await makePlayer(db, { publicName: 'Good Citizen' });
      const villain = await makePlayer(db, { publicName: 'Bad Actor' });
      const admin = await makePlayer(db, { email: ADMIN_EMAIL, publicName: 'Robert Admin' });

      await actAs(db, reporter);
      await db.query(`SELECT public.report_player($1, NULL, 'harassment', 'spamming people')`, [villain.id]);

      await actAs(db, admin);
      const [report] = await rpc(db, 'admin_list_reports', 'open', 10);
      assert.equal(report.reporter_name, 'Good Citizen');
      assert.equal(report.reported_name, 'Bad Actor');
      assert.equal(report.reason, 'harassment');
      assert.equal(Number(report.reports_against_total), 1);

      await db.query(`SELECT public.admin_resolve_report($1, 'banned', 7)`, [report.id]);
      const stillOpen = (await rpc(db, 'admin_list_reports', 'open', 200)).map((r) => r.id);
      assert.ok(!stillOpen.includes(report.id), 'a resolved report leaves the open list');
      const banned = (await rpc(db, 'admin_list_reports', 'banned', 200)).map((r) => r.id);
      assert.ok(banned.includes(report.id));

      await actAs(db, villain);
      const s = await rpcJson(db, 'public_play_status');
      assert.equal(s.banned, true);
      await assert.rejects(
        rpcJson(db, 'create_public_table', 'Banned try', 'year', '1999', ['Comedy'], 4, 60, true, null),
        /suspended/
      );

      await actAs(db, admin);
      await db.query(`SELECT public.admin_unban($1)`, [villain.id]);
      await actAs(db, villain);
      assert.equal((await rpcJson(db, 'public_play_status')).banned, false);
    });

    test('a temporary ban ends on its own', async () => {
      await setMode(db, 'on');
      const p = await makePlayer(db, { publicName: 'Timed Out Tim' });
      await db.query(`UPDATE public.profiles SET is_banned = true, banned_until = now() - interval '1 hour' WHERE id = $1`, [p.id]);
      await actAs(db, p);
      assert.equal((await rpcJson(db, 'public_play_status')).banned, false);
      await rpc(db, 'list_public_tables');
    });

    test('a dismissed report does not ban anybody', async () => {
      const reporter = await makePlayer(db, { publicName: 'Whistle Wes' });
      const accused = await makePlayer(db, { publicName: 'Falsely Fred' });
      const admin = await makePlayer(db, { email: ADMIN_EMAIL, publicName: 'Robert Admin 2' });
      await actAs(db, reporter);
      await db.query(`SELECT public.report_player($1, NULL, 'other', NULL)`, [accused.id]);
      await actAs(db, admin);
      const [r] = await rpc(db, 'admin_list_reports', 'open', 1); // newest first: ours
      assert.equal(r.reported_id, accused.id);
      await db.query(`SELECT public.admin_resolve_report($1, 'dismissed', NULL)`, [r.id]);
      const banned = (await db.query(`SELECT is_banned FROM public.profiles WHERE id = $1`, [accused.id])).rows[0].is_banned;
      assert.equal(banned, false);
    });
  });

  describe('notifications', () => {
    test('the new notification types are accepted, and an unknown one is swallowed without breaking the caller', async () => {
      const p = await makePlayer(db);
      for (const t of ['your_turn', 'table_starts_soon', 'time_to_start', 'schedule_changed', 'you_are_host', 'table_cancelled', 'removed_from_table', 'match_found']) {
        await db.query(`SELECT public._notify($1, $2, 't', 'b', '/x', NULL, '{}'::jsonb)`, [p.id, t]);
      }
      await db.query(`SELECT public._notify($1, 'not_a_real_type', 't', 'b', '/x', NULL, '{}'::jsonb)`, [p.id]);
      const n = (await db.query(`SELECT count(*)::int AS n FROM public.notifications WHERE user_id = $1`, [p.id])).rows[0].n;
      assert.equal(n, 8);
    });
  });

  describe('permissions', () => {
    test('internal helpers cannot be called by ordinary users', async () => {
      const p = await makePlayer(db, { publicName: 'Curious Cat' });
      await actAs(db, p);
      try {
        await db.exec('SET ROLE authenticated');
        await assert.rejects(db.query(`SELECT public._notify($1, 'your_turn', 't', 'b', '/x', NULL)`, [p.id]), /permission denied/);
        await assert.rejects(db.query(`SELECT public._blocked_between($1, $1)`, [p.id]), /permission denied/);
        await assert.rejects(db.query(`SELECT public._assert_public_play(true)`), /permission denied/);
      } finally {
        await db.exec('RESET ROLE');
      }
    });
  });
});
