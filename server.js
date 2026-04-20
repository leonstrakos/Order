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
  "/heralds": "heralds",

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


app.use((req, res) => {
  res.status(404).render("404");
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




app.listen(PORT, () => {
  console.log(`⚜ Server running at http://localhost:${PORT}`);
});
