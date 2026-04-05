const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js")

const fetch = require("node-fetch")

// ================= CONFIG =================

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
})

const TOKEN = process.env.TOKEN
const CLIENT_ID = process.env.CLIENT_ID
const GUILD_ID = process.env.GUILD_ID
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

// 🔥 GISTS (USA LOS TUYOS)
const USERS_GIST_ID = "bb18eda2ea748723d8fe0131dd740b70" // users.json
const ONLINE_GIST_ID = "d9db3a72fed74c496fd6cc830f9ca6e9" // elite_ids.txt

const USERS_FILE = "elite_users.json"
const ONLINE_FILE = "elite_ids.txt"

// ================= FUNCIONES =================

// Obtener usuarios
async function getUsers() {
  try {
    const res = await fetch(`https://api.github.com/gists/${USERS_GIST_ID}`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
    })

    const data = await res.json()
    return JSON.parse(data.files[USERS_FILE].content || "{}")

  } catch (err) {
    console.error("❌ ERROR GET USERS:", err)
    return {}
  }
}

// Obtener lista online
async function getOnlineList() {
  try {
    const res = await fetch(`https://api.github.com/gists/${ONLINE_GIST_ID}`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
    })

    const data = await res.json()
    const content = data.files[ONLINE_FILE].content || ""

    return content.split("\n").map(x => x.trim()).filter(Boolean)

  } catch (err) {
    console.error("❌ ERROR GET ONLINE:", err)
    return []
  }
}

// Guardar lista online
async function saveOnlineList(list) {
  try {
    await fetch(`https://api.github.com/gists/${ONLINE_GIST_ID}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        files: {
          [ONLINE_FILE]: {
            content: list.join("\n")
          }
        }
      })
    })
  } catch (err) {
    console.error("❌ ERROR SAVE ONLINE:", err)
  }
}

// ================= READY =================

client.on("ready", async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`)

  const rest = new REST({ version: "10" }).setToken(TOKEN)

  const commands = [
    new SlashCommandBuilder()
      .setName("online")
      .setDescription("Set yourself online"),

    new SlashCommandBuilder()
      .setName("offline")
      .setDescription("Set yourself offline")
  ].map(c => c.toJSON())

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  )

  console.log("🚀 Comandos registrados")
})

// ================= COMANDOS =================

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return

  const users = await getUsers()
  const userData = users[interaction.user.id]

  if (!userData) {
    return interaction.reply({ content: "❌ No estás registrado", ephemeral: true })
  }

  const mainId = userData.main_id
  const secId = userData.sec_id

  // ===== ONLINE =====
  if (interaction.commandName === "online") {
    let onlineList = await getOnlineList()

    if (mainId && !onlineList.includes(mainId))
      onlineList.push(mainId)

    if (secId && !onlineList.includes(secId))
      onlineList.push(secId)

    await saveOnlineList(onlineList)

    return interaction.reply("🟢 Estás online")
  }

  // ===== OFFLINE =====
  if (interaction.commandName === "offline") {
    let onlineList = await getOnlineList()

    const newList = onlineList.filter(id =>
      id !== mainId && id !== secId
    )

    await saveOnlineList(newList)

    return interaction.reply("🔴 Estás offline")
  }
})

// ================= LOGIN =================

client.login(TOKEN)
