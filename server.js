const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const db = require("./db");
const helmet = require("helmet");
const { SitemapStream, streamToPromise } = require('sitemap');
const { Readable } = require('stream');
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

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/home", (req, res) => {
  res.render("index");
});


app.get("/about", (req, res) => {
  res.render("about");
});


app.get("/constitution", (req, res) => {
  res.render("constitution");
});

app.get("/bell", (req, res) => {
  res.render("bell");
});

app.get("/copyright", (req, res) => {
  res.render("copyrights");
});

app.get("/join", (req, res) => {
  res.render("join");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/members", requireAuth, (req, res) => {
  res.render("members");
});




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