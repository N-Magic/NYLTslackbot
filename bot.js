const { App } = require("@slack/bolt");
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3");
require("dotenv").config();

const adminID = "U07PGNGH4LD"; // Me
const modIDs = ["U07PGNGH4LD", "U07NED2FV7V", "U07N9B0NBP0", "U07PK78J8S2"];

const allowedFileNames = [
  "Communication1",
  "Communication2",
  "Communication3",
  "Communication4",
  "Communication5",
  "Communication6",
  "Developing",
  "Diversity",
  "Embracing",
  "Ethics",
  "Finding",
  "Leading",
  "Planning",
  "Resilience",
  "Resolving",
  "Scouting",
  "Servant",
  "Setting",
  "Solving",
  "Syllabus",
  "Fundamentals",
];

const db = new sqlite3.Database("./slackbot.db", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log("Connected to SQLite database.");
  }
});
function initializeDB() {
  db.run(
    `
    CREATE TABLE IF NOT EXISTS scouts (
      id TEXT PRIMARY KEY,
      name TEXT
    )
  `,
    (err) => {
      if (err) {
        console.error("Error creating scouts table:", err.message);
      } else {
        console.log("Scouts table created or already exists.");
      }
    },
  );
  db.run(
    `
    CREATE TABLE IF NOT EXISTS presentations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      scout1_id TEXT NOT NULL,
      scout2_id TEXT NOT NULL,
      time INTEGER,
      scores TEXT,
      FOREIGN KEY (scout1_id) REFERENCES scouts (id),
      FOREIGN KEY (scout2_id) REFERENCES scouts (id)
    )
  `,
    (err) => {
      if (err) {
        console.error("Error creating presentations table:", err.message);
      } else {
        console.log("Presentations table created or already exists.");
      }
    },
  );
}
initializeDB();
function addScout(id, name) {
  const sql = `
    INSERT INTO scouts (id, name)
    VALUES (?, ?)
  `;
  db.run(sql, [id, name], function (err) {
    if (err) {
      console.error("Error adding scout:", err.message);
    } else {
      printAllScouts();
    }
  });
}
function addPresentation(title, scout1, scout2) {
  const sql = `
    INSERT INTO presentations (title, scout1_id, scout2_id)
    VALUES (?, ?, ?)
  `;
  db.run(sql, [title, scout1, scout2], function (err) {
    if (err) {
      console.error("Error adding presentation:", err.message);
    } else {
      console.log("Presentation successfully added");
    }
  });
}
function addScore(title, score) {
  const sql = `
    UPDATE presentations
    SET scores = CASE
      WHEN scores IS NULL OR scores = '' THEN ?
      ELSE scores || ',' || ?
    END
    WHERE title = ?;
  `;
  db.run(sql, [score, score, title], function (err) {
    if (err) {
      console.error("Error adding score to presentation: ", err.message);
    } else {
      console.log("Score added successfully");
    }
  });
}
function getPresentationsByScout(scoutId, callback) {
  const sql = `
    SELECT * FROM presentations
    WHERE scout1_id = ? OR scout2_id = ?
  `;

  db.all(sql, [scoutId, scoutId], (err, rows) => {
    if (err) {
      console.error("Error fetching presentations for scout:", err.message);
      callback(err, null);
    } else {
      callback(null, rows);
    }
  });
}

