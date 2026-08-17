# Heralds Website ↔ HRS / bell bridge

This build changes the public website from a parallel static archive into a curated public surface over the same `bell` PostgreSQL database used by HRS.

## Public surfaces

- `/archive` — public archive index and live counts.
- `/archive/library` — public HRL catalogue metadata.
- `/archive/experiences` — only reviewed experiences with explicit public consent.
- `/archive/cases` — explanatory public index; internal case dossiers remain sealed.
- `/bell` — formally published Bell Report versions only.
- `/report` — Experience Archive intake. It creates `EXP-xxxxxx` records in `bell`; it does **not** create Bell Reports.
- Seven discipline pages retain their intellectual/canonical framing while Open Questions, Research Frontiers and Records are populated from related HRS claims, investigations, sources, cases and published Bell Reports.

## Required Node dependency

Install `pg` in the website project after deployment:

```bash
npm install pg@8.16.3 --save
```

## Database configuration

The bridge reads `HRS_DB_URL` (or `DATABASE_URL`). Do not commit this value.

Recommended: create a separate PostgreSQL role for the public website instead of reusing the HRS owner account.

```sql
CREATE ROLE heralds_web WITH LOGIN PASSWORD 'GENERATE_A_REAL_PASSWORD';
GRANT CONNECT ON DATABASE bell TO heralds_web;
\c bell
GRANT USAGE ON SCHEMA public TO heralds_web;
GRANT SELECT ON research_sources, claims, claim_disciplines, investigations,
  investigation_disciplines, case_files, case_disciplines, bell_reports,
  bell_report_versions, experiences, experience_feature_definitions TO heralds_web;
GRANT SELECT, INSERT ON experiences, experience_features TO heralds_web;
GRANT USAGE, SELECT ON SEQUENCE experience_code_seq TO heralds_web;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO heralds_web;
```

Then add to the website `.env`:

```env
HRS_DB_URL=postgresql://heralds_web:YOUR_PASSWORD@127.0.0.1:5432/bell
```

## Publication boundaries

The website deliberately does not expose private correspondence, membership records, unreviewed experience narratives, or internal case/investigation notes. Database presence is not equivalent to publication status.
