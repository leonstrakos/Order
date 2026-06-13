const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const db = require("./db");
const helmet = require("helmet");
const { SitemapStream, streamToPromise } = require('sitemap');
const { Readable } = require('stream');
const { Resend } = require('resend');
require("dotenv").config();
const multer = require("multer");


const app = express();
const PORT = process.env.PORT || 3000;

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
  res.locals.currentPath = req.path;
  res.locals.user = req.session?.user || null;
  next();
});

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
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 4
    }
  })
);


app.use(express.static(path.join(__dirname, "public")));

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
}




app.post("/login", async (req, res) => {
  try {
    const { identity, password } = req.body;

    if (!identity || !password) {
      return res.status(400).send("Missing credentials.");
    }

    const user = db
      .prepare(
        `SELECT id, chosen_name, email, password_hash, role
         FROM users
         WHERE email = ? OR chosen_name = ?`
      )
      .get(identity, identity);

    if (!user) {
      return res.status(401).send("Invalid credentials.");
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);

    if (!passwordOk) {
      return res.status(401).send("Invalid credentials.");
    }

    req.session.user = {
      id: user.id,
      chosen_name: user.chosen_name,
      email: user.email,
      role: user.role
    };

    res.redirect("/members");
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).send("Server error.");
  }
});


app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.get("/api/me", (req, res) => {
  if (!req.session.user) {
    return res.json({ loggedIn: false });
  }

  res.json({
    loggedIn: true,
    chosen_name: req.session.user.chosen_name,
    role: req.session.user.role
  });
});












const routes = {
  "/": "home",
  "/home": "index",
  "/test": "test",
  "/test2": "test2",
  "/test3": "test3",
  "/about": "about",
  "/constitution": "constitution",
  "/document": "document",
  "/discipline": "discipline",
  "/form": "form",
  "/contact": "contact",
  "/copyright": "copyrights",
  "/join": "join",
  "/login": "login",
  "/archive": "archive",
  "/bell": "bellreports",
  "/heralds": "",
  "/report": "report",
  "/journal": "journal",

    // disciplines:
  "/philosophia": "philosophia",
  "/scientia": "scientia",
  "/cultura": "cultura",
  "/traditio": "traditio",
  "/conscientia": "conscientia",
  "/information": "information",
  "/phenomena": "phenomena"
};

Object.entries(routes).forEach(([route, view]) => {
  app.get(route, (req, res) => {
    res.render(view);
  });
});












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


app.post(
  "/reports/create",
  upload.array("evidenceFiles"),
  (req, res) => {

    try {

      const files = req.files
        ? JSON.stringify(
            req.files.map(
              file => file.filename
            )
          )
        : null;

      const stmt = db.prepare(`
        INSERT INTO reports (
          category,
          title,
          author,
          email,
          age,
          sex,
          eventDate,
          location,
          witnesses,
          report,
          additionalNotes,
          files
        )
        VALUES (
          ?,?,?,?,?,?,?,?,?,?,?,?
        )
      `);

      stmt.run(
        req.body.category,
        req.body.title,
        req.body.author,
        req.body.email,
        req.body.age,
        req.body.sex,
        req.body.eventDate,
        req.body.location,
        req.body.witnesses,
        req.body.report,
        req.body.additionalNotes,
        files
      );

      res.send("Report saved.");

    } catch (err) {

      console.error(err);

      res
        .status(500)
        .send("Failed to save report.");

    }

  }
);





// see reports  http://localhost:3000/admin/reports
app.get("/admin/reports", (req, res) => { if (!req.session.user) {
 // return res.redirect("/login");
}

  const reports = db
    .prepare(`
      SELECT *
      FROM reports
      ORDER BY createdAt DESC
    `)
    .all();

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bell Reports Admin</title>

      <style>
        body{
          font-family:Arial,sans-serif;
          max-width:1200px;
          margin:auto;
          padding:40px;
          background:#111;
          color:#eee;
        }

        .report{
          border:1px solid #444;
          padding:20px;
          margin-bottom:30px;
          border-radius:8px;
          background:#1a1a1a;
        }

        h2{
          margin-top:0;
        }

        .meta{
          color:#aaa;
          margin-bottom:15px;
        }

        pre{
          white-space:pre-wrap;
          word-wrap:break-word;
          font-family:inherit;
        }

        a{
          color:#8cc6ff;
        }
      </style>
    </head>
    <body>

      <h1>Bell Report Submissions (${reports.length})</h1>

      ${reports.map(report => `

        <div class="report">

          <h2>${report.title || "Untitled Report"}</h2>

          <div class="meta">
            <strong>Category:</strong> ${report.category || "-"}<br>
            <strong>Author:</strong> ${report.author || "-"}<br>
            <strong>Email:</strong> ${report.email || "-"}<br>
            <strong>Age:</strong> ${report.age || "-"}<br>
            <strong>Sex:</strong> ${report.sex || "-"}<br>
            <strong>Date of Event:</strong> ${report.eventDate || "-"}<br>
            <strong>Location:</strong> ${report.location || "-"}<br>
            <strong>Witnesses:</strong> ${report.witnesses || "-"}<br>
            <strong>Submitted:</strong> ${report.createdAt || "-"}
          </div>

          <h3>Report</h3>
          <pre>${report.report || ""}</pre>

          <h3>Additional Notes</h3>
          <pre>${report.additionalNotes || ""}</pre>

          <h3>Files</h3>

          ${
            report.files
              ? JSON.parse(report.files)
                  .map(file =>
                    `<div><a href="/uploads/${file}" target="_blank">${file}</a></div>`
                  )
                  .join("")
              : "No files uploaded"
          }

        </div>

      `).join("")}

    </body>
    </html>
  `);

});



// mailinggg

//const nodemailer = require('nodemailer');
const resend = new Resend(process.env.RESEND_API_KEY);

app.post('/form', async (req, res) => {
  try {
    const { day, life, email, gain, give } = req.body;

    if (!day || !life || !email || !gain || !give) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const { data, error } = await resend.emails.send({
      from: 'Order of the Lions Bell <info@heraldsofthelion.org>',
      to: ['apply@heraldsofthelion.org'],
      reply_to: email,
      subject: 'New Seeker Application',
      html: `
        <div style="font-family: Georgia, serif; line-height: 1.6;">
          <h2>New Secret Society Application</h2>
          <p><strong>Applicant email:</strong> ${escapeHtml(email)}</p>
          <hr />
          <p><strong>Describe your day</strong></p>
          <p>${nl2br(escapeHtml(day))}</p>
          <p><strong>Describe your life</strong></p>
          <p>${nl2br(escapeHtml(life))}</p>
          <p><strong>What do you expect to gain?</strong></p>
          <p>${nl2br(escapeHtml(gain))}</p>
          <p><strong>What are you willing to give up?</strong></p>
          <p>${nl2br(escapeHtml(give))}</p>
        </div>
      `,
    });

    if (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to send application.' });
    }

    return res.json({
      message: 'Your petition has been delivered.',
      id: data?.id,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
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
      { url: '/contact', changefreq: 'monthly', priority: 0.7 }
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
  console.log(`⚜ Server running at http://localhost:${PORT}`);
});
