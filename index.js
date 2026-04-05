const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
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

const { startPanelSystem } = require("./statsPanel")
const gpHandler = require("./gpHandler")

// ✅ CREAR CLIENT PRIMERO
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

// ================= CONFIG =================

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

// ================= HELPERS =================

function getUserGroup(interaction) {
  const role = interaction.member.roles.cache.find(r =>
    Object.keys(GROUP_CONFIG).includes(r.name)
  )
  return role ? role.name : null
}

async function getUsers(gistId, fileName) {
  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}?t=${Date.now()}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`
      }
    })

    const data = await res.json()

    if (!data.files || !data.files[fileName]) return {}

    return JSON.parse(data.files[fileName].content || "{}")

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

// ================= READY (ÚNICO) =================

client.once("clientReady", async () => {
  console.log(`✅ Bot listo como ${client.user.tag}`)

  // 🔥 ACTIVAR TU HANDLER (ESTO ERA CLAVE)
  await gpHandler(client)

  const rest = new REST({ version: "10" }).setToken(TOKEN)

  const commands = [

    new SlashCommandBuilder()
      .setName("register")
      .setDescription("Register your main game ID")
      .addStringOption(o =>
        o.setName("id").setDescription("16 digit ID").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("add_sec")
      .setDescription("Register your secondary ID")
      .addStringOption(o =>
        o.setName("id").setDescription("16 digit ID").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("change")
      .setDescription("Change main ID")
      .addStringOption(o =>
        o.setName("id").setDescription("New ID").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("schedule_events")
      .setDescription("Daily scheduler UTC")
      .addStringOption(o =>
        o.setName("mode")
          .setDescription("start or stop")
          .setRequired(true)
          .addChoices(
            { name: "Start", value: "start" },
            { name: "Stop", value: "stop" }
          )
      )
      .addIntegerOption(o => o.setName("online_hour").setDescription("0-23"))
      .addIntegerOption(o => o.setName("online_minute").setDescription("0-59"))
      .addIntegerOption(o => o.setName("offline_hour").setDescription("0-23"))
      .addIntegerOption(o => o.setName("offline_minute").setDescription("0-59")),

    new SlashCommandBuilder()
      .setName("set_offline")
      .setDescription("Force user offline"),

    new SlashCommandBuilder()
      .setName("online")
      .setDescription("Set main online"),

    new SlashCommandBuilder()
      .setName("online_sec")
      .setDescription("Set secondary online"),

    new SlashCommandBuilder()
      .setName("offline")
      .setDescription("Set offline"),

    new SlashCommandBuilder()
      .setName("list")
      .setDescription("List users"),

    new SlashCommandBuilder()
      .setName("online_list")
      .setDescription("List online users"),

    new SlashCommandBuilder()
      .setName("gp")
      .setDescription("Add VIP ID")
      .addStringOption(o =>
        o.setName("id").setDescription("16 digit ID").setRequired(true)
      )

  ].map(c => c.toJSON())

  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  )

  console.log("🚀 Comandos registrados")
})

// ================= COMMAND HANDLER =================

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return

  const { commandName } = interaction
  const group = getUserGroup(interaction)
  if (!group) return interaction.reply("❌ No group")

  const config = GROUP_CONFIG[group]

  let users = await getUsers(config.USERS_GIST_ID, config.USERS_FILENAME)

  if (commandName === "register") {
    const id = interaction.options.getString("id")

    users[interaction.user.id] = {
      main_id: id,
      sec_id: null,
      name: interaction.member.displayName
    }

    await saveUsers(users, config.USERS_GIST_ID, config.USERS_FILENAME)

    return interaction.reply("✅ Registered")
  }

  if (commandName === "add_sec") {
    const id = interaction.options.getString("id")

    if (!users[interaction.user.id])
      return interaction.reply("❌ Register first")

    users[interaction.user.id].sec_id = id

    await saveUsers(users, config.USERS_GIST_ID, config.USERS_FILENAME)

    return interaction.reply("✅ Secondary added")
  }

  if (commandName === "online") {
    const user = users[interaction.user.id]
    if (!user) return interaction.reply("❌ Register first")

    await fetch(`${API_URL}?action=online&id=${user.main_id}&group=${group}`)

    return interaction.reply("🟢 Online")
  }

  if (commandName === "offline") {
    const user = users[interaction.user.id]
    if (!user) return interaction.reply("❌ Register first")

    if (user.main_id)
      await fetch(`${API_URL}?action=offline&id=${user.main_id}&group=${group}`)

    if (user.sec_id)
      await fetch(`${API_URL}?action=offline&id=${user.sec_id}&group=${group}`)

    return interaction.reply("🔴 Offline")
  }
})

// ================= LOGIN =================

client.login(TOKEN)
