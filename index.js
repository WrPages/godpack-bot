const { Client, GatewayIntentBits } = require('discord.js')
const fetch = require('node-fetch')

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
})

const TOKEN = process.env.TOKEN
const API_URL = "https://add-ids.netlify.app/.netlify/functions/api"

const USERS_GIST_ID = "312803a8e6964070593081d99a705d19"
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

//detecta onlineppm


const IDS_GIST_RAW_URL = "https://gist.githubusercontent.com/WrPages/1fc02ff0921e82b3af1d3101cee44e4c/raw/ids.txt"

async function getOnlineIDs() {
  try {
    const response = await fetch(IDS_GIST_RAW_URL)
    const text = await response.text()

    return text
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0)

  } catch (err) {
    console.error("Error leyendo ids.txt:", err)
    return []
  }
}

//termina
const fs = require("fs")

const HISTORY_FILE = "./ppm_history.json"
const TWELVE_HOURS = 12 * 60 * 60 * 1000

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return []
  return JSON.parse(fs.readFileSync(HISTORY_FILE))
}

function saveHistory(data) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(data))
}

//let onlineUsers = {}

async function getUsers() {
  try {
    const res = await fetch(`https://api.github.com/gists/${USERS_GIST_ID}?t=${Date.now()}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Cache-Control": "no-cache"
      }
    })

    const data = await res.json()

    if (!data.files || !data.files["users.json"]) {
      return {}
    }

    return JSON.parse(data.files["users.json"].content || "{}")

  } catch (err) {
    console.error("Error loading users:", err)
    return {}
  }
}


async function saveUsers(users) {
  await fetch(`https://api.github.com/gists/${USERS_GIST_ID}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json"
    },
    body: JSON.stringify({
      files: {
        "users.json": {
          content: JSON.stringify(users, null, 2)
        }
      }
    })
  })
}

async function addVipID(id) {
  try {
    const res = await fetch(`https://api.github.com/gists/${process.env.VIP_GIST_ID}?t=${Date.now()}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Cache-Control": "no-cache"
      }
    })

    const data = await res.json()

    let content = data.files["vip_ids.txt"]?.content || ""

    const ids = content.split("\n").filter(Boolean)

    if (ids.includes(id)) return

    ids.push(id)

    await fetch(`https://api.github.com/gists/${process.env.VIP_GIST_ID}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json"
      },
      body: JSON.stringify({
        files: {
          "vip_ids.txt": {
            content: ids.join("\n")
          }
        }
      })
    })

    console.log("✅ VIP añadido:", id)

  } catch (err) {
    console.error("Error VIP:", err)
  }
}

client.on("ready", () => {
  setInterval(updateTotalPPM, 5 * 60 * 1000)
  updateTotalPPM()
  console.log("Bot ready 🔥")
})


// StartPPMCounter

const HEARTBEAT_CHANNEL_ID = "1483616146996465735"
const TOTAL_CHANNEL_ID = "1484416376436424794"

