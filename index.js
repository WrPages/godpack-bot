const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js')

const fetch = require('node-fetch')

// ❌ handler desactivado (como pediste)
const gpHandler = require("./gpHandler")

// ✅ CREAR CLIENTE
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

// ================= DEBUG LOGIN =================

console.log("🧪 TOKEN:", TOKEN ? "OK" : "❌ FALTA TOKEN")

client.on("ready", async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`)

  // ❌ HANDLER DESACTIVADO
  // await gpHandler(client)

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
      .setName("online")
      .setDescription("Set main online"),

    new SlashCommandBuilder()
      .setName("offline")
      .setDescription("Set offline")

  ].map(c => c.toJSON())

  try {
    console.log("🧪 CLIENT ID:", process.env.CLIENT_ID)
    console.log("🧪 GUILD ID:", process.env.GUILD_ID)

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    )

    console.log("🚀 Comandos registrados correctamente")
  } catch (err) {
    console.error("❌ ERROR REGISTRANDO:", err)
  }
})

// ================= INTERACTIONS =================

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return

  console.log("📩 Comando recibido:", interaction.commandName)

  if (interaction.commandName === "register") {
    return interaction.reply("✅ Funciona")
  }

  if (interaction.commandName === "online") {
    return interaction.reply("🟢 Online OK")
  }

  if (interaction.commandName === "offline") {
    return interaction.reply("🔴 Offline OK")
  }
})

// ================= LOGIN =================

client.login(TOKEN).catch(err => {
  console.error("❌ ERROR LOGIN:", err)
})
