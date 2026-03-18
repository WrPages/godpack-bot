const { Client, GatewayIntentBits } = require('discord.js')
const fetch = require('node-fetch')

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

const TOKEN = process.env.TOKEN
const API_URL = "https://add-ids.netlify.app/.netlify/functions/api"

const USERS_GIST_ID = "312803a8e6964070593081d99a705d19"
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

// 🔥 online users (temporary)
let onlineUsers = {}

async function getUsers() {
  const res = await fetch(`https://api.github.com/gists/${USERS_GIST_ID}`)
  const data = await res.json()
  return JSON.parse(data.files["users.json"].content)
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

client.on("ready", () => {
  console.log("Bot ready 🔥")
})

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  const userId = interaction.user.id
  let users = await getUsers()

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

  // 🔥 si estaba online → poner offline el ID anterior
  if (onlineUsers[userId]) {
    const oldId = onlineUsers[userId].id

    await fetch(`${API_URL}?action=offline&id=${oldId}`)

    delete onlineUsers[userId]
  }

  // 🔹 guardar nuevo ID
  users[userId] = {
    id: newId,
    name: interaction.user.tag
  }

  await saveUsers(users)

  return interaction.reply(`🔄 ID updated to ${newId} (${interaction.user.tag})`)
}

    users[userId] = {
      id: id,
      name: interaction.user.tag
    }

    await saveUsers(users)

    return interaction.reply(`🔄 ID updated: ${id} (${interaction.user.tag})`)
  }

  // 🔹 ONLINE
 if (interaction.commandName === "online") {

  // 🔥 recargar usuarios para evitar delay del gist
  users = await getUsers()

  const userData = users[userId]
    const id = userData?.id

    if (!id) return interaction.reply("❌ You must register first using /register")

    await fetch(`${API_URL}?action=online&id=${id}`)

    onlineUsers[userId] = userData

    return interaction.reply(`🟢 ${userData.name} is now ONLINE with ID ${id}`)
  }

  // 🔹 OFFLINE
  if (interaction.commandName === "offline") {
    const userData = users[userId]
    const id = userData?.id

    if (!id) return interaction.reply("❌ No ID registered")

    await fetch(`${API_URL}?action=offline&id=${id}`)

    delete onlineUsers[userId]

    return interaction.reply(`🔴 ${userData.name} is now OFFLINE with ID ${id}`)
  }

  // 🔹 LIST ALL USERS
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

  // 🔹 ONLINE USERS
  if (interaction.commandName === "online_list") {
    if (Object.keys(onlineUsers).length === 0) {
      return interaction.reply("⚫ No users are online")
    }

    let msg = "🟢 **Online users:**\n\n"

    for (const uid in onlineUsers) {
      msg += `🟢 ${onlineUsers[uid].name} → ID: ${onlineUsers[uid].id}\n`
    }

    return interaction.reply(msg)
  }
})

client.login(TOKEN)
