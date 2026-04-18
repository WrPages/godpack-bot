
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  MessageFlags
} = require("discord.js")

const fetch = require("node-fetch")
const fs = require("fs")

const gpHandler = require("./gpHandler");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

// ================= CONFIG =================

const TOKEN = process.env.TOKEN
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const API_URL = "https://add-ids.netlify.app/.netlify/functions/api"
const PANEL_CHANNEL_ID = "1494760619985862676"

// ================= GROUP CONFIG =================

const GROUP_CONFIG = {
  Trainer: {
    USERS_FILENAME:"trainer_users.json",
    USERS_GIST_ID:"1c066922bc39ac136b6f234fad6d9420",
    IDS_FILENAME:"trainer_ids.txt",
    IDS_GIST_ID:"4edcf4d341cd4f7d5d0fb8a50f8b8c3c",
    VIP_FILENAME:"trainer_vip.txt",
    VIP_GIST_ID:"16541fd83785a49ad4a0f22bbeb06000"
  },
  Gym_Leader: {
    USERS_FILENAME:"gym_users.json",
    USERS_GIST_ID:"a3f5f3d8a2e6ddf2378fb3481dff49f6",
    IDS_FILENAME:"gym_ids.txt",
    IDS_GIST_ID:"e110c37b3e0b8de83a33a1b0a5eb64e8",
    VIP_FILENAME:"gym_vip.txt",
    VIP_GIST_ID:"79a0e30c401cfd63e78d9ec5a9210091"
  },
  Elite_Four: {
    USERS_FILENAME:"elite_users.json",
    USERS_GIST_ID:"bb18eda2ea748723d8fe0131dd740b70",
    IDS_FILENAME:"elite_ids.txt",
    IDS_GIST_ID:"d9db3a72fed74c496fd6cc830f9ca6e9",
    VIP_FILENAME:"elite_vip.txt",
    VIP_GIST_ID:"5f2f23e0391882ab4e255bd67e98334a"
  }
}

// ================= FILES =================

const SCHEDULE_FILE = "./daily_schedules.json"
const PANEL_DATA_FILE = "./panel_data.json"
const ACTIVE_ROLE_GIST_ID = "49c42c0a844bbc4d2c0187fc254140d1"
const ACTIVE_ROLE_FILE = "active_roles.json"


// ================= HELPERS =================

function isChampion(interaction) {
  return interaction.member.roles.cache.some(r => r.name === "Champion");
}

function getGroupLabel(group) {
  const labels = {
    Trainer: "Trainer",
    Gym_Leader: "Gym Leader",
    Elite_Four: "Elite Four"
  };
  return labels[group] || group;
}

function buildGroupOptions() {
  return [
    { label: "Trainer", value: "Trainer" },
    { label: "Gym Leader", value: "Gym_Leader" },
    { label: "Elite Four", value: "Elite_Four" }
  ];
}


async function getActiveRoles() {
  try {
    const res = await fetch(`https://api.github.com/gists/${ACTIVE_ROLE_GIST_ID}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json"
      }
    })

    if (!res.ok) {
      console.error("Error loading active roles:", res.status)
      return {}
    }

    const data = await res.json()

    if (!data.files || !data.files[ACTIVE_ROLE_FILE]) return {}

    return JSON.parse(data.files[ACTIVE_ROLE_FILE].content || "{}")
  } catch (err) {
    console.error("Error loading active roles:", err)
    return {}
  }
}

async function saveActiveRoles(data) {
  try {
    const res = await fetch(`https://api.github.com/gists/${ACTIVE_ROLE_GIST_ID}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        files: {
          [ACTIVE_ROLE_FILE]: {
            content: JSON.stringify(data, null, 2)
          }
        }
      })
    })

    if (!res.ok) {
      throw new Error(`saveActiveRoles failed: ${res.status}`)
    }
  } catch (err) {
    console.error("Error saving active roles:", err)
  }
}


function loadSchedules(){
  if(!fs.existsSync(SCHEDULE_FILE)) return {}
  return JSON.parse(fs.readFileSync(SCHEDULE_FILE))
}

function saveSchedules(data){
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data,null,2))
}

