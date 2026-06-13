



const db = require("./db");



function createAdmin() {

  const email = "heraldasdasdsofthelion@gmail.com";



  const existing = db

    .prepare("SELECT id FROM users WHERE email = ?")

    .get(email);



  if (existing) {

    console.log("Admin already exists.");

    return;

  }



  db.prepare(`

    INSERT INTO users (

      chosen_name,

      email,

      password_hash,

      role

    )

    VALUES (?, ?, ?, ?)

  `).run(

    "Lekistra",

    email,

    "$2b$10$4T1ZhOwhiWJzn8SSdRaBN.VIENuIBw7V7nu8..61r2MWePrECaRE2",

    "admin"

  );



  console.log("Admin created successfully.");

}



createAdmin();