async function updateTotalPPM() {
  try {

    const heartbeatChannel = await client.channels.fetch(HEARTBEAT_CHANNEL_ID)
    const totalChannel = await client.channels.fetch(TOTAL_CHANNEL_ID)

    const messages = await heartbeatChannel.messages.fetch({ limit: 10 })

    let totalPPM = 0
    let ppmUsers = []
    const processedUsers = new Set()

    // 🔥 Obtener IDs online reales
    const onlineIDs = await getOnlineIDs()

    // 🔥 Obtener usuarios registrados
    const users = await getUsers()

    // 🔥 Construir set de nombres realmente online (por ID)
    const onlineNames = new Set()

    for (const uid in users) {
      if (onlineIDs.includes(users[uid].id)) {
        // Quitamos #1234 por seguridad
        const cleanName = users[uid].name.split("#")[0].trim()
        onlineNames.add(cleanName)
      }
    }

    // 🔥 Leer mensajes heartbeat
for (const msg of messages.values()) {

  if (!msg.author.bot) continue

  const lines = msg.content.split("\n")
  if (lines.length < 3) continue

  const heartbeatName = lines[0]
    .replace(":", "")
    .trim()

  let foundId = null

  for (const discordId in users) {

    const registeredName = users[discordId].name
      .split("#")[0]
      .trim()

    if (registeredName.toLowerCase() === heartbeatName.toLowerCase()) {
      foundId = users[discordId].id
      break
    }
  }

  if (!foundId) continue
  if (!onlineIDs.includes(foundId)) continue

    

      if (processedUsers.has(heartbeatName)) continue

      const onlineLine = lines.find(l => l.startsWith("Online:"))
      const avgLine = lines.find(l => l.includes("Avg:"))

      if (!onlineLine || !avgLine) continue

      const onlineContent = onlineLine.replace("Online:", "").trim()
      if (!onlineContent || onlineContent.toLowerCase() === "none") continue

      const match = avgLine.match(/Avg:\s*([\d.]+)/)
      if (!match) continue

      const ppm = parseFloat(match[1])
      if (isNaN(ppm)) continue

      totalPPM += ppm
      
     // ppmUsers.push({ name: foundName, ppm })
  ppmUsers.push({ name: heartbeatName, ppm })

      processedUsers.add(heartbeatName)
    }

    // ===== HISTORIAL 12H =====
    let history = loadHistory()
    const now = Date.now()

    history.push({
      timestamp: now,
      value: totalPPM
    })

    history = history.filter(entry => now - entry.timestamp <= TWELVE_HOURS)
    saveHistory(history)

    let average12h = 0
    if (history.length > 0) {
      const sum = history.reduce((acc, entry) => acc + entry.value, 0)
      average12h = sum / history.length
    }

    // ===== MENSAJE =====

    ppmUsers.sort((a, b) => b.ppm - a.ppm)

    let messageContent = ""
    messageContent += "━━━━━━━━━━━━━━━━━━━━━━\n"
    messageContent += "🚀 **Global PPM**\n"
    messageContent += "━━━━━━━━━━━━━━━━━━━━━━\n\n"

    messageContent += `# 🔥 ${totalPPM.toFixed(2)}\n`
    messageContent += "**Current PPM**\n\n"

    messageContent += "━━━━━━━━━━━━━━━━━━━━━━\n"
    messageContent += `📊 **12H Average:** ${average12h.toFixed(2)} ppm\n`
    messageContent += "━━━━━━━━━━━━━━━━━━━━━━\n\n"

    if (ppmUsers.length === 0) {
      messageContent += "⚫ No users online\n"
    } else {
      messageContent += "🟢 **Online users**\n"
      messageContent += "────────────────────\n"

      for (const user of ppmUsers) {
        messageContent += `• **${user.name}** → \`${user.ppm.toFixed(2)} ppm\`\n`
      }
    }

    messageContent += "\n━━━━━━━━━━━━━━━━━━━━━━"

    const existingMessages = await totalChannel.messages.fetch({ limit: 5 })
    const botMessage = existingMessages.find(m => m.author.id === client.user.id)

    if (botMessage) {
      await botMessage.edit(messageContent)
    } else {
      await totalChannel.send(messageContent)
    }

    console.log("PPM total actualizado")

  } catch (err) {
    console.error("Error actualizando PPM:", err)
  }
}
//FinishPPM

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  const userId = interaction.user.id
  let users = await getUsers()
// 🔹 VIP ids
if (interaction.commandName === "gp") {
  const id = interaction.options.getString("id")

  if (!/^\d{16}$/.test(id)) {
    return interaction.reply("❌ ID must be 16 digits")
  }

  await addVipID(id)

  return interaction.reply(`🔥 VIP ID añadido: ${id}`)
}
  
  // 🔹 REGISTER
  if (interaction.commandName === "register") {
    const id = interaction.options.getString("id")

    if (!/^\d{16}$/.test(id)) {
      return interaction.reply("❌ ID must be exactly 16 digits (numbers only)")
    }

const displayName = interaction.member
  ? interaction.member.displayName
  : interaction.user.username

    
  users[userId] = {
  id: id,
  name: interaction.member.displayName
    }

    await saveUsers(users)

    return interaction.reply(`✅ ID registered: ${id} (${interaction.user.tag})`)
  }

  // 🔹 CHANGE