async function getUsers(gistId,file){
  const res = await fetch(`https://api.github.com/gists/${gistId}`)
  if (!res.ok) throw new Error(`getUsers failed: ${res.status}`)
  const data = await res.json()
  return JSON.parse(data.files[file]?.content || "{}")
}

async function saveUsers(users,gistId,file){
  await fetch(`https://api.github.com/gists/${gistId}`,{
    method:"PATCH",
    headers:{
  Authorization:`Bearer ${GITHUB_TOKEN}`,
  "Content-Type":"application/json"
},
    body:JSON.stringify({
      files:{[file]:{content:JSON.stringify(users,null,2)}}
    })
  })
}



async function getOnlineIDs(gistId,file){
  const res = await fetch(`https://api.github.com/gists/${gistId}`)
  if (!res.ok) throw new Error(`getOnlineIDs failed: ${res.status}`)
  const data = await res.json()
  return (data.files[file]?.content || "").split("\n").filter(Boolean)
}

async function addVipID(id,group){
  const config = GROUP_CONFIG[group]

  const res = await fetch(`https://api.github.com/gists/${config.VIP_GIST_ID}`)
  const data = await res.json()

  let content = data.files[config.VIP_FILENAME]?.content || ""
  let ids = content.split("\n").filter(Boolean)

  if(ids.includes(id)) return

  ids.push(id)

  await fetch(`https://api.github.com/gists/${config.VIP_GIST_ID}`,{
    method:"PATCH",
    headers:{
  Authorization:`Bearer ${GITHUB_TOKEN}`,
  "Content-Type":"application/json"
},
    body:JSON.stringify({
      files:{[config.VIP_FILENAME]:{content:ids.join("\n")}}
    })
  })
}

// ===== GROUP =====
async function getUserGroup(interaction) {
  const allowedGroups = Object.keys(GROUP_CONFIG)
  const activeRoles = await getActiveRoles()

  const memberGroups = interaction.member.roles.cache
    .filter(r => allowedGroups.includes(r.name))
    .map(r => r.name)

  if (!memberGroups.length) return null

  const savedRole = activeRoles[interaction.user.id]

  if (savedRole && memberGroups.includes(savedRole)) {
    return savedRole
  }

  return memberGroups[0]
}
/// panel
function loadPanelData(){
  if(!fs.existsSync(PANEL_DATA_FILE)) return {}
  return JSON.parse(fs.readFileSync(PANEL_DATA_FILE))
}

function savePanelData(data){
  fs.writeFileSync(PANEL_DATA_FILE, JSON.stringify(data,null,2))
}


// ================= SCHEDULER =================

function startScheduler(){
  setInterval(async () => {
    try {
      const schedules = loadSchedules()
      const now = new Date()

      for (const uid in schedules) {
        const s = schedules[uid]

        const hour = now.getUTCHours()
        const min = now.getUTCMinutes()

        if (hour === s.online_hour && min === s.online_minute) {
          await fetch(`${API_URL}?action=online&id=${s.main_id}&group=${s.group}`)
        }

        if (hour === s.offline_hour && min === s.offline_minute) {
          await fetch(`${API_URL}?action=offline&id=${s.main_id}&group=${s.group}`)
        }
      }
    } catch (err) {
      console.error("Scheduler error:", err)
    }
  }, 60000)
}


// ================= PANEL =================

async function sendPanel(channel){

  const panelData = loadPanelData()

  const embed = new EmbedBuilder()
    .setTitle("🎮 PANEL CONTROL")
   // .setDescription("Usa botones para controlar todo")

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("register").setLabel("Register").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("add_sec").setLabel("Add Sec").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("change").setLabel("Change").setStyle(ButtonStyle.Secondary)
  )

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("online").setLabel("Online").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("offline").setLabel("Offline").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("online_sec").setLabel("Online Sec").setStyle(ButtonStyle.Success)
  )

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("list").setLabel("List").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("online_list").setLabel("Online List").setStyle(ButtonStyle.Secondary)
  )

  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("schedule").setLabel("Schedule").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("change_role").setLabel("Change Role").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("set_offline").setLabel("Force Offline").setStyle(ButtonStyle.Danger)
  )

  const row5 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("gp").setLabel("Add VIP").setStyle(ButtonStyle.Success)
  )

  const panelPayload = {
    embeds:[embed],
    components:[row1,row2,row3,row4,row5]
  }

  try {

    // 🔁 SI YA EXISTE → EDITAR
    if(panelData.messageId){
      const msg = await channel.messages.fetch(panelData.messageId)
      await msg.edit(panelPayload)
      console.log("♻️ Panel actualizado")
      return
    }

  } catch(err){
    console.log("Panel anterior no encontrado, creando nuevo...")
  }

  // 🆕 SI NO EXISTE → CREAR NUEVO
  const newMsg = await channel.send(panelPayload)

  panelData.messageId = newMsg.id
  savePanelData(panelData)

  console.log("✅ Panel creado y guardado")
}

