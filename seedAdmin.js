const bcrypt = require("bcrypt");
const db = require("./db");

const chosenName = "Lekistra";
const email = "leondrewop@gmail.com";
const password = "Campana";

try {

  console.log("Checking database...");

  const existingUser = db
    .prepare(`
      SELECT *
      FROM users
      WHERE email = ?
      OR chosen_name = ?
    `)
    .get(email, chosenName);

  if (existingUser) {
    console.log("User already exists:");
    console.log(existingUser);
    process.exit(0);
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users (
      chosen_name,
      email,
      password_hash,
      role
    )
    VALUES (?, ?, ?, ?)
  `).run(
    chosenName,
    email,
    passwordHash,
    "admin"
  );

  console.log("================================");
  console.log("ADMIN CREATED");
  console.log("================================");
  console.log("Username:", chosenName);
  console.log("Email:", email);
  console.log("Password:", password);
  console.log("================================");

  const user = db
    .prepare(`
      SELECT *
      FROM users
      WHERE email = ?
    `)
    .get(email);

  console.log("Stored user:");
  console.log(user);

  const passwordOk = bcrypt.compareSync(
    password,
    user.password_hash
  );

  console.log("Password test:", passwordOk);

} catch (err) {

  console.error("SEED FAILED");
  console.error(err);

}