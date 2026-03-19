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

let onlineUsers = {}

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
  console.log("Bot ready 🔥")
})

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

    users[userId] = {
      id: id,
      name: interaction.user.tag
    }

    await saveUsers(users)

    return interaction.reply(`✅ ID registered: ${id} (${interaction.user.tag})`)
  }

  // 🔹 CHANGE
 if (interaction.commandName === "change") {
  const newId = interaction.options.getString("id")

  if (!/^\d{16}$/.test(newId)) {
    return interaction.reply("❌ ID must be exactly 16 digits (numbers only)")
  }

  if (onlineUsers[userId]) {
    const oldId = onlineUsers[userId].id
    await fetch(`${API_URL}?action=offline&id=${oldId}`)
    delete onlineUsers[userId]
  }

  users[userId] = {
    id: newId,
    name: interaction.user.tag
  }

  await saveUsers(users)

  // 🔥 SOLO aquí recargar si quieres
  users = await getUsers()

  return interaction.reply(`🔄 ID updated to ${newId} (${interaction.user.tag})`)
  }

  // 🔹 ONLINE
  if (interaction.commandName === "online") {
    users = await getUsers()

    const userData = users[userId]
    const id = userData?.id

    if (!id) {
      return interaction.reply("❌ You must register first using /register")
    }

    await fetch(`${API_URL}?action=online&id=${id}`)

    onlineUsers[userId] = userData

    return interaction.reply(`🟢 ${userData.name} is now ONLINE with ID ${id}`)
  }

  // 🔹 OFFLINE
  if (interaction.commandName === "offline") {
    const userData = users[userId]
    const id = userData?.id

    if (!id) {
      return interaction.reply("❌ No ID registered")
    }

    await fetch(`${API_URL}?action=offline&id=${id}`)

    delete onlineUsers[userId]

    return interaction.reply(`🔴 ${userData.name} is now OFFLINE with ID ${id}`)
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
    const res = await fetch("https://gist.githubusercontent.com/WrPages/1fc02ff0921e82b3af1d3101cee44e4c/raw/ids.txt?t=" + Date.now())
    const text = await res.text()

    const ids = text.split("\n").filter(x => x.trim() !== "")

    if (ids.length === 0) {
      return interaction.reply("⚫ No users are online")
    }

    let msg = "🟢 **Online IDs:**\n\n"

    for (const id of ids) {
      msg += `🟢 ${id}\n`
    }

    return interaction.reply(msg)

  } catch (err) {
    console.error(err)
    return interaction.reply("❌ Error fetching online list")
  }
}

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