// ================= READY =================

client.once("clientReady", async () => {
  try {
    console.log("🔥 Bot listo")

    const ch = await client.channels.fetch(PANEL_CHANNEL_ID)
    await sendPanel(ch)

    startScheduler()
    await gpHandler(client)
  } catch (err) {
    console.error("Ready error:", err)
  }
})

//const { MessageFlags } = require("discord.js");

const OWN_BUTTONS = new Set([
  "register",
  "add_sec",
  "change",
  "online",
  "offline",
  "online_sec",
  "list",
  "online_list",
  "schedule",
  "change_role",
  "set_offline",
  "gp"
]);

const OWN_MODALS = new Set([
  "reg_modal",
  "sec_modal",
  "change_modal",
  "schedule_modal",
  "gp_modal"
]);

const OWN_SELECTS = new Set([
  "role_select",
  "offline_group_select",
  "forced_offline_user_select",
  "gp_group_select"
]);

function isOwnInteraction(interaction) {
  if (interaction.isButton()) {
    return OWN_BUTTONS.has(interaction.customId);
  }

  if (interaction.isModalSubmit()) {
    return OWN_MODALS.has(interaction.customId);
  }

  if (interaction.isStringSelectMenu()) {
    return OWN_SELECTS.has(interaction.customId) || interaction.customId.startsWith("gp_select_");
  }

  return false;
}

// ================= INTERACTIONS =================

