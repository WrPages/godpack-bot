const { Client, GatewayIntentBits } = require('discord.js')
const fetch = require('node-fetch')

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

const TOKEN = process.env.TOKEN
const API_URL = "https://add-ids.netlify.app/.netlify/functions/api"

const USERS_GIST_ID = "312803a8e6964070593081d99a705d19"
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

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
  console.log("Bot listo 🔥")
})

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  const userId = interaction.user.id
  let users = await getUsers()

  if (interaction.commandName === "registrar") {
    const id = interaction.options.getString("id")
    users[userId] = id
    await saveUsers(users)
    return interaction.reply(`✅ ID registrado: ${id}`)
  }

  if (interaction.commandName === "cambiar") {
    const id = interaction.options.getString("id")
    users[userId] = id
    await saveUsers(users)
    return interaction.reply(`🔄 ID actualizado: ${id}`)
  }

  if (interaction.commandName === "online") {
    const id = users[userId]
    if (!id) return interaction.reply("❌ Usa /registrar primero")

    await fetch(`${API_URL}?action=online&id=${id}`)
    return interaction.reply(`🟢 ID ${id} ONLINE`)
  }

  if (interaction.commandName === "offline") {
    const id = users[userId]
    if (!id) return interaction.reply("❌ No tienes ID")

    await fetch(`${API_URL}?action=offline&id=${id}`)
    return interaction.reply(`🔴 ID ${id} OFFLINE`)
  }
})

client.login(TOKEN)
