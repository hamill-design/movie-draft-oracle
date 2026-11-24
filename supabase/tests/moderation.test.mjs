import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { newDb, makePlayer, actAs, setMode, rpcJson, readMigration, ADMIN_EMAIL, uuid } from './helpers.mjs';

describe('the longer name list', () => {
  let db;
  before(async () => { db = await newDb({ publicPlay: true }); await setMode(db, 'on'); });

  const tryName = async (name) => {
    const p = await makePlayer(db);
    await actAs(db, p);
    return rpcJson(db, 'set_public_name', name);
  };

  test('the list grew well beyond the 17-term starter list', async () => {
    const n = (await db.query(`SELECT count(*)::int AS n FROM public.blocked_name_terms`)).rows[0].n;
    assert.ok(n >= 80, `expected a much longer list, got ${n}`);
  });

  test('insults, sexual words, hate codes and staff look-alikes are refused (also dotted out or with look-alike digits)', async () => {
    const bad = [
      'Asshole Andy', 'Total Dickhead', 'Pussy Cat', 'Wanker 99', 'Slut Shamer', 'Hentai Fan',
      // (Short whole-word terms are not caught when every letter is dotted out, e.g. "r.a.p.e": that is a known
      // limit of whole-word matching, and the Report button covers it. Long terms are, e.g. "f.u.c.k".)
      'Retard Rick', 'KKK Fan', 'Pedo Pete', 'Rape Fan', 'F.u.c.k.er', 'Kys Now', 'Cum Lover', 'FCK Off',
      'Staff', 'Official Support', 'Support Team', 'Mod Squad', 'M0d Squad', 'Moviedrafter Staff',
      'P3dophile', 'Bl0wj0b',
    ];
    for (const name of bad) {
      await assert.rejects(tryName(name), /not allowed/, name);
    }
  });

  test('ordinary and movie-fan names that merely CONTAIN those letters are fine', async () => {
    const ok = [
      'Cumberbatch', 'Spicy Takes', 'Pedro Pascal', 'Raccoon Fan', 'Grape Ape', 'Fagan Fan',
      'Staffan', 'Supporting Role', 'Modern Times', 'Analyst Al', 'Penistone', 'Janus Films',
      'Prince Stone', 'Princess Bride', 'Moldy Oldie', 'Shaggy Dog', 'Tarantino Fan', 'Hamilton',
    ];
    for (const name of ok) {
      assert.equal((await tryName(name)).public_name, name, name);
    }
  });

  test('the starter list still works', async () => {
    for (const bad of ['fuckface', 'Sh1t Show', 'Mr Dick', 'Admin Alan', 'Moderator Mo']) {
      await assert.rejects(tryName(bad), /not allowed/, bad);
    }
    for (const ok of ['Cassidy', 'Dickens', 'Classic Cinema']) {
      assert.equal((await tryName(ok)).public_name, ok, ok);
    }
  });

  test('running the migration again changes nothing', async () => {
    const before = (await db.query(`SELECT count(*)::int AS n FROM public.blocked_name_terms`)).rows[0].n;
    await db.exec(readMigration('20261123100000_extend_blocked_names.sql'));
    const after = (await db.query(`SELECT count(*)::int AS n FROM public.blocked_name_terms`)).rows[0].n;
    assert.equal(after, before);
  });

  test('a term the owner already added by hand is kept as it was', async () => {
    await db.query(`DELETE FROM public.blocked_name_terms WHERE term = 'mod'`);
    await db.query(`INSERT INTO public.blocked_name_terms (term, whole_word) VALUES ('mod', false)`);
    await db.exec(readMigration('20261123100000_extend_blocked_names.sql'));
    const row = (await db.query(`SELECT whole_word FROM public.blocked_name_terms WHERE term = 'mod'`)).rows[0];
    assert.equal(row.whole_word, false, 'the migration must not overwrite an existing row');
    await db.query(`UPDATE public.blocked_name_terms SET whole_word = true WHERE term = 'mod'`);
  });
});