client.on("interactionCreate", async interaction => {
  try {
    if (!isOwnInteraction(interaction)) return

    if (interaction.deferred || interaction.replied) {
      console.warn("Interaction already acknowledged before index handler:", interaction.customId, interaction.user.id)
      return
    }

  // ================= BOTONES =================

  if (interaction.isButton()) {

    const group = await getUserGroup(interaction)
    if (!group) return interaction.reply({ content:"❌ No group" , flags: MessageFlags.Ephemeral })

const isModal = ["register", "add_sec", "change", "schedule", "gp"].includes(interaction.customId)

if (!isModal) {
  if (interaction.deferred || interaction.replied) {
    console.warn("Duplicate ack prevented in index:", interaction.customId, interaction.user.id)
    return
  }

  console.log("Index handling button:", interaction.customId, "user:", interaction.user.id)
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })
}

    const config = GROUP_CONFIG[group]
  

    // ===== REGISTER =====
    if (interaction.customId === "register") {
      const modal = new ModalBuilder()
        .setCustomId("reg_modal")
        .setTitle("Register ID")

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("id")
            .setLabel("16 digit ID")
            .setStyle(TextInputStyle.Short)
        )
      )

      return interaction.showModal(modal)
    }
  }

    // ===== ADD SEC =====
    if (interaction.customId === "add_sec") {
      const modal = new ModalBuilder()
        .setCustomId("sec_modal")
        .setTitle("Add Secondary ID")

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("id")
            .setLabel("16 digit ID")
            .setStyle(TextInputStyle.Short)
        )
      )

      return interaction.showModal(modal)
    }

    // ===== CHANGE =====
    if (interaction.customId === "change") {
      const modal = new ModalBuilder()
        .setCustomId("change_modal")
        .setTitle("Change Main ID")

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("id")
            .setLabel("New 16 digit ID")
            .setStyle(TextInputStyle.Short)
        )
      )

      return interaction.showModal(modal)
    }

    // ===== ONLINE =====
    if (interaction.customId === "online") {
        const users = await getUsers(config.USERS_GIST_ID,config.USERS_FILENAME)
    const userData = users[interaction.user.id]
      if (!userData?.main_id) return interaction.editReply("❌ Register first")

      await fetch(`${API_URL}?action=online&id=${userData.main_id}&group=${group}`)
      return interaction.editReply("🟢 ONLINE")
    }

    // ===== ONLINE SEC =====
    if (interaction.customId === "online_sec") {
        const users = await getUsers(config.USERS_GIST_ID,config.USERS_FILENAME)
    const userData = users[interaction.user.id]
      if (!userData?.sec_id) return interaction.editReply("❌ No secondary ID")

      await fetch(`${API_URL}?action=online&id=${userData.sec_id}&group=${group}`)
      return interaction.editReply("🟢 SEC ONLINE")
    }

    // ===== OFFLINE =====
    if (interaction.customId === "offline") {
        const users = await getUsers(config.USERS_GIST_ID,config.USERS_FILENAME)
    const userData = users[interaction.user.id]
      if (!userData) return interaction.editReply("❌ Not registered")

      if (userData.main_id)
        await fetch(`${API_URL}?action=offline&id=${userData.main_id}&group=${group}`)

      if (userData.sec_id)
        await fetch(`${API_URL}?action=offline&id=${userData.sec_id}&group=${group}`)

      return interaction.editReply("🔴 OFFLINE")
    }

    // ===== LIST =====
    if (interaction.customId === "list") {
        const users = await getUsers(config.USERS_GIST_ID,config.USERS_FILENAME)
    const userData = users[interaction.user.id]

      if (Object.keys(users).length === 0)
        return interaction.editReply("📭 No users")

      let msg = "📋 Users:\n\n"

      for (const uid in users) {
        const u = users[uid]
        msg += `👤 ${u.name} → ${u.main_id}\n`
      }

      return interaction.editReply(msg)
    }

    // ===== ONLINE LIST =====
    if (interaction.customId === "online_list") {
        const users = await getUsers(config.USERS_GIST_ID,config.USERS_FILENAME)
    const userData = users[interaction.user.id]

      const ids = await getOnlineIDs(config.IDS_GIST_ID,config.IDS_FILENAME)

      if (!ids.length) return interaction.editReply("⚫ No online")

      let msg = "🟢 Online:\n\n"

      for (const uid in users) {
        const u = users[uid]

        if (ids.includes(u.main_id) || ids.includes(u.sec_id)) {
          msg += `👤 ${u.name}\n`
        }
      }

      return interaction.editReply(msg)
    }

    // ===== SCHEDULE =====
    if (interaction.customId === "schedule") {

      const modal = new ModalBuilder()
        .setCustomId("schedule_modal")
        .setTitle("Schedule UTC")

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("on").setLabel("Online HH:MM").setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("off").setLabel("Offline HH:MM").setStyle(TextInputStyle.Short)
        )
      )

      return interaction.showModal(modal)
    }

    // ===== CHANGE ROLE =====
if (interaction.customId === "change_role") {
  const roles = interaction.member.roles.cache
    .filter(r => Object.keys(GROUP_CONFIG).includes(r.name))
    .map(r => ({ label: r.name, value: r.name }))

  if (roles.length < 2) {
    return interaction.editReply("❌ You need at least 2 group roles")
  }

  const currentRole = await getUserGroup(interaction)

  const menu = new StringSelectMenuBuilder()
    .setCustomId("role_select")
    .setPlaceholder("Select your active role")
    .addOptions(roles)

  return interaction.editReply({
    content: `Current active role: ${currentRole}\nSelect your new active role`,
    components: [new ActionRowBuilder().addComponents(menu)]
  })
}

    // ===== FORCE OFFLINE =====