function printAllScouts() {
  const sql = "SELECT * FROM scouts";

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("Error fetching scouts:", err.message);
    } else {
      console.log("Scouts:");
      rows.forEach((row) => {
        console.log(`ID: ${row.id}, Name: ${row.name}`);
      });
    }
  });
}
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});
app.message("!Scouts", async ({ message, say }) => {
  console.log("Someone asked for scouts");
  const scoutList = await new Promise((resolve, reject) => {
    const sql = "SELECT * FROM scouts";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Error fetching scouts:", err.message);
        reject(err);
      } else {
        console.log("Scouts:");
        const names = rows.map((row) => row.name);
        resolve(names);
      }
    });
  });
  for (let i = 0; i < scoutList.length; i++) {
    await say(`Scout ${i + 1} is ${scoutList[i]}`);
  }
});
app.message("!AddScout", async ({ message, say }) => {
  if (message.user !== adminID) {
    await say("Access Denied: You do not have permission to use this command.");
    return;
  }
  parts = message.text.split(" ");
  if (parts.length != 3) {
    await say("Pardon me mister you need to attach name and user");
    return;
  }
  let name = parts[1];
  let id = parts[2].slice(2, -1);
  addScout(id, name);
  await say(`Scout ${name} has been added successfuly with an id of ${id}`);
});
app.message("!DeleteScout", async ({ message, say }) => {
  if (message.user !== adminID) {
    await say("Access Denied: You do not have permission to use this command.");
    return;
  }
  const scoutName = message.text.split(" ")[1];
  if (!scoutName) {
    await say("Please provide the name of the scout you want to delete.");
    return;
  }
  console.log(`Attempting to delete scout: ${scoutName}`);
  try {
    await new Promise((resolve, reject) => {
      const sql = "DELETE FROM scouts WHERE name = ?";
      db.run(sql, [scoutName], function (err) {
        if (err) {
          console.error("Error deleting scout:", err.message);
        } else {
          if (this.changes === 0) {
            reject(new Error("Scout not found"));
          } else {
            console.log(`Scout ${scoutName} deleted.`);
            resolve();
          }
        }
      });
    });

    await say(`Scout "${scoutName}" has been deleted.`);
  } catch (err) {
    console.error("Error:", err.message);
    await say(
      "There was an error deleting the scout. Please make sure the name is correct.",
    );
  }
});
app.message("!Presentations", async ({ message, say }) => {
  const sql = `SELECT title, scores FROM presentations`;

  try {
    const presentations = await new Promise((resolve, reject) => {
      db.all(sql, [], (err, rows) => {
        if (err) {
          console.error("Error fetching presentations:", err.message);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
    const sortedPresentations = presentations.map((row) => {
      let averageScore = 0;

      if (row.scores) {
        const scores = row.scores.split(",").map(Number);
        const recentScores = scores.slice(-5);
        averageScore =
          recentScores.reduce((sum, score) => sum + score, 0) /
          recentScores.length;
      }
      return { title: row.title, averageScore: averageScore || 0 };
    });
    sortedPresentations.sort((a, b) => a.averageScore - b.averageScore);
    const responseText = sortedPresentations
      .map(
        (presentation, index) =>
          `*${index + 1}. ${presentation.title}*: Average Score: ${presentation.averageScore.toFixed(
            1,
          )}`,
      )
      .join("\n");
    await say({
      text: "Presentations sorted by average score (low to high):",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Presentations Sorted by Average Score (Low to High):*\n${responseText}`,
          },
        },
      ],
    });
  } catch (error) {
    console.error("Error in !Presentations command:", error.message);
    await say(
      "There was an error fetching or processing the presentations. Please try again later.",
    );
  }
});
app.message("!MyPresentations", async ({ message, say }) => {
  getPresentationsByScout(message.user, async (err, presentations) => {
    if (err) {
      await say("An error occurred while fetching your presentations.");
      return;
    }

    if (presentations.length === 0) {
      await say(
        "Whoops, haven't added your presentations yet - or you are an adult",
      );
    } else {
      const responseText = presentations
        .map(
          (p, index) =>
            `${index + 1}. *${p.title}* - Scores: ${
              p.scores || "No scores yet"
            }`,
        )
        .join("\n");

      await say(`Your presentations:\n${responseText}`);
    }
  });
});

app.message("!AddPresentation", async ({ message, say }) => {
  if (message.user !== adminID) {
    await say("Access Denied: You do not have permission to use this command.");
    return;
  }
  parts = message.text.split(" ");
  if (parts.length != 4) {
    await say(
      "Make sure you use syntax !AddPresentation Title Scout1 Scout2, using only the first word, and pinging the two scouts",
    );
  }
  let title = parts[1];
  let scout1 = parts[2].slice(2, -1);
  let scout2 = parts[3].slice(2, -1);
  addPresentation(title, scout1, scout2);
});
app.message("!Flip", async ({ message, say }) => {
  let flip = Math.floor(Math.random() * 2);
  if (flip == 0) {
    await say("Heads");
  } else if (flip == 1) {
    await say("Tails");
  }
});
app.message("!Roll", async ({ message, say }) => {
  parts = message.text.split(" ");
  if (parts.length == 3) {
    if (parts[1] == 1) {
      await say(
        `You rolled ${parts[1]}d${parts[2]}, to get ${Math.floor(Math.random() * parts[2] + 1)}`,
      );
    } else {
      let returnString = `You rolled ${parts[1]}d${parts[2]}, to get `;
      let numbers = [];
      let total = 0;
      for (let i = 0; i < parts[1]; i++) {
        numbers.push(Math.floor(Math.random() * parts[2] + 1));
        total += numbers[i];
      }
      returnString += String(total);
      returnString += ", composed of";
      for (let i = 0; i < numbers.length; i++) {
        returnString += ", " + String(numbers[i]);
      }
      await say(returnString);
    }
  } else {
    await say(
      "To use Roll please type !Roll, the number of dice, and then how many sides per die",
    );
    await say("To roll one six sided dice, use !Roll 1 6");
  }
});
app.message("!Rate", async ({ message, say }) => {
  parts = message.text.split(" ");
  if (!modIDs.includes(message.user)) {
    await say(
      "You are not allowed to use this command, if you believe this to be an error contact Nate Martin",
    );
    return;
  }
  if (parts.length != 3) {
    await say(
      "You have entered in the incorrect amount of arguments, please phrase command as !Rate Presentation Score",
    );
    return;
  }
  if (!allowedFileNames.includes(parts[1])) {
    await say(
      "Hey, you have mentioned a presentation that is not in the database - please check your spelling, and then contact Nate",
    );
  }
  let score = parseFloat(parts[2]);
  addScore(parts[1], score);
  await say(
    `You have successfully rated the presentation ${parts[1]} ${parts[2]}`,
  );
});
app.message("!Fetch", async ({ message, say }) => {
  // say() sends a message to the channel where the event was triggered
  await say(`Hey there <@${message.user}>!`);
  parts = message.text.split(" ");
  if (parts.length == 1) {
    await say(`To fetch a presentation, include the name in the command`);
    returnString = "Options include";
    for (let i = 0; i < allowedFileNames.length; i++) {
      returnString += ", " + allowedFileNames[i];
    }
    await say(returnString);
    return;
  }
  let fileName = parts[1];
  if (!allowedFileNames.includes(fileName)) {
    await say(
      `Hey man, your message didn't include a valid filename. Make sure you only use the first word of it, like Ethics or Scouting.`,
    );
    return;
  }
  fileName += ".pdf";
  let filePath = path.join(__dirname, "Presentations", fileName);
  try {
    await app.client.files.uploadV2({
      channel_id: message.channel,
      file: fs.createReadStream(filePath),
      filename: fileName,
      title: fileName,
    });
  } catch (error) {
    await say(`Error of ${error} hath occured`);
  }
});

app.message("!Help", async ({ message, say }) => {
  const commands = [
    { command: "!Help", description: "Displays this help message." },
    { command: "!Scouts", description: "Lists all scouts in the database." },
    {
      command: "!AddScout [name] [@user]",
      description: "Adds a new scout (admin only).",
    },
    {
      command: "!DeleteScout [name]",
      description: "Deletes a scout by name (admin only).",
    },
    {
      command: "!Presentations",
      description: "Lists all presentations and their average scores.",
    },
    {
      command: "!AddPresentation [title] [@scout1] [@scout2]",
      description: "Adds a new presentation (admin only).",
    },
    {
      command: "!Rate [title] [score]",
      description:
        "Rates a presentation with a score (moderators only, score 0-10).",
    },
    {
      command: "!Fetch [filename]",
      description: "Fetches a presentation file by name (e.g., !Fetch Ethics).",
    },
    {
      command: "!Roll [dice] [sides]",
      description: "Rolls dice (e.g., !Roll 2 6 for 2d6).",
    },
    {
      command: "!Flip",
      description: "Flips a coin (Heads or Tails).",
    },
  ];

  // Format the commands for display
  const commandList = commands
    .map((cmd) => `• *${cmd.command}*: ${cmd.description}`)
    .join("\n");

  await say({
    text: "Available commands for the bot:",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Available Commands:*\n${commandList}`,
        },
      },
    ],
  });
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);

  app.logger.info("⚡️ Bolt app is running!");
})();
