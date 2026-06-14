const db = require("./db");



/*
const report = {
  category: "Dreams & Precognition",
  title: "Spontaneous out of body experience",
  author: "Brian",
  email: "greycoded222@gmail.com",
  age: "26",
  sex: "Male",
  eventDate: "2025-05-05",
  location: "Houston, Texas",
  witnesses: "Only Me",

  duration: null,
  weather: null,
  timeOfDay: null,
  effects: null,
  alternativeExplanations: null,

  report: `
I was into meditation to help with PTSD from the military. I was practicing for a few months. One night I couldn’t sleep at night, I felt restless. So I decided to meditate to calm my mind down and hopefully sleep. As I was in my “flow state” in meditation. I felt I was falling asleep, then I felt as if I was moving extremely fast and I was in a lucid dream. I specifically thought “I’m gonna look for key features, I feel like this place is real”. So I crossed a street looked for street signs, couldn’t see any. Saw a big building, thought to myself “looks like a furniture store or something”. Saw a red truck. Went up to it. I see there’s 3 men in the truck. I knock on the window then kicked the door because I got no response after the first knock. Big burly bearded guy rolls down the window. The radio in the truck was really loud and I couldn’t understand it, it seemed like it was in a foreign language. I asked a series of questions to the man. What is the history, name, of this place? Name of the building? All I was able to get out of the words he was saying was “longsfolg” then I felt I was gonna wake up and I did.

I couldn’t find a place of that name but after about a month, I thought to try typing into ChatGPT “what is a real place that sounds like longsfolg?” It came back with Longford Ireland. I’ve never been in Europe before. I looked up the place on maps, zoomed into a random spot and that was literally where I was. There was even the furniture store there.
  `.trim(),

  additionalNotes:
    "This experience changed my perception on reality and I feel was a catalyst to my spiritual journey and to remote viewing.",

  files: null,
  status: "Pending",
};

// Insert statement
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
    duration,
    weather,
    timeOfDay,
    effects,
    report,
    alternativeExplanations,
    additionalNotes,
    files,
    status
  ) VALUES (
    @category,
    @title,
    @author,
    @email,
    @age,
    @sex,
    @eventDate,
    @location,
    @witnesses,
    @duration,
    @weather,
    @timeOfDay,
    @effects,
    @report,
    @alternativeExplanations,
    @additionalNotes,
    @files,
    @status
  )
`);

stmt.run(report);

console.log("Report inserted successfully");


/*





/* 
db.prepare(`DELETE FROM reports`).run();
db.prepare(`
  DELETE FROM sqlite_sequence
  WHERE name = 'reports'
`).run();

console.log("Reports table reset.");



const users = db
  .prepare("SELECT * FROM users")
  .all();

*/


  const reports = db
  .prepare(`
    SELECT
      id,
      title,
      author,
      category,
      createdAt
    FROM reports
    ORDER BY createdAt DESC
  `)
  .all();

console.log(reports);
//console.log(users);