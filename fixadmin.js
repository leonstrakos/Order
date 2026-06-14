const bcrypt = require("bcrypt");
const db = require("./db");

const hash = bcrypt.hashSync("Campana", 10);

db.prepare(`
  UPDATE users
  SET password_hash = ?
  WHERE chosen_name = ?
`).run(hash, "Lekistra");

console.log("Password fixed.");
console.log(hash);


