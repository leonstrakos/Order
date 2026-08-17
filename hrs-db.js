let Pool;
try {
  ({ Pool } = require('pg'));
} catch (error) {
  console.warn('[HRS] pg package is not installed. Dynamic bell database pages will use empty-state fallbacks.');
}

const connectionString = process.env.HRS_DB_URL || process.env.DATABASE_URL || null;
const pool = Pool && connectionString
  ? new Pool({ connectionString, max: 5, idleTimeoutMillis: 10000 })
  : null;

function available() { return Boolean(pool); }

async function safeQuery(text, params = []) {
  if (!pool) return { rows: [] };
  try { return await pool.query(text, params); }
  catch (error) {
    console.error('[HRS DB]', error.message);
    return { rows: [] };
  }
}

const WEB_DISCIPLINES = {
  philosophia: { label: 'Philosophia', hrs: ['ONT', 'LIM'] },
  scientia: { label: 'Scientia', hrs: ['AER', 'PSY'] },
  cultura: { label: 'Cultura et Ars', hrs: ['FOL', 'LIM'] },
  traditio: { label: 'Traditio', hrs: ['ARC', 'FOL', 'INT'] },
  conscientia: { label: 'Conscientia', hrs: ['PSY', 'APP', 'LIM'] },
  information: { label: 'Informatio', hrs: ['ONT', 'INT'] },
  phenomena: { label: 'Phenomena', hrs: ['AER', 'APP', 'PSY', 'LIM'] }
};

async function archiveOverview() {
  const [sources, publishedReports, publicExperiences, openInvestigations] = await Promise.all([
    safeQuery('SELECT COUNT(*)::int AS count FROM research_sources'),
    safeQuery("SELECT COUNT(DISTINCT report_id)::int AS count FROM bell_report_versions WHERE publication_date IS NOT NULL AND publication_date <= CURRENT_DATE"),
    safeQuery("SELECT COUNT(*)::int AS count FROM experiences WHERE public_consent=TRUE AND review_status <> 'UNREVIEWED'"),
    safeQuery("SELECT COUNT(*)::int AS count FROM investigations WHERE status IN ('OPEN','ACTIVE')")
  ]);
  return {
    sources: sources.rows[0]?.count || 0,
    publishedReports: publishedReports.rows[0]?.count || 0,
    publicExperiences: publicExperiences.rows[0]?.count || 0,
    openInvestigations: openInvestigations.rows[0]?.count || 0,
    connected: available()
  };
}

async function publicLibrary({ q = '', track = '', limit = 100 } = {}) {
  const params = [];
  const where = [];
  if (q.trim()) {
    params.push(`%${q.trim()}%`);
    where.push(`(title ILIKE $${params.length} OR author ILIKE $${params.length} OR hrl_id ILIKE $${params.length})`);
  }
  if (track.trim()) {
    params.push(`%${track.trim().toUpperCase()}%`);
    where.push(`research_tracks ILIKE $${params.length}`);
  }
  params.push(Math.min(Math.max(Number(limit) || 100, 1), 250));
  const sql = `
    SELECT hrl_id, title, author, publication_year, source_type, collection,
           research_tracks, priority, reading_phase, cover_url
    FROM research_sources
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY reading_number NULLS LAST, hrl_id
    LIMIT $${params.length}`;
  return (await safeQuery(sql, params)).rows;
}

async function publishedBellReports(limit = 50) {
  return (await safeQuery(`
    SELECT DISTINCT ON (r.id)
      r.report_code, v.version, v.title, v.subtitle, v.abstract_text,
      v.research_question, v.assessment, v.bell_status, v.publication_date,
      v.discipline_codes
    FROM bell_reports r
    JOIN bell_report_versions v ON v.report_id=r.id
    WHERE v.publication_date IS NOT NULL AND v.publication_date <= CURRENT_DATE
    ORDER BY r.id, v.publication_date DESC, v.created_at DESC
    LIMIT $1
  `, [limit])).rows;
}

async function publicExperiences(limit = 50) {
  return (await safeQuery(`
    SELECT experience_code, date_of_experience, location, country, state_of_consciousness,
           raw_narrative, witness_interpretation, review_status
    FROM experiences
    WHERE public_consent=TRUE AND review_status <> 'UNREVIEWED'
    ORDER BY submitted_at DESC
    LIMIT $1
  `, [limit])).rows;
}

async function taxonomy() {
  return (await safeQuery(`
    SELECT code, label, category, description
    FROM experience_feature_definitions
    WHERE active=TRUE
    ORDER BY category, label
  `)).rows;
}

