const { App } = require("@slack/bolt");
const sqlite3 = require("sqlite3");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
let massiveButtonClicked = 0;

// Initialize Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

// Initialize SQLite database
const db = new sqlite3.Database("./slackbot.db", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log("Connected to SQLite database.");
    initializeDB();
  }
});

// Banned words list
const bannedWords = ["bitch", "titties", "cunt", "fuck"]; // Add your list of banned words here

// Allowed file names for presentations
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

// Database schema initialization
function initializeDB() {
  db.run(
    `
    CREATE TABLE IF NOT EXISTS Scouts (
      ID TEXT PRIMARY KEY,
      FirstName TEXT NOT NULL,
      LastName TEXT NOT NULL,
      Role TEXT,
      Access INTEGER DEFAULT 1
    )
  `,
    (err) => {
      if (err) {
        console.error("Error creating Scouts table:", err.message);
      } else {
        console.log("Scouts table created or already exists.");
      }
    },
  );

  db.run(
    `
    CREATE TABLE IF NOT EXISTS Presentations (
      ID INTEGER PRIMARY KEY AUTOINCREMENT,
      Name TEXT NOT NULL,
      FileName TEXT NOT NULL,
      Scout1 TEXT NOT NULL,
      Scout2 TEXT NOT NULL,
      Time INTEGER,
      Scores TEXT,
      FOREIGN KEY (Scout1) REFERENCES Scouts(ID),
      FOREIGN KEY (Scout2) REFERENCES Scouts(ID)
    )
  `,
    (err) => {
      if (err) {
        console.error("Error creating Presentations table:", err.message);
      } else {
        console.log("Presentations table created or already exists.");
      }
    },
  );
}

// Check user access level
function checkAccessLevel(userId, requiredLevel, callback) {
  const sql = `
    SELECT Access FROM Scouts
    WHERE ID = ?
  `;
  db.get(sql, [userId], (err, row) => {
    if (err) {
      console.error("Error checking access level:", err.message);
      callback(err, null);
    } else if (!row) {
      callback(new Error("User not found in database."), null);
    } else {
      const userAccessLevel = row.Access;
      callback(null, userAccessLevel >= requiredLevel);
    }
  });
}

