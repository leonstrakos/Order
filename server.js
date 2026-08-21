const express = require("express");
const path = require("path");
const session = require("express-session");
const XLSX = require("xlsx");

const helmet = require("helmet");
const { SitemapStream, streamToPromise } = require("sitemap");
const { Readable } = require("stream");
const { Resend } = require("resend");
const multer = require("multer");

require("dotenv").config();

const hrsDb = require("./hrs-db");
const disciplineContent = require("./discipline-content");
const hrsAuth = require("./hrs-auth");
const hrlImport = require("./hrl-import");

const app = express();
const PORT = process.env.PORT || 3000;

// Website -> HRS bridge. Uses the local Spring service by default so the
// public website and PWA share the same HRS identity without a second user DB.
const HRS_INTERNAL_API = (
  process.env.HRS_INTERNAL_API_URL ||
  process.env.HRS_API_URL ||
  "http://127.0.0.1:8080/api"
).replace(/\/$/, "");

app.set("trust proxy", 1);
app.set("view engine", "ejs");

app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);



app.use((req, res, next) => {
  if (req.headers.host === "www.heraldsofthelion.org") {
    return res.redirect(301, "https://heraldsofthelion.org" + req.url);
  }
  next();
});



app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 12
    }
  })
);


app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.user = req.session?.user || null;
  next();
});

app.use(express.static(path.join(__dirname, "public")));

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
}

function isKeeperOfBell(member) {
  const stageCode = String(member?.stageCode || "").trim().toUpperCase();
  const stageName = String(member?.stageName || "").trim().toLowerCase();

  return (
    stageCode === "KEEPER_OF_BELL" ||
    stageName === "keeper of the bell"
  );
}

