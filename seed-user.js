const bcrypt = require("bcrypt");
const db = require("./db");

const chosenName = "";
const email = "";
const plainPassword = ""; 

const existing = db
  .prepare("SELECT id FROM users WHERE email = ?")
  .get(email);

if (existing) {
  console.log("User already exists.");
  process.exit(0);
}

const passwordHash = bcrypt.hashSync(plainPassword, 10);

db.prepare(`
  INSERT INTO users (chosen_name, email, password_hash, role)
  VALUES (?, ?, ?, ?)
`).run(chosenName, email, passwordHash, "admin");

console.log("Seed user created:");
console.log(`Email: ${email}`);
console.log(`Password: ${plainPassword}`);