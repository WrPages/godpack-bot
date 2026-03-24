const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require("discord.js");

const fetch = require("node-fetch");

const ALLOWED_CHANNEL_ID = "1483616248406474832";
const STATS_CHANNEL_ID = "1485756209519788063";

const GIST_ID = process.env.GIST_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const FILE_NAME = "gp_record.txt";

// 🔥 GIST DE USUARIOS REGISTRADOS (EL MISMO QUE USAS EN INDEX)
const USERS_GIST_ID = "312803a8e6964070593081d99a705d19";

// 🔥 IDS ONLINE
const IDS_GIST_RAW_URL = "https://gist.githubusercontent.com/WrPages/1fc02ff0921e82b3af1d3101cee44e4c/raw/ids.txt";

let packVotes = new Map();

let statsData = {
  currentDay: new Date().toDateString(),
  todayCount: 0,
  lastFiveDays: [],
  statsMessageId: null
};

async function getOnlineIDs() {
  try {
    const res = await fetch(IDS_GIST_RAW_URL + "?t=" + Date.now());
    const text = await res.text();
    return text.split("\n").map(x => x.trim()).filter(x => x.length > 0);
  } catch (err) {
    console.error("Error leyendo ids.txt:", err);
    return [];
  }
}

async function getUsers() {
  try {
    const res = await fetch(`https://api.github.com/gists/${USERS_GIST_ID}?t=${Date.now()}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Cache-Control": "no-cache"
      }
    });

    const data = await res.json();
    if (!data.files || !data.files["users.json"]) return {};
    return JSON.parse(data.files["users.json"].content || "{}");
  } catch (err) {
    console.error("Error loading users:", err);
    return {};
  }
}