function safeNextPath(value, fallback = "/profile") {
  const candidate = String(value || "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  return candidate;
}

function registrationValues(body = {}) {
  return {
    displayName: String(body.displayName || ""),
    username: String(body.username || ""),
    email: String(body.email || ""),
    countryCode: String(body.countryCode || "")
  };
}

async function hrsRegister(payload) {
  const response = await fetch(`${HRS_INTERNAL_API}/auth/register`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.detail ||
      data?.error ||
      raw ||
      "The Seeker account could not be created.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}





app.get("/login", (req, res) => {
  if (req.session?.user && safeNextPath(req.query.next, "") === "/app/") {
    return res.redirect("/hrs/open");
  }

  return res.render("login", {
    error: null,
    next: safeNextPath(req.query.next, "/profile")
  });
});

app.post("/login", async (req, res) => {
  const nextPath = safeNextPath(req.body.next, "/profile");

  try {
    const username = String(req.body.identity || "").trim();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).render("login", {
        error: "Enter your HRS username and password.",
        next: nextPath
      });
    }

    const sessionData = await hrsAuth.login(username, password);
    req.session.hrsToken = sessionData.token;
    req.session.user = sessionData.member;
    req.session.hrsExpiresAt = sessionData.expiresAt;

    const applicationStatement = String(req.body.applicationStatement || "").trim();
const areas = String(req.body.areas || "").trim();

void (async () => {
  try {
    const { error: mailError } = await resend.emails.send({
      from: "Order of the Lions Bell <info@heraldsofthelion.org>",
      to: ["apply@heraldsofthelion.org"],
      reply_to: values.email.trim(),
      subject: `New Seeker Registration - ${values.displayName.trim()}`,
      html: `
        <div style="font-family: Georgia, serif; line-height: 1.6;">
          <h2>New Seeker Registration</h2>

          <p><strong>Name:</strong> ${escapeHtml(values.displayName.trim())}</p>
          <p><strong>Username:</strong> ${escapeHtml(values.username.trim())}</p>
          <p><strong>Email:</strong> ${escapeHtml(values.email.trim())}</p>
          <p><strong>Country:</strong> ${escapeHtml(values.countryCode.trim() || "—")}</p>

          <hr>

          <p><strong>What brings you to the Order?</strong></p>
          <p>${nl2br(escapeHtml(applicationStatement || "—"))}</p>

          <p><strong>Areas of interest or study</strong></p>
          <p>${nl2br(escapeHtml(areas || "—"))}</p>
        </div>
      `
    });

    if (mailError) {
      console.warn("Seeker registration mail:", mailError);
    }
  } catch (mailError) {
    console.warn("Seeker registration mail:", mailError);
  }
})();

    return res.redirect(nextPath);
  } catch (error) {
    console.error("HRS login error:", error.message);
    return res.status(error.status === 401 ? 401 : 502).render("login", {
      error:
        error.status === 401
          ? "The credentials were not recognized."
          : "The HRS identity service is temporarily unavailable.",
      next: nextPath
    });
  }
});

app.get("/register", (req, res) => {
  if (req.session?.user) return res.redirect("/hrs/open");

  return res.render("form", {
    error: null,
    next: safeNextPath(req.query.next, "/app/"),
    values: registrationValues()
  });
});

app.post("/register", async (req, res) => {
  const nextPath = safeNextPath(req.body.next, "/app/");
  const values = registrationValues(req.body);
  const password = String(req.body.password || "");
  const passwordConfirm = String(req.body.passwordConfirm || "");

  try {
    if (!values.displayName.trim() || !values.username.trim() || !values.email.trim() || !password) {
      return res.status(400).render("form", {
        error: "Complete the required fields.",
        next: nextPath,
        values
      });
    }

    if (password.length < 12) {
      return res.status(400).render("form", {
        error: "Password must contain at least 12 characters.",
        next: nextPath,
        values
      });
    }

    if (password !== passwordConfirm) {
      return res.status(400).render("form", {
        error: "The passwords do not match.",
        next: nextPath,
        values
      });
    }

    const sessionData = await hrsRegister({
      displayName: values.displayName.trim(),
      username: values.username.trim(),
      email: values.email.trim(),
      password,
      countryCode: values.countryCode.trim() || undefined
    });

    req.session.hrsToken = sessionData.token;
    req.session.user = sessionData.member;
    req.session.hrsExpiresAt = sessionData.expiresAt;

    return res.redirect(nextPath);
  } catch (error) {
    console.error("HRS registration error:", error.message);
    return res.status(error.status >= 400 && error.status < 500 ? 400 : 502).render("form", {
      error: error.message || "The Seeker account could not be created.",
      next: nextPath,
      values
    });
  }
});

// Website -> PWA entry. A signed-in website member goes straight to HRS web;
// everybody else is sent through the shared HRS login first.
app.get("/hrs/open", (req, res) => {
  if (!req.session?.hrsToken || !req.session?.user) {
    return res.redirect("/login?next=%2Fapp%2F");
  }
  return res.redirect("/app/");
});

// PWA bootstrap endpoint. The cookie remains HttpOnly; only an already-valid
// HRS bearer token is handed to the same-origin HRS web client.
app.get("/hrs/session", async (req, res) => {
  res.set("Cache-Control", "no-store");

  if (!req.session?.hrsToken) {
    return res.json({ loggedIn: false });
  }

  try {
    const member = await hrsAuth.me(req.session.hrsToken);
    req.session.user = member;
    return res.json({
      loggedIn: true,
      token: req.session.hrsToken,
      member,
      expiresAt: req.session.hrsExpiresAt || null
    });
  } catch {
    delete req.session.hrsToken;
    delete req.session.user;
    delete req.session.hrsExpiresAt;
    return res.status(401).json({ loggedIn: false });
  }
});

// PWA -> website session bridge. Used after native HRS web login/register so
// Profile and the public website immediately know the same member.
app.post("/hrs/adopt-session", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const token = String(req.body?.token || "").trim();
  if (!token) return res.status(400).json({ error: "HRS token required." });

  try {
    const member = await hrsAuth.me(token);
    req.session.hrsToken = token;
    req.session.user = member;
    req.session.hrsExpiresAt = null;
    return res.json({ ok: true, member });
  } catch {
    return res.status(401).json({ error: "HRS session was not accepted." });
  }
});

app.post("/hrs/drop-session", (req, res) => {
  req.session.destroy(() => res.status(204).end());
});

