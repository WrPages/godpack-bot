
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
  StringSelectMenuBuilder
} = require("discord.js")

const fetch = require("node-fetch")
const fs = require("fs")

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
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



// ================= HELPERS =================

function loadSchedules(){
  if(!fs.existsSync(SCHEDULE_FILE)) return {}
  return JSON.parse(fs.readFileSync(SCHEDULE_FILE))
}

function saveSchedules(data){
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data,null,2))
}

async function getUsers(gistId,file){
  const res = await fetch(`https://api.github.com/gists/${gistId}`)
  const data = await res.json()
  return JSON.parse(data.files[file]?.content || "{}")
}

async function saveUsers(users,gistId,file){
  await fetch(`https://api.github.com/gists/${gistId}`,{
    method:"PATCH",
    headers:{Authorization:`Bearer ${GITHUB_TOKEN}`},
    body:JSON.stringify({
      files:{[file]:{content:JSON.stringify(users,null,2)}}
    })
  })
}

async function getOnlineIDs(gistId,file){
  const res = await fetch(`https://api.github.com/gists/${gistId}`)
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
    headers:{Authorization:`Bearer ${GITHUB_TOKEN}`},
    body:JSON.stringify({
      files:{[config.VIP_FILENAME]:{content:ids.join("\n")}}
    })
  })
}

