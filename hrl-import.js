const { Pool } = require("pg");

const pool = process.env.HRS_DB_URL
  ? new Pool({
      connectionString: process.env.HRS_DB_URL
    })
  : null;

function text(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function year(value) {
  const match = text(value).match(/\d{4}/);
  return match ? Number.parseInt(match[0], 10) : null;
}

function integer(value) {
  const raw = text(value);

  if (!raw || raw.toUpperCase() === "TBD") {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function normalize(row) {
  return {
    hrl_id: text(row["HRL ID"]),

    author: text(row["Author / Creator"]),

    title: text(row["Title"]),

    publication_year: year(row["Year"]),

    source_type: text(row["Type"]),

    collection: text(row["Collection"]),

    source_role: text(row["Source Role"]),

    project_role: text(row["Role in Project"]),

    credibility: text(row["Credibility / Research Use"]),

    research_tracks: text(row["Research Tracks"]),

    priority: text(row["Priority"]),

    reading_number: integer(row["Reading #"]),

    reading_phase: text(row["Reading Phase"]),

    reading_status: text(row["Status"]),

    audit_flag: text(row["Audit Flag"]),

    relative_path: text(row["Relative Path"])
  };
}

function validate(record, rowNumber) {
  const required = {
    "HRL ID": record.hrl_id,
    "Author / Creator": record.author,
    "Title": record.title,
    "Type": record.source_type,
    "Collection": record.collection,
    "Source Role": record.source_role,
    "Role in Project": record.project_role,
    "Credibility / Research Use": record.credibility,
    "Research Tracks": record.research_tracks,
    "Priority": record.priority,
    "Reading Phase": record.reading_phase,
    "Status": record.reading_status,
    "Relative Path": record.relative_path
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(
      `HRL row ${rowNumber} (${record.hrl_id || "NO HRL ID"}) is missing: ${missing.join(", ")}`
    );
  }
}

async function importCatalogue(rows) {
  if (!pool) {
    throw new Error(
      "HRS_DB_URL is not configured."
    );
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(
      "The Qualitative Catalog contains no records."
    );
  }

  const client = await pool.connect();

  let inserted = 0;
  let updated = 0;

  try {
    await client.query("BEGIN");

    for (let index = 0; index < rows.length; index++) {
      const record = normalize(rows[index]);

      validate(record, index + 2);

      const existing = await client.query(
        `
        SELECT id
        FROM research_sources
        WHERE hrl_id = $1
        LIMIT 1
        `,
        [record.hrl_id]
      );

      const values = [
        record.hrl_id,
        record.author,
        record.title,
        record.publication_year,
        record.source_type,
        record.collection,
        record.source_role,
        record.project_role,
        record.credibility,
        record.research_tracks,
        record.priority,
        record.reading_number,
        record.reading_phase,
        record.reading_status,
        record.audit_flag,
        record.relative_path
      ];

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
            audit_flag = $15,
            relative_path = $16,
            modified_at = CURRENT_TIMESTAMP
          WHERE hrl_id = $1
          `,
          values
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
            reading_status,
            audit_flag,
            relative_path
          )
          VALUES (
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP,
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16
          )
          `,
          values
        );

        inserted++;
      }
    }

    await client.query("COMMIT");

    return {
      total: rows.length,
      inserted,
      updated,
      skipped: 0
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