async function submitExperience(input) {
  if (!pool) throw new Error('The HRS database bridge is not configured.');
  const rawNarrative = String(input.rawNarrative || '').trim();
  if (rawNarrative.length < 30) throw new Error('Please provide a fuller account of the experience.');
  if (rawNarrative.length > 25000) throw new Error('The narrative is too long for the public intake form.');

  const requestedFeatures = Array.isArray(input.features) ? input.features : input.features ? [input.features] : [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const seq = await client.query("SELECT nextval('experience_code_seq') AS n");
    const code = `EXP-${String(seq.rows[0].n).padStart(6, '0')}`;
    const inserted = await client.query(`
      INSERT INTO experiences (
        experience_code, submitted_at, date_of_experience, approximate_time,
        location, country, age_band, state_of_consciousness, raw_narrative,
        witness_interpretation, researcher_notes, anonymous, public_consent,
        follow_up_allowed, archive_status, review_status
      ) VALUES ($1,CURRENT_TIMESTAMP,$2,$3,$4,$5,$6,$7,$8,$9,NULL,$10,$11,FALSE,'REPORTED','UNREVIEWED')
      RETURNING id
    `, [
      code,
      input.dateOfExperience || null,
      clean(input.approximateTime), clean(input.location), clean(input.country),
      clean(input.ageBand), clean(input.stateOfConsciousness), rawNarrative,
      clean(input.witnessInterpretation), input.anonymous === 'true', input.publicConsent === 'true'
    ]);

    if (requestedFeatures.length) {
      const valid = await client.query(
        'SELECT code FROM experience_feature_definitions WHERE active=TRUE AND code = ANY($1::varchar[])',
        [requestedFeatures]
      );
      const allowed = new Set(valid.rows.map(row => row.code));
      for (const feature of requestedFeatures) {
        if (!allowed.has(feature)) continue;
        await client.query(`
          INSERT INTO experience_features(experience_id, feature_code, polarity)
          VALUES ($1,$2,'PRESENT') ON CONFLICT DO NOTHING
        `, [inserted.rows[0].id, feature]);
      }
    }
    await client.query('COMMIT');
    return code;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function disciplineSnapshot(slug) {
  const cfg = WEB_DISCIPLINES[slug];
  if (!cfg) return null;
  const codes = cfg.hrs;
  const patternSql = codes.map((_, i) => `v.discipline_codes ILIKE $${i + 1}`).join(' OR ');
  const sourceSql = codes.map((_, i) => `research_tracks ILIKE $${i + 1}`).join(' OR ');
  const [reports, sources, claimCount, investigationCount, caseCount] = await Promise.all([
    safeQuery(`
      SELECT DISTINCT ON (r.id) r.report_code, v.title, v.abstract_text, v.research_question,
             v.open_questions, v.publication_date
      FROM bell_reports r JOIN bell_report_versions v ON v.report_id=r.id
      WHERE v.publication_date IS NOT NULL AND v.publication_date <= CURRENT_DATE
        AND (${patternSql})
      ORDER BY r.id, v.publication_date DESC LIMIT 6`, codes.map(code => `%${code}%`)),
    safeQuery(`
      SELECT hrl_id, title, author, publication_year, research_tracks
      FROM research_sources
      WHERE ${sourceSql}
      ORDER BY reading_number LIMIT 8`, codes.map(code => `%${code}%`)),
    safeQuery('SELECT COUNT(DISTINCT c.id)::int AS count FROM claims c JOIN claim_disciplines d ON d.claim_id=c.id WHERE d.discipline = ANY($1::varchar[])', [codes]),
    safeQuery('SELECT COUNT(DISTINCT i.id)::int AS count FROM investigations i JOIN investigation_disciplines d ON d.investigation_id=i.id WHERE d.discipline = ANY($1::varchar[])', [codes]),
    safeQuery('SELECT COUNT(DISTINCT c.id)::int AS count FROM case_files c JOIN case_disciplines d ON d.case_id=c.id WHERE d.discipline = ANY($1::varchar[])', [codes])
  ]);
  return {
    config: cfg,
    reports: reports.rows,
    sources: sources.rows,
    stats: {
      claims: claimCount.rows[0]?.count || 0,
      investigations: investigationCount.rows[0]?.count || 0,
      cases: caseCount.rows[0]?.count || 0
    },
    connected: available()
  };
}

function clean(value) {
  const text = value == null ? '' : String(value).trim();
  return text || null;
}

module.exports = {
  available,
  WEB_DISCIPLINES,
  archiveOverview,
  publicLibrary,
  publishedBellReports,
  publicExperiences,
  taxonomy,
  submitExperience,
  disciplineSnapshot
};
