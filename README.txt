Order of the Lion's Bell

Public website and institutional gateway for Heralds of the Lion
Production: https://heraldsofthelion.org

This repository contains the public-facing website of the Order of the Lion's Bell and the web gateway into the Heralds Research System (HRS).

The website presents the Order, its archive and publications, accepts public applications, exposes member access, and connects authenticated members to the HRS research platform. It is intentionally separate from the HRS application/backend repository.

Repository scope

This repository is responsible for:

the public Heralds of the Lion website;

Order, Archive, Bell and institutional pages;

public application/contact flows;

HRS access and download page;

HRS website login and Seeker registration bridge;

member profile / Herald record;

Keeper of the Bell archive-administration entry point;

HRL catalogue XLSX import bridge;

public static assets, typography and visual identity;

Android HRS distribution files placed under public/downloads/ when used.

It is not the canonical repository for the HRS Spring Boot backend, Expo/React Native client, PostgreSQL schema, or PWA source.

Production architecture

                         heraldsofthelion.org
                                  │
                                nginx
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
              /                 /app/               /api/
              │                   │                   │
      Node / Express / EJS      HRS PWA        Spring Boot HRS
          PM2: heralds          static build       port 8080
              │                                       │
              │                                       ▼
              └────────── HRS identity ───────── PostgreSQL
                                                  database: bell

Production locations currently used by the deployment:

Website             /var/www/Order
HRS PWA             /srv/hrs/web/app
Website process     PM2: heralds
Website port        3000
HRS API             127.0.0.1:8080/api

nginx owns the public routing. The Node website itself only handles the website routes; /app/ is served as the exported Expo web application and /api/ is proxied to the HRS backend.

Website ↔ HRS integration

The website does not maintain an independent HRS member identity system.

Website login / registration
          │
          ▼
      HRS backend
          │
          ▼
HRS member + auth token
          │
          ├── website session
          └── HRS PWA session bridge

Important routes include:

/hrs                 HRS access / platform page
/hrs/open            authenticated entry into the web HRS client
/login                HRS-backed website login
/register             creates a Seeker account through HRS
/profile              member / Herald record
/profile/archive/import
                     Keeper-controlled HRL catalogue import
/app/                 HRS PWA (served by nginx, not Express)
/api/                 HRS API (proxied by nginx)

The intended user experience is one institutional identity across the website and HRS rather than separate website and research-system accounts.

Access model

HRS distinguishes formation stage, institutional office, and effective permissions. The website consumes the authenticated HRS member record rather than inventing its own parallel role hierarchy.

Archive Administration on the website is reserved for the Keeper of the Bell stage and is enforced server-side as well as hidden from unauthorized profiles in the UI.

Creating a website account creates a Seeker identity. Registration is not initiation or advancement within the Order.

Technology

Website

Node.js

Express

EJS

express-session

Helmet

Multer

SheetJS / xlsx

Resend

Sitemap generation

dotenv

Connected production services

nginx

PM2

HRS Spring Boot API

PostgreSQL

Expo / React Native HRS PWA

Node 18+ is recommended for the current HRS bridge implementation.

Project structure

The exact set of pages may evolve, but the repository follows the general structure below:

Order/
├── server.js
├── package.json
├── package-lock.json
├── hrs-auth.js
├── hrs-db.js
├── hrl-import.js
├── discipline-content.js
├── views/
│   ├── partials/
│   ├── home.ejs
│   ├── about.ejs
│   ├── archive.ejs
│   ├── hrs.ejs
│   ├── login.ejs
│   ├── register.ejs
│   ├── profile.ejs
│   └── ...
├── public/
│   ├── css/
│   ├── js/
│   ├── images/
│   ├── fonts/
│   └── downloads/
└── README.md

Local development

Install dependencies:

npm install

Create a local .env file. Never commit production secrets.

Example development configuration:

PORT=3000
NODE_ENV=development
SESSION_SECRET=replace-with-a-long-random-secret
RESEND_API_KEY=replace-with-development-key
HRS_INTERNAL_API=http://127.0.0.1:8080/api

Then start the website using the command defined by package.json, or directly during development:

node server.js

The HRS-backed login, registration, member profile and archive-import features require a reachable HRS backend.

Production deployment

The production website is deployed at:

/var/www/Order

Typical source deployment:

cd /var/www/Order
git pull origin master
node --check server.js
pm2 restart heralds --update-env
pm2 status

The HRS PWA is deployed separately. Updating website source does not require replacing /srv/hrs/web/app, and updating the PWA does not require restarting the Node website.

Security and repository rules

Do not commit:

.env
production secrets
session secrets
API keys
PostgreSQL credentials
database dumps
private user/member exports
private archive submissions
server snapshots
TLS private keys
node_modules/
runtime logs

The production backup is intentionally kept outside this Git repository.

The HRS PWA session bridge is same-origin infrastructure for the current HRS bearer-token model. Authentication and permission-sensitive actions must always remain enforced by the backend; hiding a control in EJS or React is never considered sufficient authorization.

Related system: Heralds Research System

The companion HRS repository contains the actual research platform:

Heralds Research System
├── mobile/       Expo / React Native / Web
├── backend/      Spring Boot REST API
└── database      PostgreSQL schema managed by Flyway

HRS currently covers institutional membership and formation, the Heralds Research Library, claims and evidence, cases and investigations, the Experience Archive, correspondence, the Bell publication system, Order governance/workflow, settings, contributions and archive intake.

This repository should remain the public web/institutional surface, while HRS remains the working research and formation system.

Current milestone

HRS v1.5 web integration

The current production generation includes:

Android HRS access;

installable web/PWA access;

HRS-backed website login;

direct Seeker registration;

member profile integration;

website-to-PWA identity bridge;

Keeper of the Bell archive administration;

HRL catalogue import into the canonical HRS backend.

Backup philosophy

GitHub is the source-code history, not the complete production backup.

A full production snapshot should additionally preserve:

the live website tree;

the exported PWA build;

the deployed backend JAR/service configuration;

nginx configuration;

PM2 state;

environment configuration;

uploaded/runtime files where applicable;

a PostgreSQL pg_dump of the bell database.

That snapshot is stored privately/offline and must never be committed to this repository.

Campana Sonat Omnibus
