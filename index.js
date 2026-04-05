const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js")

const fetch = require("node-fetch")
const fs = require("fs")

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

// ================= ENV =================
const TOKEN = process.env.TOKEN
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

if (!TOKEN) {
  console.error("❌ TOKEN no definido en environment variables")
  process.exit(1)
}

const API_URL = "https://add-ids.netlify.app/.netlify/functions/api"

// ================= IDS =================
const HEARTBEAT_CHANNEL_ID = "1483616146996465735"
const TOTAL_CHANNEL_ID = "1484416376436424794"

const HISTORY_FILE = "./ppm_history.json"
const SCHEDULE_FILE = "./daily_schedules.json"
const TWELVE_HOURS = 12 * 60 * 60 * 1000

// ================= GROUP CONFIG =================
const GROUP_CONFIG = {
  Trainer: {
    USERS_FILENAME: "trainer_users.json",
    USERS_GIST_ID: "1c066922bc39ac136b6f234fad6d9420",
    IDS_GIST_ID: "4edcf4d341cd4f7d5d0fb8a50f8b8c3c"
  },
  Gym_Leader: {
    USERS_FILENAME: "gym_users.json",
    USERS_GIST_ID: "a3f5f3d8a2e6ddf2378fb3481dff49f6",
    IDS_GIST_ID: "e110c37b3e0b8de83a33a1b0a5eb64e8"
  },
  Elite_Four: {
    USERS_FILENAME: "elite_users.json",
    USERS_GIST_ID: "bb18eda2ea748723d8fe0131dd740b70",
    IDS_GIST_ID: "d9db3a72fed74c496fd6cc830f9ca6e9"
  }
}

// ================= UTIL =================
function getUserGroup(interaction) {
  const role = interaction.member.roles.cache.find(r =>
    Object.keys(GROUP_CONFIG).includes(r.name)
  )
  return role ? role.name : null
}

// ================= GIST =================
async function getUsers(gistId, fileName) {
  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}?t=${Date.now()}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`
      }
    })

    const data = await res.json()
    return JSON.parse(data.files[fileName]?.content || "{}")
  } catch {
    return {}
  }
}

async function saveUsers(users, gistId, fileName) {
  await fetch(`https://api.github.com/gists/${gistId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`
    },
    body: JSON.stringify({
      files: {
        [fileName]: {
          content: JSON.stringify(users, null, 2)
        }
      }
    })
  })
}