// Add a scout to the database
function addScout(id, firstName, lastName, role, access) {
  const sql = `
    INSERT INTO Scouts (ID, FirstName, LastName, Role, Access)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.run(sql, [id, firstName, lastName, role, access], function (err) {
    if (err) {
      console.error("Error adding scout:", err.message);
    } else {
      console.log(`Scout ${firstName} ${lastName} added successfully.`);
    }
  });
}

// Add a presentation to the database
function addPresentation(name, fileName, scout1, scout2) {
  const sql = `
    INSERT INTO Presentations (Name, FileName, Scout1, Scout2)
    VALUES (?, ?, ?, ?)
  `;
  db.run(sql, [name, fileName, scout1, scout2], function (err) {
    if (err) {
      console.error("Error adding presentation:", err.message);
    } else {
      console.log(`Presentation "${name}" added successfully.`);
    }
  });
}

// Add a score to a presentation
function addScore(title, score) {
  const sql = `
    UPDATE Presentations
    SET scores = CASE
      WHEN scores IS NULL OR scores = '' THEN ?
      ELSE scores || ',' || ?
    END
    WHERE Name = ?;
  `;
  db.run(sql, [score, score, title], function (err) {
    if (err) {
      console.error("Error adding score to presentation: ", err.message);
    } else {
      console.log("Score added successfully");
    }
  });
}

// Get presentations by scout
function getPresentationsByScout(scoutId, callback) {
  const sql = `
    SELECT * FROM Presentations
    WHERE Scout1 = ? OR Scout2 = ?
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

// Handle banned words
async function handleBannedWord(message, say) {
  const userId = message.user;

  // Warn the user
  await say({
    text: `Hey <@${userId}>, your message contained inappropriate content, please refrain from using such language.`,
    channel: message.channel,
  });

  // Log the incident (optional)
  console.log(
    `Banned word detected from user ${userId} in channel ${message.channel}.`,
  );
}
async function handleMassive(message, say) {
  massiveButtonClicked = 0;
  await say({
    text: `Massive? You know what else is massive?`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Massive? You know what else is massive?`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Click Me",
              emoji: true,
            },
            action_id: "massive_button_click", // Unique action ID for the button
          },
        ],
      },
    ],
  });
}

// Handle button click
app.action("massive_button_click", async ({ ack, say }) => {
  await ack(); // Acknowledge the button click
  if (massiveButtonClicked <= 2) {
    massiveButtonClicked += 1;
    await say("LOWWWW TAPPPEEERRRRR FADE");
  }
});
// Handle commands
async function handleCommand(message, say) {
  const text = message.text; // Use original text for case-sensitive command parsing
  const parts = text.split(" ");
  const command = parts[0]; // Extract the command (e.g., "!AddScout")

  // Route commands to their respective handlers
  switch (command) {
    case "!AddScout":
      await handleAddScout(message, say);
      break;
    case "!AddPresentation":
      await handleAddPresentation(message, say);
      break;
    case "!Scouts":
      await handleListScouts(message, say);
      break;
    case "!Presentations":
      await handleListPresentations(message, say);
      break;
    case "!MyPresentations":
      await handleMyPresentations(message, say);
      break;
    case "!Rate":
      await handleRate(message, say);
      break;
    case "!Fetch":
      await handleFetch(message, say);
      break;
    case "!Flip":
      await handleFlip(message, say);
      break;
    case "!Gamble":
      await handleGamble(message, say);
      break;
    case "!Spam":
      await handleSpam(message, say);
      break;
    case "!Roll":
      await handleRoll(message, say);
      break;
    case "!Help":
      await handleHelp(message, say);
      break;
    default:
      await say(
        `Unknown command: ${command}. Type !Help for a list of commands.`,
      );
      break;
  }
}

// Command: Add Scout
async function handleAddScout(message, say) {
  const userId = message.user;

  // Check if the user has Access Level 5
  checkAccessLevel(userId, 5, async (err, hasAccess) => {
    if (err) {
      console.error("Error checking access level:", err.message);
      await say(
        "An error occurred while checking your permissions. Please try again later.",
      );
      return;
    }

    if (!hasAccess) {
      await say(
        "Access Denied: You do not have permission to use this command.",
      );
      return;
    }

    // Parse the command arguments
    const parts = message.text.split(" ");
    if (parts.length !== 6) {
      await say(
        "Usage: !AddScout [FirstName] [LastName] [Role] [Access] [@user]",
      );
      return;
    }

    const firstName = parts[1];
    const lastName = parts[2];
    const role = parts[3];
    const access = parseInt(parts[4], 10);
    const newUserId = parts[5].slice(2, -1); // Extract Slack user ID from mention

    // Add the scout to the database
    addScout(newUserId, firstName, lastName, role, access);
    await say(`Scout ${firstName} ${lastName} added successfully.`);
  });
}

// Command: Add Presentation
async function handleAddPresentation(message, say) {
  const userId = message.user;

  // Check if the user has Access Level 5
  checkAccessLevel(userId, 5, async (err, hasAccess) => {
    if (err) {
      console.error("Error checking access level:", err.message);
      await say(
        "An error occurred while checking your permissions. Please try again later.",
      );
      return;
    }

    if (!hasAccess) {
      await say(
        "Access Denied: You do not have permission to use this command.",
      );
      return;
    }

    // Parse the command arguments
    const parts = message.text.split(" ");
    if (parts.length !== 5) {
      await say(
        "Usage: !AddPresentation [Name] [FileName] [@scout1] [@scout2]",
      );
      return;
    }

    const name = parts[1];
    const fileName = parts[2];
    const scout1 = parts[3].slice(2, -1); // Extract Slack user ID from mention
    const scout2 = parts[4].slice(2, -1); // Extract Slack user ID from mention

    // Add the presentation to the database
    addPresentation(name, fileName, scout1, scout2);
    await say(`Presentation "${name}" added successfully.`);
  });
}

// Command: List Scouts
async function handleListScouts(message, say) {
  const sql = "SELECT * FROM Scouts";
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("Error fetching scouts:", err.message);
      say("An error occurred while fetching scouts. Please try again later.");
    } else {
      const scoutList = rows
        .map((row) => `${row.FirstName} ${row.LastName}`)
        .join("\n");
      say(`Scouts:\n${scoutList}`);
    }
  });
}

// Command: List Presentations
async function handleListPresentations(message, say) {
  const sql = "SELECT * FROM Presentations";
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("Error fetching presentations:", err.message);
      say(
        "An error occurred while fetching presentations. Please try again later.",
      );
    } else {
      const presentationList = rows
        .map(
          (row) =>
            `${row.Name} (${row.FileName}) - Scouts: ${row.Scout1}, ${row.Scout2}`,
        )
        .join("\n");
      say(`Presentations:\n${presentationList}`);
    }
  });
}

// Command: My Presentations
async function handleMyPresentations(message, say) {
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
            `${index + 1}. *${p.Name}* - Scores: ${p.scores || "No scores yet"}`,
        )
        .join("\n");

      await say(`Your presentations:\n${responseText}`);
    }
  });
}

// Command: Rate Presentation
async function handleRate(message, say) {
  const parts = message.text.split(" ");
  const userId = message.user;

  // Check if the user has Access Level 3 or higher
  checkAccessLevel(userId, 3, async (err, hasAccess) => {
    if (err) {
      console.error("Error checking access level:", err.message);
      await say(
        "An error occurred while checking your permissions. Please try again later.",
      );
      return;
    }

    if (!hasAccess) {
      await say(
        "Access Denied: You do not have permission to use this command.",
      );
      return;
    }

    if (parts.length !== 3) {
      await say("Usage: !Rate [PresentationName] [Score]");
      return;
    }

    const presentationName = parts[1];
    const score = parseFloat(parts[2]);

    if (!allowedFileNames.includes(presentationName)) {
      await say(
        "Invalid presentation name. Please check the list of allowed presentations.",
      );
      return;
    }

    if (isNaN(score)) {
      await say("Invalid score. Please provide a number.");
      return;
    }

    addScore(presentationName, score);
    await say(
      `Presentation "${presentationName}" rated with a score of ${score}.`,
    );
  });
}

// Command: Fetch Presentation
async function handleFetch(message, say) {
  const parts = message.text.split(" ");
  if (parts.length !== 2) {
    await say("Usage: !Fetch [PresentationName]");
    return;
  }

  const fileName = parts[1];
  if (!allowedFileNames.includes(fileName)) {
    await say(
      "Invalid presentation name. Please check the list of allowed presentations.",
    );
    return;
  }

  const filePath = path.join(__dirname, "Presentations", `${fileName}.pdf`);
  try {
    await app.client.files.uploadV2({
      channel_id: message.channel,
      file: fs.createReadStream(filePath),
      filename: `${fileName}.pdf`,
      title: fileName,
    });
  } catch (error) {
    await say(`Error uploading file: ${error.message}`);
  }
}

// Command: Flip a Coin
async function handleFlip(message, say) {
  const flip = Math.floor(Math.random() * 2);
  await say(flip === 0 ? "Heads" : "Tails");
}

// Command: Gamble
async function handleGamble(message, say) {
  const userId = message.user;
  if (userId === process.env.ADMIN_ID) {
    await say("You win!");
  } else {
    await say("Guys, we are not allowed to gamble!");
  }
}

// Command: Spam
async function handleSpam(message, say) {
  const userId = message.user;

  // Check if the user has Access Level 5
  checkAccessLevel(userId, 5, async (err, hasAccess) => {
    if (err) {
      console.error("Error checking access level:", err.message);
      await say(
        "An error occurred while checking your permissions. Please try again later.",
      );
      return;
    }

    if (!hasAccess) {
      await say(
        "Access Denied: You do not have permission to use this command.",
      );
      return;
    }

    const parts = message.text.split(" ");
    if (parts.length !== 2) {
      await say("Usage: !Spam [NumberOfTimes]");
      return;
    }

    const times = parseInt(parts[1], 10);
    if (isNaN(times)) {
      await say("Invalid number of times. Please provide a number.");
      return;
    }

    for (let i = 0; i < times; i++) {
      await say("Spam");
    }
  });
}

// Command: Roll Dice
async function handleRoll(message, say) {
  const parts = message.text.split(" ");
  if (parts.length !== 3) {
    await say("Usage: !Roll [NumberOfDice] [NumberOfSides]");
    return;
  }

  const numberOfDice = parseInt(parts[1], 10);
  const numberOfSides = parseInt(parts[2], 10);

  if (isNaN(numberOfDice) || isNaN(numberOfSides)) {
    await say("Invalid input. Please provide numbers for both dice and sides.");
    return;
  }

  const rolls = [];
  let total = 0;
  for (let i = 0; i < numberOfDice; i++) {
    const roll = Math.floor(Math.random() * numberOfSides) + 1;
    rolls.push(roll);
    total += roll;
  }

  await say(
    `You rolled ${numberOfDice}d${numberOfSides}: ${rolls.join(", ")} (Total: ${total})`,
  );
}

// Command: Help
async function handleHelp(message, say) {
  const commands = [
    { command: "!Help", description: "Displays this help message." },
    { command: "!Scouts", description: "Lists all scouts in the database." },
    {
      command: "!AddScout [FirstName] [LastName] [Role] [Access] [@user]",
      description: "Adds a new scout (admin only).",
    },
    {
      command: "!AddPresentation [Name] [FileName] [@scout1] [@scout2]",
      description: "Adds a new presentation (admin only).",
    },
    {
      command: "!Presentations",
      description: "Lists all presentations and their details.",
    },
    {
      command: "!MyPresentations",
      description: "Lists your presentations and scores.",
    },
    {
      command: "!Rate [PresentationName] [Score]",
      description: "Rates a presentation (moderators only).",
    },
    {
      command: "!Fetch [PresentationName]",
      description: "Fetches a presentation file by name.",
    },
    {
      command: "!Flip",
      description: "Flips a coin (Heads or Tails).",
    },
    {
      command: "!Gamble",
      description: "Gamble with the bot.",
    },
    {
      command: "!Spam [NumberOfTimes]",
      description: "Spams the channel (admin only).",
    },
    {
      command: "!Roll [NumberOfDice] [NumberOfSides]",
      description: "Rolls dice (e.g., !Roll 2 6 for 2d6).",
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
}

// Central message handler
app.message(async ({ message, say }) => {
  const text = message.text; // Use original text for command handling
  const lowerText = text.toLowerCase(); // Use lowercase for curse word detection
  const userId = message.user;

  // Check for banned words
  const containsBannedWord = bannedWords.some((word) =>
    lowerText.includes(word),
  );
  if (containsBannedWord) {
    await handleBannedWord(message, say);
    return; // Stop further processing
  }
  const containsMassive = lowerText.includes("massive");
  if (containsMassive) {
    await handleMassive(message, say);
    return; // Stop further processing
  }

  // Check if the message is a command
  if (text.startsWith("!")) {
    await handleCommand(message, say);
  }
});

// Start the app
(async () => {
  await app.start(process.env.PORT || 3000);
  console.log("⚡️ Bolt app is running!");
})();