if (interaction.customId === "set_offline") {
  if (!isChampion(interaction)) {
    return interaction.editReply("❌ Only Champion can use this button")
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("offline_group_select")
    .setPlaceholder("Select group")
    .addOptions(buildGroupOptions())

  return interaction.editReply({
    content: "Select the group where you want to force offline",
    components: [new ActionRowBuilder().addComponents(menu)]
  })
}

    // ===== GP =====
if (interaction.customId === "gp") {
  if (!isChampion(interaction)) {
    return interaction.editReply("❌ Only Champion can use this button")
  }

  const modal = new ModalBuilder()
    .setCustomId("gp_modal")
    .setTitle("Add VIP")

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("id")
        .setLabel("VIP ID")
        .setStyle(TextInputStyle.Short)
    )
  )

  return interaction.showModal(modal)
}

  // ================= MODALES =================

  if (interaction.isModalSubmit()) {

    const group = await getUserGroup(interaction)
    if (!group) return interaction.reply({ content:"❌ No group", flags: MessageFlags.Ephemeral })

    const config = GROUP_CONFIG[group]
    let users = await getUsers(config.USERS_GIST_ID,config.USERS_FILENAME)

    if (interaction.customId === "reg_modal") {
      const id = interaction.fields.getTextInputValue("id")
      if (!isValidId(id)) {
  return interaction.reply({
    content: "❌ ID must be exactly 16 digits",
    flags: MessageFlags.Ephemeral
  })
}

      users[interaction.user.id] = {
        main_id:id,
        sec_id:null,
        name:interaction.member.displayName
      }

      await saveUsers(users,config.USERS_GIST_ID,config.USERS_FILENAME)
      return interaction.reply({ content: "✅ Registered", flags: MessageFlags.Ephemeral })
    }

    if (interaction.customId === "sec_modal") {
      const id = interaction.fields.getTextInputValue("id")
      if (!isValidId(id)) {
  return interaction.reply({
    content: "❌ ID must be exactly 16 digits",
    flags: MessageFlags.Ephemeral
  })
}

      if (!users[interaction.user.id])
        return interaction.reply({content:"❌ Register first",flags: MessageFlags.Ephemeral})

      users[interaction.user.id].sec_id = id

      await saveUsers(users,config.USERS_GIST_ID,config.USERS_FILENAME)
      return interaction.reply({content:"✅ Secondary added", flags: MessageFlags.Ephemeral})
    }

    if (interaction.customId === "change_modal") {
      const id = interaction.fields.getTextInputValue("id")
      if (!isValidId(id)) {
  return interaction.reply({
    content: "❌ ID must be exactly 16 digits",
    flags: MessageFlags.Ephemeral
  })
}

      if (!users[interaction.user.id])
        return interaction.reply({content:"❌ Register first",flags: MessageFlags.Ephemeral})

      users[interaction.user.id].main_id = id

      await saveUsers(users,config.USERS_GIST_ID,config.USERS_FILENAME)
      return interaction.reply({content:"🔄 Updated",flags: MessageFlags.Ephemeral})
    }

if (interaction.customId === "schedule_modal") {
  const onRaw = interaction.fields.getTextInputValue("on").trim()
  const offRaw = interaction.fields.getTextInputValue("off").trim()

  if (!/^\d{1,2}:\d{2}$/.test(onRaw) || !/^\d{1,2}:\d{2}$/.test(offRaw)) {
    return interaction.reply({
      content: "❌ Use HH:MM format",
      flags: MessageFlags.Ephemeral
    })
  }

  const on = onRaw.split(":")
  const off = offRaw.split(":")

  const onHour = +on[0]
  const onMinute = +on[1]
  const offHour = +off[0]
  const offMinute = +off[1]

  if (
    onHour < 0 || onHour > 23 ||
    offHour < 0 || offHour > 23 ||
    onMinute < 0 || onMinute > 59 ||
    offMinute < 0 || offMinute > 59
  ) {
    return interaction.reply({
      content: "❌ Invalid UTC time",
      flags: MessageFlags.Ephemeral
    })
  }

  if (!users[interaction.user.id]?.main_id) {
    return interaction.reply({
      content: "❌ Register first",
      flags: MessageFlags.Ephemeral
    })
  }

  const schedules = loadSchedules()

  schedules[interaction.user.id] = {
    group,
    main_id: users[interaction.user.id].main_id,
    online_hour: onHour,
    online_minute: onMinute,
    offline_hour: offHour,
    offline_minute: offMinute
  }

  saveSchedules(schedules)

  return interaction.reply({
    content: "✅ Schedule saved",
    flags: MessageFlags.Ephemeral
  })
}

 if (interaction.customId === "gp_modal") {
  if (!isChampion(interaction)) {
    return interaction.reply({
      content: "❌ Only Champion can use this function",
      flags: MessageFlags.Ephemeral
    })
  }

  const id = interaction.fields.getTextInputValue("id").trim()

  if (!isValidId(id)) {
    return interaction.reply({
      content: "❌ ID must be exactly 16 digits",
      flags: MessageFlags.Ephemeral
    })
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`gp_group_select:${id}`)
    .setPlaceholder("Select group")
    .addOptions(buildGroupOptions())

  return interaction.reply({
    content: "Select the group where you want to add this VIP ID",
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral
  })
}

  }

  // ================= SELECT MENUS =================