if (interaction.commandName === "change") {
  try {

    await interaction.deferReply({ ephemeral: true })

    const newId = interaction.options.getString("id")

    if (!/^\d{16}$/.test(newId)) {
      return interaction.editReply("❌ ID must be exactly 16 digits (numbers only)")
    }

    let users = await getUsers()

    const userData = users[userId]

    // Si existe ID anterior → poner offline
    if (userData?.id) {
      try {
        await fetch(`${API_URL}?action=offline&id=${userData.id}`)
      } catch (e) {
        console.error("Error putting old ID offline:", e)
      }
    }

    // Actualizar ID
    users[userId] = {
      id: newId,
      name: interaction.user.tag
    }

    await saveUsers(users)

    return interaction.editReply(`🔄 ID updated to ${newId}`)

  } catch (error) {
    console.error("CHANGE ERROR:", error)

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply("❌ Unexpected error updating ID")
    } else {
      return interaction.reply("❌ Unexpected error updating ID")
    }
  }
}

  
  // 🔹 ONLINE
if (interaction.commandName === "online") {

  await interaction.deferReply()

  const users = await getUsers()
  const userData = users[userId]
  const id = userData?.id

  if (!id) {
    return interaction.editReply("❌ You must register first using /register")
  }

  await fetch(`${API_URL}?action=online&id=${id}`)

  return interaction.editReply(`🟢 ${userData.name} is now ONLINE with ID ${id}`)
}

  // 🔹 OFFLINE
  if (interaction.commandName === "offline") {

  await interaction.deferReply()

  const users = await getUsers()
  const userData = users[userId]
  const id = userData?.id

  if (!id) {
    return interaction.editReply("❌ No ID registered")
  }

  await fetch(`${API_URL}?action=offline&id=${id}`)

  return interaction.editReply(`🔴 ${userData.name} is now OFFLINE with ID ${id}`)
}

  // 🔹 LIST
  if (interaction.commandName === "list") {
    if (Object.keys(users).length === 0) {
      return interaction.reply("📭 No users registered")
    }

    let msg = "📋 **Registered users:**\n\n"

    for (const uid in users) {
      msg += `👤 ${users[uid].name} → ID: ${users[uid].id}\n`
    }

    return interaction.reply(msg)
  }

  // 🔹 ONLINE LIST
 if (interaction.commandName === "online_list") {
  try {

    // 🔥 obtener IDs online desde gist
    const res = await fetch("https://gist.githubusercontent.com/WrPages/1fc02ff0921e82b3af1d3101cee44e4c/raw/ids.txt?t=" + Date.now())
    const text = await res.text()

    const ids = text.split("\n").filter(x => x.trim() !== "")

    if (ids.length === 0) {
      return interaction.reply("⚫ No users are online")
    }

    // 🔥 obtener usuarios registrados
    const users = await getUsers()

    let msg = "🟢 **Online users:**\n\n"

    for (const id of ids) {

      // 🔍 buscar nombre correspondiente
      let name = ""

      for (const uid in users) {
        if (users[uid].id === id) {
          name = users[uid].name
          break
        }
      }

      msg += `🟢 ${name} → ${id}\n`
    }

    return interaction.reply(msg)

  } catch (err) {
    console.error(err)
    return interaction.reply("❌ Error fetching online list")
  }
}
})

client.on("messageCreate", async (message) => {

  console.log("📩 MENSAJE DETECTADO")
  console.log("Contenido:", message.content)
  console.log("Webhook:", message.webhookId)

  const text = message.content || ""

  const match = text.match(/\((\d{16})\)/)

  if (!match) {
    console.log("❌ No se encontró ID")
    return
  }

  const id = match[1]

  console.log("🔥 GP detectado:", id)

  await addVipID(id)
})

client.login(TOKEN)


