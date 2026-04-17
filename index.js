const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js")

const fetch = require("node-fetch")
const fs = require("fs")

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
})

// ================= CONFIG =================

const TOKEN = process.env.TOKEN
const API_URL = "https://add-ids.netlify.app/.netlify/functions/api"

const PANEL_CHANNEL_ID = "1484015417411244082"

// ===== GRUPOS =====
const GROUP_CONFIG = {
  Trainer: {
    USERS_FILENAME: "trainer_users.json",
    USERS_GIST_ID: "1c066922bc39ac136b6f234fad6d9420",
    IDS_FILENAME: "trainer_ids.txt",
    IDS_GIST_ID: "4edcf4d341cd4f7d5d0fb8a50f8b8c3c"
  },
  Gym_Leader: {
    USERS_FILENAME: "gym_users.json",
    USERS_GIST_ID: "a3f5f3d8a2e6ddf2378fb3481dff49f6",
    IDS_FILENAME: "gym_ids.txt",
    IDS_GIST_ID: "e110c37b3e0b8de83a33a1b0a5eb64e8"
  },
  Elite_Four: {
    USERS_FILENAME: "elite_users.json",
    USERS_GIST_ID: "bb18eda2ea748723d8fe0131dd740b70",
    IDS_FILENAME: "elite_ids.txt",
    IDS_GIST_ID: "d9db3a72fed74c496fd6cc830f9ca6e9"
  }
}

// ================= HELPERS =================

async function getUsers(gistId, fileName) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`)
  const data = await res.json()
  return JSON.parse(data.files[fileName]?.content || "{}")
}

async function saveUsers(users, gistId, fileName) {
  await fetch(`https://api.github.com/gists/${gistId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
    body: JSON.stringify({
      files: {
        [fileName]: {
          content: JSON.stringify(users, null, 2)
        }
      }
    })
  })
}

async function getOnlineIDs(gistId, fileName) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`)
  const data = await res.json()

  return (data.files[fileName]?.content || "")
    .split("\n")
    .filter(x => x.trim())
}

async function getUserGroup(interaction) {
  const member = interaction.member

  const role = member.roles.cache.find(r =>
    Object.keys(GROUP_CONFIG).includes(r.name)
  )

  return role?.name || null
}

// ================= PANEL =================

async function sendPanel(channel) {

  const embed = new EmbedBuilder()
    .setTitle("🎮 CONTROL PANEL")
    .setDescription("Manage everything with buttons")
    .setColor(0x00ff99)

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("register").setLabel("Register").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("add_sec").setLabel("Add Sec").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("change").setLabel("Change ID").setStyle(ButtonStyle.Secondary)
  )

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("online").setLabel("Online").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("online_sec").setLabel("Online Sec").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("offline").setLabel("Offline").setStyle(ButtonStyle.Danger)
  )

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("list").setLabel("List").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("online_list").setLabel("Online List").setStyle(ButtonStyle.Secondary)
  )

  await channel.send({
    embeds: [embed],
    components: [row1, row2, row3]
  })
}

// ================= READY =================

client.once("ready", async () => {
  console.log(`🔥 Bot listo: ${client.user.tag}`)

  const channel = await client.channels.fetch(PANEL_CHANNEL_ID)

  await sendPanel(channel)
})

// ================= INTERACTIONS =================

client.on("interactionCreate", async (interaction) => {

  // ===== REGISTER =====
  if (interaction.isButton() && interaction.customId === "register") {

    const modal = new ModalBuilder()
      .setCustomId("modal_register")
      .setTitle("Register ID")

    const input = new TextInputBuilder()
      .setCustomId("id")
      .setLabel("Enter 16 digit ID")
      .setStyle(TextInputStyle.Short)

    modal.addComponents(new ActionRowBuilder().addComponents(input))

    return interaction.showModal(modal)
  }

  if (interaction.isModalSubmit() && interaction.customId === "modal_register") {

    const id = interaction.fields.getTextInputValue("id")

    if (!/^\d{16}$/.test(id)) {
      return interaction.reply({ content: "❌ Invalid ID", ephemeral: true })
    }

    const group = await getUserGroup(interaction)
    if (!group) return interaction.reply("❌ No group")

    const config = GROUP_CONFIG[group]
    let users = await getUsers(config.USERS_GIST_ID, config.USERS_FILENAME)

    users[interaction.user.id] = {
      main_id: id,
      sec_id: null,
      name: interaction.member.displayName
    }

    await saveUsers(users, config.USERS_GIST_ID, config.USERS_FILENAME)

    return interaction.reply(`✅ ${interaction.user} registered`)
  }

  // ===== ONLINE =====
  if (interaction.isButton() && interaction.customId === "online") {

    const group = await getUserGroup(interaction)
    const config = GROUP_CONFIG[group]

    const users = await getUsers(config.USERS_GIST_ID, config.USERS_FILENAME)
    const user = users[interaction.user.id]

    if (!user) return interaction.reply("❌ Register first")

    await fetch(`${API_URL}?action=online&id=${user.main_id}&group=${group}`)

    return interaction.reply(`🟢 ${interaction.user} is ONLINE`)
  }

  // ===== OFFLINE =====
  if (interaction.isButton() && interaction.customId === "offline") {

    const group = await getUserGroup(interaction)
    const config = GROUP_CONFIG[group]

    const users = await getUsers(config.USERS_GIST_ID, config.USERS_FILENAME)
    const user = users[interaction.user.id]

    if (!user) return interaction.reply("❌ Not registered")

    await fetch(`${API_URL}?action=offline&id=${user.main_id}&group=${group}`)

    return interaction.reply(`🔴 ${interaction.user} is OFFLINE`)
  }

  // ===== LIST =====
  if (interaction.isButton() && interaction.customId === "list") {

    const group = await getUserGroup(interaction)
    const config = GROUP_CONFIG[group]

    const users = await getUsers(config.USERS_GIST_ID, config.USERS_FILENAME)

    let msg = `📋 ${group} USERS\n\n`

    for (const uid in users) {
      msg += `👤 ${users[uid].name} → ${users[uid].main_id}\n`
    }

    return interaction.reply({ content: msg, ephemeral: true })
  }

  // ===== ONLINE LIST =====
  if (interaction.isButton() && interaction.customId === "online_list") {

    const group = await getUserGroup(interaction)
    const config = GROUP_CONFIG[group]

    const onlineIds = await getOnlineIDs(config.IDS_GIST_ID, config.IDS_FILENAME)
    const users = await getUsers(config.USERS_GIST_ID, config.USERS_FILENAME)

    let msg = `🟢 ONLINE ${group}\n\n`

    for (const uid in users) {
      const u = users[uid]

      if (onlineIds.includes(u.main_id) || onlineIds.includes(u.sec_id)) {
        msg += `👤 ${u.name}\n`
      }
    }

    return interaction.reply({ content: msg, ephemeral: true })
  }

})

// ================= START =================

client.login(TOKEN)
