const { Client, GatewayIntentBits, EmbedBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, ActionRowBuilder,
  StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')

const fetch = require('node-fetch')

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
})

const TOKEN = process.env.TOKEN
const API_URL = "https://add-ids.netlify.app/.netlify/functions/api"
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

// ===== CONFIG =====
const GROUP_CONFIG = {
  Trainer: {
    USERS_FILENAME: "trainer_users.json",
    USERS_GIST_ID: "1c066922bc39ac136b6f234fad6d9420",
    IDS_GIST_ID: "4edcf4d341cd4f7d5d0fb8a50f8b8c3c",
    VIP_GIST_ID: "16541fd83785a49ad4a0f22bbeb06000"
  },
  Gym_Leader: {
    USERS_FILENAME: "gym_users.json",
    USERS_GIST_ID: "a3f5f3d8a2e6ddf2378fb3481dff49f6",
    IDS_GIST_ID: "e110c37b3e0b8de83a33a1b0a5eb64e8",
    VIP_GIST_ID: "79a0e30c401cfd63e78d9ec5a9210091"
  },
  Elite_Four: {
    USERS_FILENAME: "elite_users.json",
    USERS_GIST_ID: "bb18eda2ea748723d8fe0131dd740b70",
    IDS_GIST_ID: "d9db3a72fed74c496fd6cc830f9ca6e9",
    VIP_GIST_ID: "5f2f23e0391882ab4e255bd67e98334a"
  }
}

// ===== UTIL =====
function getUserGroup(interaction) {
  const role = interaction.member.roles.cache.find(r =>
    Object.keys(GROUP_CONFIG).includes(r.name)
  )
  return role ? role.name : null
}

// ===== GIST =====
async function getOnlineIDs(gistId) {
  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}?t=${Date.now()}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Cache-Control": "no-cache"
      }
    })

    const data = await res.json()
    const content = data.files["elite_ids.txt"]?.content || ""

    return content.split("\n").map(x => x.trim()).filter(Boolean)

  } catch (err) {
    console.error("Error leyendo ids:", err)
    return []
  }
}

async function getUsers(gistId, fileName) {
  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}?t=${Date.now()}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`
      }
    })

    const data = await res.json()
    return JSON.parse(data.files[fileName]?.content || "{}")
  } catch (err) {
    console.error("Error loading users:", err)
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
    const res = await fetch(`https://api.github.com/gists/${process.env.VIP_GIST_ID}?t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
    })

    const data = await res.json()
    let content = data.files["vip_ids.txt"]?.content || ""

    const ids = content.split("\n").filter(Boolean)
    if (ids.includes(id)) return

    ids.push(id)

    await fetch(`https://api.github.com/gists/${process.env.VIP_GIST_ID}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
      body: JSON.stringify({
        files: {
          "vip_ids.txt": { content: ids.join("\n") }
        }
      })
    })

    console.log("✅ VIP añadido:", id)

  } catch (err) {
    console.error("Error VIP:", err)
  }
}

// ===== READY =====
client.once("clientReady", async () => {
  console.log(`✅ Bot listo como ${client.user.tag}`)

  const { REST, Routes, SlashCommandBuilder } = require("discord.js")
  const rest = new REST({ version: "10" }).setToken(TOKEN)

  console.log("🔥 Registrando comandos...")

  const rawCommands = [

    new SlashCommandBuilder()
      .setName("register")
      .setDescription("Register your main game ID")
      .addStringOption(o => 
        o.setName("id")
         .setDescription("Your 16 digit ID")
         .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("add_sec")
      .setDescription("Register secondary ID")
      .addStringOption(o => 
        o.setName("id")
         .setDescription("Your secondary ID")
         .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("change")
      .setDescription("Change main ID")
      .addStringOption(o => 
        o.setName("id")
         .setDescription("New ID")
         .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("online")
      .setDescription("Set your main ID as online"),

    new SlashCommandBuilder()
      .setName("online_sec")
      .setDescription("Set your secondary ID as online"),

    new SlashCommandBuilder()
      .setName("offline")
      .setDescription("Set your ID as offline"),

    new SlashCommandBuilder()
      .setName("list")
      .setDescription("Show registered users"),

    new SlashCommandBuilder()
      .setName("online_list")
      .setDescription("Show online users"),

    new SlashCommandBuilder()
      .setName("gp")
      .setDescription("Add VIP ID")
      .addStringOption(o => 
        o.setName("id")
         .setDescription("VIP ID")
         .setRequired(true)
      )

  ]

  // DEBUG
  rawCommands.forEach(c => {
    console.log("✔️ CMD:", c.name)
  })

  const commands = rawCommands.map(c => c.toJSON())

  console.log("CLIENT_ID:", process.env.CLIENT_ID)
  console.log("GUILD_ID:", process.env.GUILD_ID)
  console.log("TOKEN OK:", !!TOKEN)

  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    )

    console.log("✅ Slash commands registrados")

  } catch (err) {
    console.error("❌ Error comandos:", err)
  }
})

// ===== HANDLERS =====
require("./gpHandler")(client)

// ===== MESSAGE DETECTOR =====
client.on("messageCreate", async (message) => {
  const match = message.content.match(/\b\d{16}\b/)
  if (!match) return

  const id = match[0]
  console.log("🔥 GP detectado:", id)
  await addVipID(id)
})

// ===== LOGIN =====
client.login(TOKEN)