app.get('/logout', async (req, res) => {
  const token = req.session?.hrsToken;
  try { if (token) await hrsAuth.logout(token); } catch (error) { console.warn('HRS logout:', error.message); }
  req.session.destroy(() => res.redirect('/'));
});

app.get('/api/me', async (req, res) => {
  if (!req.session?.hrsToken) return res.json({ loggedIn:false });
  try {
    const member = await hrsAuth.me(req.session.hrsToken);
    req.session.user = member;
    return res.json({ loggedIn:true, ...member });
  } catch {
    return res.status(401).json({ loggedIn:false });
  }
});

app.get('/profile', requireAuth, async (req, res) => {
  try {
    const member = await hrsAuth.me(req.session.hrsToken);
    req.session.user = member;
    res.locals.user = member;
    return res.render('profile', { member, importResult:null, importError:null });
  } catch (error) {
    req.session.destroy(() => res.redirect('/login'));
  }
});











const routes = {
  "/": "home",
  "/home": "index",
  "/test3": "test3",
  "/about": "about",
  "/hrs": "hrs",
  "/constitution": "constitution",
  "/document": "document",
  "/form": "form",
  "/contact": "contact",
  "/copyright": "copyrights",
  "/join": "join",
  "/heralds": "",
  "/journal": "journal"
};

Object.entries(routes).forEach(([route, view]) => {
  app.get(route, (req, res) => res.render(view));
});

// Public HRS / bell database surfaces. These intentionally expose only curated/public data.
app.get("/archive", async (req, res) => {
  const overview = await hrsDb.archiveOverview();
  res.render("archive", { overview });
});

app.get("/archive/library", async (req, res) => {
  const q = String(req.query.q || "");
  const sources = await hrsDb.publicLibrary({ q, limit: 150 });
  res.render("research-library", { sources, q });
});

app.get("/archive/experiences", async (req, res) => {
  const experiences = await hrsDb.publicExperiences(80);
  res.render("experience-archive", { experiences });
});

app.get("/archive/cases", (req, res) => res.render("case-archive"));

app.get("/bell", async (req, res) => {
  const reports = await hrsDb.publishedBellReports(80);
  res.render("bellreports", { reports });
});

const disciplineSlugs = Object.keys(disciplineContent);
disciplineSlugs.forEach(slug => {
  app.get(`/${slug}`, async (req, res) => {
    const snapshot = await hrsDb.disciplineSnapshot(slug);
    res.render("discipline-live", { discipline: disciplineContent[slug], snapshot });
  });
});

app.get("/report", async (req, res) => {
  const taxonomy = await hrsDb.taxonomy();
  res.render("report", { taxonomy, error: null });
});

const submissionWindows = new Map();
function allowExperienceSubmission(ip) {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const recent = (submissionWindows.get(ip) || []).filter(t => now - t < hour);
  if (recent.length >= 5) return false;
  recent.push(now);
  submissionWindows.set(ip, recent);
  return true;
}

app.post("/experiences/submit", async (req, res) => {
  const taxonomy = await hrsDb.taxonomy();
  try {
    if (req.body.website) return res.status(204).end(); // honeypot
    if (!allowExperienceSubmission(req.ip)) {
      return res.status(429).render("report", { taxonomy, error: "Too many submissions from this connection. Please try again later." });
    }
    const code = await hrsDb.submitExperience(req.body);
    return res.status(201).render("experience-submitted", { code });
  } catch (error) {
    console.error("Experience submission error:", error);
    return res.status(400).render("report", { taxonomy, error: error.message || "The experience could not be recorded." });
  }
});

// Legacy public Bell Report intake is retired. Bell Reports are formal outputs of HRS.
app.post("/reports/create", (req, res) => res.status(410).send("Public Bell Report intake has moved to /report as Experience Archive intake."));


// uploads

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {

    const safeName =
      file.originalname.replace(/\s+/g, "-");

    cb(
      null,
      Date.now() + "-" + safeName
    );
  }
});

const upload = multer({

  storage,

  fileFilter(req, file, cb) {

    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",

      "video/mp4",

      "audio/mpeg",
      "audio/wav",

      "application/pdf"
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only JPG, PNG, WEBP, MP4, MP3, WAV and PDF files are allowed."
        )
      );
    }
  },

  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
    files: 10
  }

});


const xlsxUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    const ok = file.originalname.toLowerCase().endsWith('.xlsx') || file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    cb(ok ? null : new Error('Only .xlsx catalogues are accepted.'), ok);
  }
});

app.post(
  "/profile/archive/import",
  requireAuth,
  xlsxUpload.single("catalogue"),
  async (req, res) => {
    let member;

    try {
      member = await hrsAuth.me(
        req.session.hrsToken
      );

      if (!isKeeperOfBell(member)) {
        return res.status(403).render(
          "profile",
          {
            member,
            importResult: null,
            importError:
              "Only a Keeper of the Bell may administer the Heralds Research Library catalogue."
          }
        );
      }

      if (!req.file) {
        return res.status(400).render(
          "profile",
          {
            member,
            importResult: null,
            importError:
              "Choose an .xlsx catalogue first."
          }
        );
      }

      const workbook = XLSX.read(
        req.file.buffer,
        {
          type: "buffer"
        }
      );

      const sheetName =
        workbook.SheetNames.find((name) =>
          /master library/i.test(name)
        ) ||
        workbook.SheetNames.find((name) =>
          /library/i.test(name)
        ) ||
        workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error(
          "The workbook contains no worksheets."
        );
      }

      const rows = XLSX.utils.sheet_to_json(
        workbook.Sheets[sheetName],
        {
          defval: "",
          raw: false
        }
      );

      if (!rows.length) {
        throw new Error(
          "The selected worksheet contains no records."
        );
      }

      const result =
        await hrlImport.importCatalogue(rows);

      return res.render("profile", {
        member,

        importResult: {
          message:
            "HRL catalogue imported successfully.",
          sheet: sheetName,
          ...result
        },

        importError: null
      });
    } catch (error) {
      console.error("HRL import:", error);

      return res.status(500).render(
        "profile",
        {
          member:
            member || req.session.user,

          importResult: null,

          importError:
            error.message ||
            "The catalogue could not be imported."
        }
      );
    }
  }
);

// Legacy SQLite report ingestion removed; public intake now writes to the HRS Experience Archive.

// Legacy SQLite report administration is retired. Experience review now belongs inside HRS.
app.get("/admin/reports", (req, res) => {
  res.status(410).send("Legacy report administration has been retired. Review Experience Archive records inside HRS.");
});


// mailinggg

//const nodemailer = require('nodemailer');
const resend = new Resend(process.env.RESEND_API_KEY);


app.post('/form', (req, res) => {
  return res.status(410).json({
    message: 'This legacy application endpoint has been retired. Apply through the Seeker registration form.'
  });
});

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function nl2br(str = '') {
  return str.replace(/\n/g, '<br>');
}
   




app.get('/sitemap.xml', async (req, res) => {
  try {
    const links = [
      { url: '/', changefreq: 'daily', priority: 1.0 },
      { url: '/about', changefreq: 'monthly', priority: 0.7 },
      { url: '/contact', changefreq: 'monthly', priority: 0.7 },
      { url: '/archive', changefreq: 'weekly', priority: 0.9 },
      { url: '/hrs', changefreq: 'monthly', priority: 0.9 },
      { url: '/archive/library', changefreq: 'weekly', priority: 0.8 },
      { url: '/archive/experiences', changefreq: 'weekly', priority: 0.7 },
      { url: '/bell', changefreq: 'weekly', priority: 0.8 },
      { url: '/report', changefreq: 'monthly', priority: 0.7 }
    ];

    const stream = new SitemapStream({
      hostname: 'https://heraldsofthelion.org'
    });

    const xml = await streamToPromise(
      Readable.from(links).pipe(stream)
    ).then(data => data.toString());

    res.header('Content-Type', 'application/xml');
    res.send(xml);

  } catch (error) {
    console.error(error);
    res.status(500).end();
  }
});










app.use((req, res) => {
  res.status(404).render("404");
});




app.listen(PORT, () => {
  console.log(`âšś Server running at http://localhost:${PORT}`);
});