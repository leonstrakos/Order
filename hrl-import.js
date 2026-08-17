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

function splitList(value) {
  return clean(value)
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalize(row) {
  return {
    hrl_id: clean(
      first(row, ["HRL ID", "HRL_ID", "hrl_id", "ID"])
    ),

    author: clean(
      first(row, ["Author", "author"])
    ),

    title: clean(
      first(row, ["Title", "title"])
    ),

    publication_year: parseYear(
      first(row, [
        "Year",
        "Publication Year",
        "publication_year"
      ])
    ),

    source_type: clean(
      first(row, ["Type", "Source Type", "source_type"])
    ),

    collection: clean(
      first(row, [
        "Collection",
        "Collection / Folder",
        "collection"
      ])
    ),

    research_tracks: splitList(
      first(row, [
        "Topics / Research Tracks",
        "Research Tracks",
        "Topics",
        "research_tracks"
      ])
    ),

    evidence_class: clean(
      first(row, [
        "Evidence Class",
        "Evidence class",
        "evidence_class"
      ])
    ),

    priority: clean(
      first(row, ["Priority", "priority"])
    ),

    reading_status: clean(
      first(row, [
        "Reading Status",
        "Reading Phase",
        "reading_status",
        "reading_phase"
      ])
    ),

    notes: clean(
      first(row, ["Notes", "notes"])
    )
  };
}

async function getColumns(client) {
  const result = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'research_sources'
  `);

  if (!result.rows.length) {
    throw new Error(
      "PostgreSQL table research_sources was not found."
    );
  }

  return new Map(
    result.rows.map((row) => [
      row.column_name,
      row.data_type
    ])
  );
}

function pick(columns, names) {
  return names.find((name) => columns.has(name)) || null;
}

function mappingFor(columns) {
  const map = {
    hrl_id: pick(columns, ["hrl_id"]),
    author: pick(columns, ["author", "authors"]),
    title: pick(columns, ["title"]),

    publication_year: pick(columns, [
      "publication_year",
      "year"
    ]),

    source_type: pick(columns, [
      "source_type",
      "type"
    ]),

    collection: pick(columns, [
      "collection",
      "collection_code"
    ]),

    research_tracks: pick(columns, [
      "research_tracks",
      "topics"
    ]),

    evidence_class: pick(columns, [
      "evidence_class",
      "evidence_classification"
    ]),

    priority: pick(columns, [
      "priority",
      "priority_code"
    ]),

    reading_status: pick(columns, [
      "reading_status",
      "reading_phase"
    ]),

    notes: pick(columns, [
      "notes",
      "note"
    ])
  };

  if (!map.hrl_id) {
    throw new Error(
      "research_sources has no hrl_id column."
    );
  }

  if (!map.title) {
    throw new Error(
      "research_sources has no title column."
    );
  }

  return map;
}

function dbValue(value, dataType) {
  if (Array.isArray(value)) {
    if (dataType === "ARRAY") {
      return value;
    }
    return value.join("; ");
  }

  return value === "" ? null : value;
}

async function insertOrUpdate(
  client,
  record,
  columns,
  mapping
) {
  const existing = await client.query(
    `
      SELECT 1
      FROM research_sources
      WHERE hrl_id = $1
      LIMIT 1
    `,
    [record.hrl_id]
  );

  const fields = Object.entries(mapping)
    .filter(([key, column]) =>
      column && key !== "hrl_id"
    );

  if (existing.rowCount) {
    const values = [record.hrl_id];

    const assignments = fields.map(
      ([key, column], index) => {
        values.push(
          dbValue(record[key], columns.get(column))
        );

        return `"${column}" = $${index + 2}`;
      }
    );

    if (columns.has("modified_at")) {
      assignments.push(
        `"modified_at" = CURRENT_TIMESTAMP`
      );
    }

    await client.query(
      `
        UPDATE research_sources
        SET ${assignments.join(", ")}
        WHERE hrl_id = $1
      `,
      values
    );

    return "updated";
  }

  const names = [`"${mapping.hrl_id}"`];
  const values = [record.hrl_id];

  for (const [key, column] of fields) {
    names.push(`"${column}"`);
    values.push(
      dbValue(record[key], columns.get(column))
    );
  }

  const placeholders = values.map(
    (_, index) => `$${index + 1}`
  );

  await client.query(
    `
      INSERT INTO research_sources (
        ${names.join(", ")}
      )
      VALUES (
        ${placeholders.join(", ")}
      )
    `,
    values
  );

  return "inserted";
}

async function importCatalogue(rows) {
  if (!pool) {
    throw new Error(
      "HRS_DB_URL is not configured."
    );
  }

  if (!Array.isArray(rows) || !rows.length) {
    throw new Error(
      "The catalogue contains no records."
    );
  }

  const client = await pool.connect();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  try {
    await client.query("BEGIN");

    const columns = await getColumns(client);
    const mapping = mappingFor(columns);

    for (const row of rows) {
      const record = normalize(row);

      if (!record.hrl_id || !record.title) {
        skipped++;
        continue;
      }

      const action = await insertOrUpdate(
        client,
        record,
        columns,
        mapping
      );

      if (action === "inserted") {
        inserted++;
      } else {
        updated++;
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
