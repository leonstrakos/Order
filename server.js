const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const db = require("./db");
const helmet = require("helmet");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);

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
      secure: true,
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
  res.sendFile(path.join(__dirname, "views", "home.html"));
});

app.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "about.html"));
});

app.get("/bell", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "bell.html"));
});

app.get("/copyright", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "copyrights.html"));
});

app.get("/join", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "join.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
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

app.get("/members", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "members.html"));
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

app.listen(PORT, () => {
  console.log(`⚜ Server running at http://localhost:${PORT}`);
});