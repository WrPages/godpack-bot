const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js')

const fetch = require('node-fetch')
const fs = require("fs")

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

const TOKEN = process.env.TOKEN
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const API_URL = "https://add-ids.netlify.app/.netlify/functions/api"

const HISTORY_FILE = "./ppm_history.json"
const SCHEDULE_FILE = "./daily_schedules.json"
const TWELVE_HOURS = 12 * 60 * 60 * 1000

const HEARTBEAT_CHANNEL_ID = "1483616146996465735"
const TOTAL_CHANNEL_ID = "1484416376436424794"

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

// ================= HELPERS =================

function getUserGroup(interaction) {
  const role = interaction.member.roles.cache.find(r =>
    Object.keys(GROUP_CONFIG).includes(r.name)
  )
  return role ? role.name : null
}

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return []
  return JSON.parse(fs.readFileSync(HISTORY_FILE))
}

function saveHistory(data) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(data))
}

function loadSchedules() {
  if (!fs.existsSync(SCHEDULE_FILE)) return {}
  return JSON.parse(fs.readFileSync(SCHEDULE_FILE))
}

function saveSchedules(data) {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2))
}

// ================= GITHUB =================

async function getUsers(gistId, fileName) {
  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}?t=${Date.now()}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`
      }
    })

    const data = await res.json()
    return JSON.parse(data.files?.[fileName]?.content || "{}")

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

async function addVipID(id) {
  try {
    const res = await fetch(`https://api.github.com/gists/${process.env.VIP_GIST_ID}`)
    const data = await res.json()

    let content = data.files["vip_ids.txt"]?.content || ""
    let ids = content.split("\n").filter(Boolean)

    if (!ids.includes(id)) {
      ids.push(id)

      await fetch(`https://api.github.com/gists/${process.env.VIP_GIST_ID}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`
        },
        body: JSON.stringify({
          files: {
            "vip_ids.txt": {
              content: ids.join("\n")
            }
          }
        })
      })
    }
  } catch (err) {
    console.error(err)
  }
}

// ================= PPM =================

async function updateTotalPPM() {
  try {
    const heartbeatChannel = await client.channels.fetch(HEARTBEAT_CHANNEL_ID)
    const totalChannel = await client.channels.fetch(TOTAL_CHANNEL_ID)

    const messages = await heartbeatChannel.messages.fetch({ limit: 20 })

    let totalPPM = 0

    for (const msg of messages.values()) {
      if (!msg.author.bot) continue

      const match = msg.content.match(/Avg:\s*([\d.]+)/)
      if (!match) continue

      totalPPM += parseFloat(match[1])
    }

    let history = loadHistory()
    const now = Date.now()

    history.push({ timestamp: now, value: totalPPM })
    history = history.filter(x => now - x.timestamp <= TWELVE_HOURS)
    saveHistory(history)

    const avg12h = history.reduce((a, b) => a + b.value, 0) / (history.length || 1)

    const msg = `🔥 PPM: ${totalPPM.toFixed(2)}\n📊 12H Avg: ${avg12h.toFixed(2)}`

    const existing = await totalChannel.messages.fetch({ limit: 5 })
    const botMsg = existing.find(m => m.author.id === client.user.id)

    if (botMsg) await botMsg.edit(msg)
    else await totalChannel.send(msg)

  } catch (err) {
    console.error(err)
  }
}

// ================= SCHEDULER =================

function startDailyScheduler() {
  setInterval(async () => {
    const schedules = loadSchedules()
    const now = new Date()

    for (const userId in schedules) {
      const s = schedules[userId]

      if (s.online_hour === now.getUTCHours() &&
          s.online_minute === now.getUTCMinutes()) {

        await fetch(`${API_URL}?action=online&id=${s.main_id}&group=${s.group}`)
      }

      if (s.offline_hour === now.getUTCHours() &&
          s.offline_minute === now.getUTCMinutes()) {

        await fetch(`${API_URL}?action=offline&id=${s.main_id}&group=${s.group}`)
      }
    }

  }, 60000)
}

// ================= READY =================

client.once("ready", async () => {
  console.log(`✅ Bot listo como ${client.user.tag}`)

  startDailyScheduler()
  setInterval(updateTotalPPM, 5 * 60 * 1000)

  const commands = [
    new SlashCommandBuilder().setName("register").setDescription("Register ID")
      .addStringOption(o => o.setName("id").setRequired(true)),

    new SlashCommandBuilder().setName("online").setDescription("Go online"),
    new SlashCommandBuilder().setName("offline").setDescription("Go offline")
  ].map(c => c.toJSON())

  const rest = new REST({ version: "10" }).setToken(TOKEN)

  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  )

  console.log("✅ Comandos registrados")
})

// ================= INTERACTIONS =================

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return

  const group = getUserGroup(interaction)
  if (!group) return interaction.reply("❌ No group")

  const config = GROUP_CONFIG[group]
  const users = await getUsers(config.USERS_GIST_ID, config.USERS_FILENAME)

  if (interaction.commandName === "register") {
    const id = interaction.options.getString("id")

    users[interaction.user.id] = {
      main_id: id,
      name: interaction.member.displayName
    }

    await saveUsers(users, config.USERS_GIST_ID, config.USERS_FILENAME)

    return interaction.reply("✅ Registered")
  }

  if (interaction.commandName === "online") {
    const user = users[interaction.user.id]
    if (!user) return interaction.reply("❌ Register first")

    await fetch(`${API_URL}?action=online&id=${user.main_id}&group=${group}`)
    return interaction.reply("🟢 Online")
  }

  if (interaction.commandName === "offline") {
    const user = users[interaction.user.id]
    if (!user) return interaction.reply("❌ Register first")

    await fetch(`${API_URL}?action=offline&id=${user.main_id}&group=${group}`)
    return interaction.reply("🔴 Offline")
  }
})

// ================= MESSAGE LISTENER =================

client.on("messageCreate", async message => {
  if (!message.webhookId) return

  const match = message.content.match(/\((\d{16})\)/)
  if (!match) return

  await addVipID(match[1])
})

// ================= START =================

client.login(TOKEN)