if (interaction.isStringSelectMenu()) {

  if (interaction.customId.startsWith("gp_group_select:")) {
    if (!isChampion(interaction)) {
      return interaction.update({
        content: "❌ Only Champion can use this function",
        components: []
      })
    }

    const id = interaction.customId.split(":")[1]
    const group = interaction.values[0]

    await addVipID(id, group)

    return interaction.update({
      content: `✅ VIP ID added to ${getGroupLabel(group)}`,
      components: []
    })
  }

  if (interaction.customId === "offline_group_select") {
    if (!isChampion(interaction)) {
      return interaction.update({
        content: "❌ Only Champion can use this function",
        components: []
      })
    }

    const group = interaction.values[0]
    const config = GROUP_CONFIG[group]

    const ids = await getOnlineIDs(config.IDS_GIST_ID, config.IDS_FILENAME)
    const users = await getUsers(config.USERS_GIST_ID, config.USERS_FILENAME)

    if (!ids.length) {
      return interaction.update({
        content: `⚫ No users online in ${getGroupLabel(group)}`,
        components: []
      })
    }

    const onlineOptions = []

    for (const uid in users) {
      const u = users[uid]
      const matchedId = ids.find(id => id === u.main_id || id === u.sec_id)

      if (matchedId) {
        onlineOptions.push({
          label: u.name || `User ${uid}`,
          value: `${group}|${matchedId}`,
          description: matchedId === u.main_id ? "Main ID online" : "Secondary ID online"
        })
      }
    }

    if (!onlineOptions.length) {
      const fallbackOptions = ids.slice(0, 25).map(id => ({
        label: id,
        value: `${group}|${id}`
      }))

      const fallbackMenu = new StringSelectMenuBuilder()
        .setCustomId("forced_offline_user_select")
        .setPlaceholder("Select online user")
        .addOptions(fallbackOptions)

      return interaction.update({
        content: `Online users found in ${getGroupLabel(group)} (fallback by ID)`,
        components: [new ActionRowBuilder().addComponents(fallbackMenu)]
      })
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId("forced_offline_user_select")
      .setPlaceholder("Select online user")
      .addOptions(onlineOptions.slice(0, 25))

    return interaction.update({
      content: `Select the online user to force offline in ${getGroupLabel(group)}`,
      components: [new ActionRowBuilder().addComponents(menu)]
    })
  }

  if (interaction.customId === "forced_offline_user_select") {
    if (!isChampion(interaction)) {
      return interaction.update({
        content: "❌ Only Champion can use this function",
        components: []
      })
    }

    const raw = interaction.values[0]
    const [group, id] = raw.split("|")

    await fetch(`${API_URL}?action=offline&id=${id}&group=${group}`)

    return interaction.update({
      content: `🔴 User forced offline in ${getGroupLabel(group)}`,
      components: []
    })
  }

  if (interaction.customId === "role_select") {
    const selectedRole = interaction.values[0]

    const userRoles = interaction.member.roles.cache
      .filter(r => Object.keys(GROUP_CONFIG).includes(r.name))
      .map(r => r.name)

    if (!userRoles.includes(selectedRole)) {
      return interaction.update({
        content: "❌ Invalid role selection",
        components: []
      })
    }

    const activeRoles = await getActiveRoles()
    activeRoles[interaction.user.id] = selectedRole
    await saveActiveRoles(activeRoles)

    return interaction.update({
      content: `✅ Active role changed to ${selectedRole}`,
      components: []
    })
  }

    
 
  } catch (err) {
    console.error("INDEX interaction error:", err);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Internal error",
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    } else {
      await interaction.followUp({
        content: "❌ Internal error",
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  }
});

  client.on("error", err => {
  console.error("Discord client error:", err);
});

process.on("unhandledRejection", err => {
  console.error("Unhandled rejection:", err);
});

process.on("uncaughtException", err => {
  console.error("Uncaught exception:", err);
});

// ================= START =================

client.login(TOKEN)
