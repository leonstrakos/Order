const { Pool } = require("pg");

const pool = process.env.HRS_DB_URL
  ? new Pool({ connectionString: process.env.HRS_DB_URL })
  : null;

function clean(value) {
  return value === undefined || value === null
    ? ""
    : String(value).trim();
}

function first(row, names) {
  for (const name of names) {
    if (
      Object.prototype.hasOwnProperty.call(row, name) &&
      clean(row[name]) !== ""
    ) {
      return row[name];
    }
  }

  return "";
}

function parseYear(value) {
  const match = clean(value).match(/\d{4}/);
  return match ? Number.parseInt(match[0], 10) : null;
}

function parseInteger(value) {
  const n = Number.parseInt(clean(value), 10);
  return Number.isFinite(n) ? n : null;
}

function normalize(row) {
  return {
    hrl_id: clean(
      first(row, [
        "HRL ID",
        "HRL_ID",
        "hrl_id"
      ])
    ),

    author: clean(
      first(row, [
        "Author / Creator",
        "Author",
        "author"
      ])
    ),

    title: clean(
      first(row, [
        "Title",
        "title"
      ])
    ),

    publication_year: parseYear(
      first(row, [
        "Year",
        "Publication Year"
      ])
    ),

    source_type: clean(
      first(row, [
        "Type",
        "Source Type"
      ])
    ),

    collection: clean(
      first(row, [
        "Collection",
        "Collection / Folder"
      ])
    ),

    source_role: clean(
      first(row, [
        "Source Role",
        "source_role"
      ])
    ),

    project_role: clean(
      first(row, [
        "Role in Project",
        "Project Role",
        "project_role"
      ])
    ),

    credibility: clean(
      first(row, [
        "Credibility / Research Use",
        "Credibility",
        "Research Use"
      ])
    ),

    research_tracks: clean(
      first(row, [
        "Research Tracks",
        "Topics / Research Tracks",
        "Topics"
      ])
    ),

    priority: clean(
      first(row, [
        "Priority",
        "priority"
      ])
    ),

    reading_number: parseInteger(
      first(row, [
        "Reading #",
        "Reading Number"
      ])
    ),

    reading_phase: clean(
      first(row, [
        "Reading Phase",
        "Phase"
      ])
    ),

    reading_status: clean(
      first(row, [
        "Status",
        "Reading Status"
      ])
    )
  };
}

async function importCatalogue(rows) {
  if (!pool) {
    throw new Error("HRS_DB_URL is not configured.");
  }

  if (!Array.isArray(rows) || !rows.length) {
    throw new Error("The catalogue contains no records.");
  }

  const client = await pool.connect();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  try {
    await client.query("BEGIN");

    for (const row of rows) {
      const record = normalize(row);

      if (
        !record.hrl_id ||
        !record.author ||
        !record.title ||
        !record.source_type ||
        !record.collection
      ) {
        skipped++;
        continue;
      }

      const existing = await client.query(
        `
        SELECT id
        FROM research_sources
        WHERE hrl_id = $1
        `,
        [record.hrl_id]
      );

      if (existing.rowCount > 0) {
        await client.query(
          `
          UPDATE research_sources
          SET
            author = $2,
            title = $3,
            publication_year = $4,
            source_type = $5,
            collection = $6,
            source_role = $7,
            project_role = $8,
            credibility = $9,
            research_tracks = $10,
            priority = $11,
            reading_number = $12,
            reading_phase = $13,
            reading_status = $14,
            modified_at = CURRENT_TIMESTAMP
          WHERE hrl_id = $1
          `,
          [
            record.hrl_id,
            record.author,
            record.title,
            record.publication_year,
            record.source_type,
            record.collection,
            record.source_role || "UNCLASSIFIED",
            record.project_role || "UNCLASSIFIED",
            record.credibility || "UNASSESSED",
            record.research_tracks || "GENERAL",
            record.priority || "REFERENCE",
            record.reading_number || 0,
            record.reading_phase || "UNASSIGNED",
            record.reading_status || "UNREAD"
          ]
        );

        updated++;
      } else {
        await client.query(
          `
          INSERT INTO research_sources (
            created_at,
            modified_at,
            hrl_id,
            author,
            title,
            publication_year,
            source_type,
            collection,
            source_role,
            project_role,
            credibility,
            research_tracks,
            priority,
            reading_number,
            reading_phase,
            reading_status
          )
          VALUES (
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP,
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
          )
          `,
          [
            record.hrl_id,
            record.author,
            record.title,
            record.publication_year,
            record.source_type,
            record.collection,
            record.source_role || "UNCLASSIFIED",
            record.project_role || "UNCLASSIFIED",
            record.credibility || "UNASSESSED",
            record.research_tracks || "GENERAL",
            record.priority || "REFERENCE",
            record.reading_number || 0,
            record.reading_phase || "UNASSIGNED",
            record.reading_status || "UNREAD"
          ]
        );

        inserted++;
      }
    }

    await client.query("COMMIT");

    return {
      total: rows.length,
      inserted,
      updated,
      skipped
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  importCatalogue
};