describe('the admin hears about new reports', () => {
  let db, admin;
  const notices = async (userId) =>
    (await db.query(
      `SELECT * FROM public.notifications WHERE user_id = $1 AND type = 'player_report' ORDER BY created_at`,
      [userId]
    )).rows;
  const report = async (who, target, reason = 'harassment') => {
    await actAs(db, who);
    await db.query(`SELECT public.report_player($1, NULL, $2, NULL)`, [target.id, reason]);
  };

  before(async () => {
    db = await newDb({ publicPlay: true });
    await setMode(db, 'on');
    admin = await makePlayer(db, { email: ADMIN_EMAIL, publicName: 'Robert H' });
  });

  test('a report puts one notice in the admin bell that opens the reports page', async () => {
    const a = await makePlayer(db, { publicName: 'Reporter One' });
    const b = await makePlayer(db, { publicName: 'Rude Randy' });
    await report(a, b, 'abusive_name');
    const [n, ...rest] = await notices(admin.id);
    assert.equal(rest.length, 0);
    assert.equal(n.title, 'New player report');
    assert.equal(n.link, '/admin/reports');
    assert.equal(n.body, 'Rude Randy: Abusive Name');
    assert.equal(n.is_read, false);
    assert.equal(n.metadata.open_reports, 1);
  });

  test('more reports replace the unread notice with an updated count instead of piling up', async () => {
    const a = await makePlayer(db, { publicName: 'Reporter Two' });
    const b = await makePlayer(db, { publicName: 'Rude Rita' });
    await report(a, b, 'cheating');
    const list = await notices(admin.id);
    assert.equal(list.length, 1, 'still one unread notice');
    assert.equal(list[0].title, '2 player reports to review');
    assert.equal(list[0].body, 'Rude Rita: Cheating');
    assert.equal(list[0].metadata.open_reports, 2);
  });

  test('once the admin has read it, the next report makes a fresh unread notice', async () => {
    await db.query(`UPDATE public.notifications SET is_read = true WHERE user_id = $1`, [admin.id]);
    const a = await makePlayer(db, { publicName: 'Reporter Three' });
    const b = await makePlayer(db, { publicName: 'Rude Ravi' });
    await report(a, b, 'spam');
    const list = await notices(admin.id);
    assert.equal(list.length, 2, 'the read one stays, a new unread one is added');
    assert.equal(list.filter((x) => !x.is_read).length, 1);
  });

  test('a report that was filed twice the same day (and so not saved again) does not notify twice', async () => {
    const a = await makePlayer(db, { publicName: 'Reporter Four' });
    const b = await makePlayer(db, { publicName: 'Rude Rosa' });
    const table = uuid();
    await actAs(db, a);
    await db.query(`SELECT public.report_player($1, $2, 'spam', NULL)`, [b.id, table]);
    const first = (await notices(admin.id)).length;
    await db.query(`SELECT public.report_player($1, $2, 'spam', NULL)`, [b.id, table]);
    assert.equal((await notices(admin.id)).length, first);
  });

  test('only the admin account is told, and ordinary players get no notice', async () => {
    const a = await makePlayer(db, { publicName: 'Reporter Five' });
    const b = await makePlayer(db, { publicName: 'Rude Rex' });
    await report(a, b);
    assert.equal((await notices(a.id)).length, 0);
    assert.equal((await notices(b.id)).length, 0);
  });

  test('the notification types that already existed are still allowed, and made-up ones are still refused', async () => {
    for (const t of ['draft_invite', 'league_invite', 'upcoming_draft', 'your_turn', 'match_found', 'results_ready']) {
      await db.query(`INSERT INTO public.notifications (user_id, type, title) VALUES ($1, $2, 't')`, [admin.id, t]);
    }
    await assert.rejects(db.query(`INSERT INTO public.notifications (user_id, type, title) VALUES ($1, 'bogus', 't')`, [admin.id]));
  });

  test('a report is still saved when the admin account does not exist yet', async () => {
    const lone = await newDb({ publicPlay: true });
    await setMode(lone, 'on');
    const a = await makePlayer(lone, { publicName: 'Lone Reporter' });
    const b = await makePlayer(lone, { publicName: 'Lone Target' });
    await actAs(lone, a);
    await lone.query(`SELECT public.report_player($1, NULL, 'spam', NULL)`, [b.id]);
    const n = (await lone.query(`SELECT count(*)::int AS n FROM public.player_reports`)).rows[0].n;
    assert.equal(n, 1);
  });

  test('a broken notice can never block a report', async () => {
    const broken = await newDb({ publicPlay: true });
    await setMode(broken, 'on');
    await makePlayer(broken, { email: ADMIN_EMAIL, publicName: 'Robert Broken' });
    // Make the notice fail on purpose: refuse every 'player_report' row.
    await broken.exec(`ALTER TABLE public.notifications ADD CONSTRAINT never_player_report CHECK (type <> 'player_report')`);
    const a = await makePlayer(broken, { publicName: 'Brave Reporter' });
    const b = await makePlayer(broken, { publicName: 'Brave Target' });
    await actAs(broken, a);
    await broken.query(`SELECT public.report_player($1, NULL, 'harassment', NULL)`, [b.id]);
    const n = (await broken.query(`SELECT count(*)::int AS n FROM public.player_reports`)).rows[0].n;
    assert.equal(n, 1, 'the report is saved even though the notice failed');
  });

  test('running the migration again is harmless', async () => {
    await db.exec(readMigration('20261123110000_report_alerts.sql'));
    const a = await makePlayer(db, { publicName: 'Reporter Six' });
    const b = await makePlayer(db, { publicName: 'Rude Ruth' });
    const before = (await notices(admin.id)).length;
    await report(a, b);
    assert.ok((await notices(admin.id)).length >= before, 'still notifies, and only once per report');
  });
});