// ================= VIP =================
async function addVipID(id) {
  const gistId = process.env.VIP_GIST_ID
  if (!gistId) return

  const res = await fetch(`https://api.github.com/gists/${gistId}`)
  const data = await res.json()

  let content = data.files["vip_ids.txt"]?.content || ""
  const ids = content.split("\n").filter(Boolean)

  if (!ids.includes(id)) {
    ids.push(id)

    await fetch(`https://api.github.com/gists/${gistId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
      body: JSON.stringify({
        files: {
          "vip_ids.txt": { content: ids.join("\n") }
        }
      })
    })
  }
}

// ================= SCHEDULE =================
function loadSchedules() {
  if (!fs.existsSync(SCHEDULE_FILE)) return {}
  return JSON.parse(fs.readFileSync(SCHEDULE_FILE))
}

function saveSchedules(data) {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2))
}

function startDailyScheduler() {
  setInterval(async () => {
    const schedules = loadSchedules()
    const now = new Date()

    for (const userId in schedules) {
      const s = schedules[userId]

      if (
        now.getUTCHours() === s.online_hour &&
        now.getUTCMinutes() === s.online_minute &&
        s.last_online !== now.toDateString()
      ) {
        await fetch(`${API_URL}?action=online&id=${s.main_id}&group=${s.group}`)
        s.last_online = now.toDateString()
      }

      if (
        now.getUTCHours() === s.offline_hour &&
        now.getUTCMinutes() === s.offline_minute &&
        s.last_offline !== now.toDateString()
      ) {
        await fetch(`${API_URL}?action=offline&id=${s.main_id}&group=${s.group}`)
        s.last_offline = now.toDateString()
      }
    }

    saveSchedules(schedules)
  }, 60000)
}

// ================= PPM =================
function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return []
  return JSON.parse(fs.readFileSync(HISTORY_FILE))
}

function saveHistory(data) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(data))
}

async function updateTotalPPM() {
  try {
    const heartbeatChannel = await client.channels.fetch(HEARTBEAT_CHANNEL_ID)
    const totalChannel = await client.channels.fetch(TOTAL_CHANNEL_ID)

    const messages = await heartbeatChannel.messages.fetch({ limit: 20 })

    let totalPPM = 0

    for (const msg of messages.values()) {
      const match = msg.content.match(/Avg:\s*([\d.]+)/)
      if (match) totalPPM += parseFloat(match[1])
    }

    let history = loadHistory()
    const now = Date.now()

    history.push({ timestamp: now, value: totalPPM })
    history = history.filter(e => now - e.timestamp <= TWELVE_HOURS)

    saveHistory(history)

    const avg = history.reduce((a, b) => a + b.value, 0) / history.length

    const text = `🔥 ${totalPPM.toFixed(2)} PPM\n📊 Avg 12H: ${avg.toFixed(2)}`

    const msgs = await totalChannel.messages.fetch({ limit: 5 })
    const botMsg = msgs.find(m => m.author.id === client.user.id)

    if (botMsg) await botMsg.edit(text)
    else await totalChannel.send(text)

  } catch (err) {
    console.error("PPM error:", err)
  }
}

// ================= READY =================
client.on("clientReady", async () => {
  console.log("🔥 READY DISPARADO (DEPLOY)");

  startDailyScheduler()
  updateTotalPPM()
  setInterval(updateTotalPPM, 5 * 60 * 1000)

  const commands = [
    new SlashCommandBuilder()
      .setName("register")
      .setDescription("Register your main ID")
      .addStringOption(o =>
        o.setName("id")
          .setDescription("Your 16 digit ID")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("online")
      .setDescription("Set your account online"),

    new SlashCommandBuilder()
      .setName("offline")
      .setDescription("Set your account offline"),

    new SlashCommandBuilder()
      .setName("gp")
      .setDescription("Add VIP ID")
      .addStringOption(o =>
        o.setName("id")
          .setDescription("16 digit ID")
          .setRequired(true)
      )
  ]

  // 🔥 DEBUG
  commands.forEach(cmd => {
    if (!cmd.description) {
      console.log("❌ Comando sin descripción:", cmd.name)
    }
  })

  const rest = new REST({ version: "10" }).setToken(TOKEN)

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands.map(c => c.toJSON()) }
  )

  console.log("🚀 Commands deployed")
})

// ================= INTERACTIONS =================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return

  const group = getUserGroup(interaction)
  if (!group) return interaction.reply("❌ No group")

  const config = GROUP_CONFIG[group]

  if (interaction.commandName === "register") {
    const id = interaction.options.getString("id")

    let users = await getUsers(config.USERS_GIST_ID, config.USERS_FILENAME)

    users[interaction.user.id] = {
      main_id: id,
      name: interaction.member.displayName
    }

    await saveUsers(users, config.USERS_GIST_ID, config.USERS_FILENAME)

    return interaction.reply("✅ Registered")
  }

  if (interaction.commandName === "online") {
    let users = await getUsers(config.USERS_GIST_ID, config.USERS_FILENAME)

    const u = users[interaction.user.id]
    if (!u) return interaction.reply("❌ Register first")

    await fetch(`${API_URL}?action=online&id=${u.main_id}&group=${group}`)

    return interaction.reply("🟢 Online")
  }

  if (interaction.commandName === "offline") {
    let users = await getUsers(config.USERS_GIST_ID, config.USERS_FILENAME)

    const u = users[interaction.user.id]
    if (!u) return interaction.reply("❌ Register first")

    await fetch(`${API_URL}?action=offline&id=${u.main_id}&group=${group}`)

    return interaction.reply("🔴 Offline")
  }

  if (interaction.commandName === "gp") {
    const id = interaction.options.getString("id")
    await addVipID(id)
    return interaction.reply("🔥 VIP added")
  }
})

// ================= GP DETECTOR =================
client.on("messageCreate", async message => {
  const match = message.content.match(/\((\d{16})\)/)
  if (!match) return

  await addVipID(match[1])
})

// ================= LOGIN =================
client.login(TOKEN)