// ===== GROUP =====
async function getUserGroup(interaction){
  const role = interaction.member.roles.cache.find(r =>
    Object.keys(GROUP_CONFIG).includes(r.name)
  )
  return role?.name || null
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
  setInterval(async()=>{
    const schedules = loadSchedules()
    const now = new Date()

    for(const uid in schedules){
      const s = schedules[uid]

      const hour = now.getUTCHours()
      const min = now.getUTCMinutes()

      if(hour===s.online_hour && min===s.online_minute){
        await fetch(`${API_URL}?action=online&id=${s.main_id}&group=${s.group}`)
      }

      if(hour===s.offline_hour && min===s.offline_minute){
        await fetch(`${API_URL}?action=offline&id=${s.main_id}&group=${s.group}`)
      }
    }

  },60000)
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

client.once("ready", async()=>{
  console.log("🔥 Bot listo")

  const ch = await client.channels.fetch(PANEL_CHANNEL_ID)
  await sendPanel(ch)

  startScheduler()
})

// ================= INTERACTIONS =================

client.on("interactionCreate", async interaction => {

  // ================= BOTONES =================

  if (interaction.isButton()) {

    const group = await getUserGroup(interaction)
    if (!group) return interaction.reply({ content:"❌ No group", ephemeral:true })

    const isModal = ["register","add_sec","change","schedule","gp"].includes(interaction.customId)

    if (!isModal) {
      await interaction.deferReply({ ephemeral: true })
    }

    const config = GROUP_CONFIG[group]
    const users = await getUsers(config.USERS_GIST_ID,config.USERS_FILENAME)
    const userData = users[interaction.user.id]

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
      if (!userData?.main_id) return interaction.editReply("❌ Register first")

      await fetch(`${API_URL}?action=online&id=${userData.main_id}&group=${group}`)
      return interaction.editReply("🟢 ONLINE")
    }

    // ===== ONLINE SEC =====
    if (interaction.customId === "online_sec") {
      if (!userData?.sec_id) return interaction.editReply("❌ No secondary ID")

      await fetch(`${API_URL}?action=online&id=${userData.sec_id}&group=${group}`)
      return interaction.editReply("🟢 SEC ONLINE")
    }

    // ===== OFFLINE =====
    if (interaction.customId === "offline") {
      if (!userData) return interaction.editReply("❌ Not registered")

      if (userData.main_id)
        await fetch(`${API_URL}?action=offline&id=${userData.main_id}&group=${group}`)

      if (userData.sec_id)
        await fetch(`${API_URL}?action=offline&id=${userData.sec_id}&group=${group}`)

      return interaction.editReply("🔴 OFFLINE")
    }

    // ===== LIST =====
    if (interaction.customId === "list") {

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
        .filter(r=>Object.keys(GROUP_CONFIG).includes(r.name))
        .map(r=>({label:r.name,value:r.name}))

      const menu = new StringSelectMenuBuilder()
        .setCustomId("role_select")
        .addOptions(roles)

      return interaction.editReply({
        content:"Select role",
        components:[new ActionRowBuilder().addComponents(menu)]
      })
    }

    // ===== FORCE OFFLINE =====
    if (interaction.customId === "set_offline") {

      const ids = await getOnlineIDs(config.IDS_GIST_ID,config.IDS_FILENAME)

      if (!ids.length) return interaction.editReply("⚫ No users online")

      const options = ids.slice(0,25).map(id=>({
        label:id,
        value:id
      }))

      const menu = new StringSelectMenuBuilder()
        .setCustomId("offline_select")
        .addOptions(options)

      return interaction.editReply({
        content:"Select ID",
        components:[new ActionRowBuilder().addComponents(menu)]
      })
    }

    // ===== GP =====
    if (interaction.customId === "gp") {
      const modal = new ModalBuilder()
        .setCustomId("gp_modal")
        .setTitle("Add VIP")

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("id").setLabel("VIP ID").setStyle(TextInputStyle.Short)
        )
      )

      return interaction.showModal(modal)
    }

  }

  // ================= MODALES =================

  if (interaction.isModalSubmit()) {

    const group = await getUserGroup(interaction)
    if (!group) return interaction.reply({content:"❌ No group",ephemeral:true})

    const config = GROUP_CONFIG[group]
    let users = await getUsers(config.USERS_GIST_ID,config.USERS_FILENAME)

    if (interaction.customId === "reg_modal") {
      const id = interaction.fields.getTextInputValue("id")

      users[interaction.user.id] = {
        main_id:id,
        sec_id:null,
        name:interaction.member.displayName
      }

      await saveUsers(users,config.USERS_GIST_ID,config.USERS_FILENAME)
      return interaction.reply({ content: "✅ Registered", ephemeral: true })
    }

    if (interaction.customId === "sec_modal") {
      const id = interaction.fields.getTextInputValue("id")

      if (!users[interaction.user.id])
        return interaction.reply({content:"❌ Register first",ephemeral:true})

      users[interaction.user.id].sec_id = id

      await saveUsers(users,config.USERS_GIST_ID,config.USERS_FILENAME)
      return interaction.reply({content:"✅ Secondary added",ephemeral:true})
    }

    if (interaction.customId === "change_modal") {
      const id = interaction.fields.getTextInputValue("id")

      if (!users[interaction.user.id])
        return interaction.reply({content:"❌ Register first",ephemeral:true})

      users[interaction.user.id].main_id = id

      await saveUsers(users,config.USERS_GIST_ID,config.USERS_FILENAME)
      return interaction.reply({content:"🔄 Updated",ephemeral:true})
    }

    if (interaction.customId === "schedule_modal") {

      const on = interaction.fields.getTextInputValue("on").split(":")
      const off = interaction.fields.getTextInputValue("off").split(":")

      const schedules = loadSchedules()

      schedules[interaction.user.id] = {
        group,
        main_id:users[interaction.user.id].main_id,
        online_hour:+on[0],
        online_minute:+on[1],
        offline_hour:+off[0],
        offline_minute:+off[1]
      }

      saveSchedules(schedules)

      return interaction.reply({content:"✅ Schedule saved",ephemeral:true})
    }

    if (interaction.customId === "gp_modal") {
      const id = interaction.fields.getTextInputValue("id")

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`gp_select_${id}`)
        .addOptions([
          {label:"Trainer",value:"Trainer"},
          {label:"Gym Leader",value:"Gym_Leader"},
          {label:"Elite Four",value:"Elite_Four"}
        ])

      return interaction.reply({
        content:"Select group",
        components:[new ActionRowBuilder().addComponents(menu)],
        ephemeral:true
      })
    }

  }

  // ================= SELECT MENUS =================

  if (interaction.isStringSelectMenu()) {

    if (interaction.customId.startsWith("gp_select_")) {
      const id = interaction.customId.split("_")[2]
      const group = interaction.values[0]

      await addVipID(id,group)

      return interaction.update({content:`✅ VIP added`,components:[]})
    }

    if (interaction.customId === "offline_select") {
      const id = interaction.values[0]
      const group = await getUserGroup(interaction)

      await fetch(`${API_URL}?action=offline&id=${id}&group=${group}`)

      return interaction.update({content:`🔴 Offline ${id}`,components:[]})
    }

    if (interaction.customId === "role_select") {
      return interaction.update({content:`✅ Role selected`,components:[]})
    }

  }

})

// ================= START =================

client.login(TOKEN)
