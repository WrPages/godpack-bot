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
    GatewayIntentBits.GuildMembers
  ]
})

// ================= CONFIG =================

const TOKEN = process.env.TOKEN
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const API_URL = "https://add-ids.netlify.app/.netlify/functions/api"
const PANEL_CHANNEL_ID = "1484015417411244082"

// ================= SAFE REPLY =================

async function safeReply(interaction, content, options = {}) {
  try {
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({ content, ...options })
    }
    return interaction.reply({ content, ...options })
  } catch (e) {
    console.error("Reply error:", e)
  }
}

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

// ================= ACTIVE ROLE =================

const ACTIVE_ROLE_GIST_ID = "49c42c0a844bbc4d2c0187fc254140d1"
const ACTIVE_ROLE_FILE = "active_roles.json"

async function getActiveRoles() {
  const res = await fetch(`https://api.github.com/gists/${ACTIVE_ROLE_GIST_ID}`)
  const data = await res.json()
  return JSON.parse(data.files[ACTIVE_ROLE_FILE]?.content || "{}")
}

async function saveActiveRoles(data) {
  await fetch(`https://api.github.com/gists/${ACTIVE_ROLE_GIST_ID}`, {
    method:"PATCH",
    headers:{Authorization:`Bearer ${GITHUB_TOKEN}`},
    body:JSON.stringify({
      files:{[ACTIVE_ROLE_FILE]:{content:JSON.stringify(data,null,2)}}
    })
  })
}

// ================= HELPERS =================

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

async function getUserGroup(interaction){
  const active = await getActiveRoles()

  if(active[interaction.user.id]) return active[interaction.user.id]

  const role = interaction.member.roles.cache.find(r =>
    Object.keys(GROUP_CONFIG).includes(r.name)
  )

  return role?.name || null
}

// ================= SCHEDULE =================

const SCHEDULE_FILE = "./daily_schedules.json"

function loadSchedules(){
  if(!fs.existsSync(SCHEDULE_FILE)) return {}
  return JSON.parse(fs.readFileSync(SCHEDULE_FILE))
}

function saveSchedules(data){
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data,null,2))
}

function startScheduler(){
  setInterval(async()=>{
    const schedules = loadSchedules()
    const now = new Date()
    const today = now.toISOString().slice(0,10)

    for(const uid in schedules){
      const s = schedules[uid]

      if(now.getUTCHours()===s.online_hour && now.getUTCMinutes()===s.online_minute && s.last_online!==today){
        await fetch(`${API_URL}?action=online&id=${s.main_id}&group=${s.group}`)
        s.last_online = today
      }

      if(now.getUTCHours()===s.offline_hour && now.getUTCMinutes()===s.offline_minute && s.last_offline!==today){
        await fetch(`${API_URL}?action=offline&id=${s.main_id}&group=${s.group}`)
        s.last_offline = today
      }
    }

    saveSchedules(schedules)
  },60000)
}

// ================= PANEL =================

async function sendPanel(channel){

  const embed = new EmbedBuilder()
    .setTitle("🎮 PANEL CONTROL")
    .setDescription("Botones completamente funcionales")

  const rows = [
    ["register","add_sec","change"],
    ["online","offline","online_sec"],
    ["list","online_list"],
    ["schedule","change_role","set_offline"],
    ["gp"]
  ].map(r=>new ActionRowBuilder().addComponents(
    r.map(id=>new ButtonBuilder().setCustomId(id).setLabel(id).setStyle(ButtonStyle.Secondary))
  ))

  await channel.send({embeds:[embed],components:rows})
}

// ================= READY =================

client.once("clientReady", async()=>{
  console.log("🔥 Bot listo")

  const ch = await client.channels.fetch(PANEL_CHANNEL_ID)
  await sendPanel(ch)

  startScheduler()
})

// ================= INTERACTIONS =================

client.on("interactionCreate", async interaction => {

  if(interaction.isButton()){

    const id = interaction.customId

    // ===== REGISTER =====
    if(id==="register"){
      const modal = new ModalBuilder()
        .setCustomId("reg_modal")
        .setTitle("Register")

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("id")
            .setLabel("Main ID")
            .setStyle(TextInputStyle.Short)
        )
      )

      return interaction.showModal(modal)
    }

    // ===== ADD SEC =====
    if(id==="add_sec"){
      const modal = new ModalBuilder()
        .setCustomId("sec_modal")
        .setTitle("Add Secondary")

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("id")
            .setLabel("Secondary ID")
            .setStyle(TextInputStyle.Short)
        )
      )

      return interaction.showModal(modal)
    }

    // ===== CHANGE =====
    if(id==="change"){
      const modal = new ModalBuilder()
        .setCustomId("change_modal")
        .setTitle("Change Main")

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("id")
            .setLabel("New ID")
            .setStyle(TextInputStyle.Short)
        )
      )

      return interaction.showModal(modal)
    }

    // ===== ONLINE =====
    if(id==="online"){
      const group = await getUserGroup(interaction)
      const config = GROUP_CONFIG[group]
      const users = await getUsers(config.USERS_GIST_ID,config.USERS_FILENAME)
      const u = users[interaction.user.id]

      await fetch(`${API_URL}?action=online&id=${u.main_id}&group=${group}`)
      return safeReply(interaction,"🟢 ONLINE")
    }

    // ===== OFFLINE =====
    if(id==="offline"){
      const group = await getUserGroup(interaction)
      const config = GROUP_CONFIG[group]
      const users = await getUsers(config.USERS_GIST_ID,config.USERS_FILENAME)
      const u = users[interaction.user.id]

      await fetch(`${API_URL}?action=offline&id=${u.main_id}&group=${group}`)
      return safeReply(interaction,"🔴 OFFLINE")
    }

    // ===== ONLINE SEC =====
    if(id==="online_sec"){
      const group = await getUserGroup(interaction)
      const config = GROUP_CONFIG[group]
      const users = await getUsers(config.USERS_GIST_ID,config.USERS_FILENAME)
      const u = users[interaction.user.id]

      await fetch(`${API_URL}?action=online&id=${u.sec_id}&group=${group}`)
      return safeReply(interaction,"🟢 SEC ONLINE")
    }

    // ===== LIST =====
    if(id==="list"){
      const group = await getUserGroup(interaction)
      const config = GROUP_CONFIG[group]
      const users = await getUsers(config.USERS_GIST_ID,config.USERS_FILENAME)

      let msg = `📋 ${group}\n`
      for(const uid in users){
        msg += `\n${users[uid].name} → ${users[uid].main_id}`
      }

      return safeReply(interaction,msg)
    }

    // ===== ONLINE LIST =====
    if(id==="online_list"){
      const group = await getUserGroup(interaction)
      const config = GROUP_CONFIG[group]

      const ids = await getOnlineIDs(config.IDS_GIST_ID,config.IDS_FILENAME)
      const users = await getUsers(config.USERS_GIST_ID,config.USERS_FILENAME)

      let msg = `🟢 ${group}\n`

      for(const uid in users){
        const u = users[uid]
        if(ids.includes(u.main_id) || ids.includes(u.sec_id)){
          msg += `\n${u.name}`
        }
      }

      return safeReply(interaction,msg)
    }

    // ===== CHANGE ROLE =====
    if(id==="change_role"){
      const roles = interaction.member.roles.cache
        .filter(r=>Object.keys(GROUP_CONFIG).includes(r.name))
        .map(r=>({label:r.name,value:r.name}))

      const menu = new StringSelectMenuBuilder()
        .setCustomId("role_select")
        .addOptions(roles)

      return safeReply(interaction,"Selecciona rol",{components:[new ActionRowBuilder().addComponents(menu)],ephemeral:true})
    }

    // ===== GP =====
    if(id==="gp"){
      const modal = new ModalBuilder()
        .setCustomId("gp_modal")
        .setTitle("VIP")

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("id").setLabel("ID").setStyle(TextInputStyle.Short)
        )
      )

      return interaction.showModal(modal)
    }

    // ===== SCHEDULE =====
    if(id==="schedule"){
      const modal = new ModalBuilder()
        .setCustomId("schedule_modal")
        .setTitle("Schedule")

      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("on").setLabel("HH:MM").setStyle(TextInputStyle.Short)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("off").setLabel("HH:MM").setStyle(TextInputStyle.Short))
      )

      return interaction.showModal(modal)
    }

    // ===== SET OFFLINE =====
    if(id==="set_offline"){
      const group = await getUserGroup(interaction)
      const config = GROUP_CONFIG[group]

      const ids = await getOnlineIDs(config.IDS_GIST_ID,config.IDS_FILENAME)

      const menu = new StringSelectMenuBuilder()
        .setCustomId("select_offline")
        .addOptions(ids.map(i=>({label:i,value:i})).slice(0,25))

      return safeReply(interaction,"Selecciona",{components:[new ActionRowBuilder().addComponents(menu)],ephemeral:true})
    }
  }

  // ===== MODALS =====

  if(interaction.isModalSubmit()){

    const group = await getUserGroup(interaction)
    const config = GROUP_CONFIG[group]
    let users = await getUsers(config.USERS_GIST_ID,config.USERS_FILENAME)

    if(interaction.customId==="reg_modal"){
      const id = interaction.fields.getTextInputValue("id")
      users[interaction.user.id]={main_id:id,sec_id:null,name:interaction.member.displayName}
      await saveUsers(users,config.USERS_GIST_ID,config.USERS_FILENAME)
      return safeReply(interaction,"✅ Registrado")
    }

    if(interaction.customId==="sec_modal"){
      const id = interaction.fields.getTextInputValue("id")
      users[interaction.user.id].sec_id=id
      await saveUsers(users,config.USERS_GIST_ID,config.USERS_FILENAME)
      return safeReply(interaction,"✅ Sec añadido")
    }

    if(interaction.customId==="change_modal"){
      const id = interaction.fields.getTextInputValue("id")
      users[interaction.user.id].main_id=id
      await saveUsers(users,config.USERS_GIST_ID,config.USERS_FILENAME)
      return safeReply(interaction,"🔄 Cambiado")
    }

    if(interaction.customId==="schedule_modal"){
      const on = interaction.fields.getTextInputValue("on").split(":")
      const off = interaction.fields.getTextInputValue("off").split(":")

      const schedules = loadSchedules()

      schedules[interaction.user.id]={
        group,
        main_id:users[interaction.user.id].main_id,
        online_hour:+on[0],
        online_minute:+on[1],
        offline_hour:+off[0],
        offline_minute:+off[1]
      }

      saveSchedules(schedules)

      return safeReply(interaction,"✅ Schedule guardado")
    }

    if(interaction.customId==="gp_modal"){
      const id = interaction.fields.getTextInputValue("id")

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`gp_${id}`)
        .addOptions([
          {label:"Trainer",value:"Trainer"},
          {label:"Gym",value:"Gym_Leader"},
          {label:"Elite",value:"Elite_Four"}
        ])

      return safeReply(interaction,"Selecciona grupo",{components:[new ActionRowBuilder().addComponents(menu)],ephemeral:true})
    }
  }

  // ===== SELECT =====

  if(interaction.isStringSelectMenu()){

    if(interaction.customId==="role_select"){
      const roles = await getActiveRoles()
      roles[interaction.user.id]=interaction.values[0]
      await saveActiveRoles(roles)

      return interaction.update({content:"✅ Rol activo cambiado",components:[]})
    }

    if(interaction.customId.startsWith("gp_")){
      const id = interaction.customId.split("_")[1]
      const group = interaction.values[0]

      await addVipID(id,group)

      return interaction.update({content:"✅ VIP agregado",components:[]})
    }

    if(interaction.customId==="select_offline"){
      const id = interaction.values[0]

      const btn = new ButtonBuilder()
        .setCustomId(`confirm_${id}`)
        .setLabel("Confirm")
        .setStyle(ButtonStyle.Danger)

      return interaction.update({
        content:`Confirmar ${id}`,
        components:[new ActionRowBuilder().addComponents(btn)]
      })
    }
  }

  // ===== CONFIRM =====

  if(interaction.isButton() && interaction.customId.startsWith("confirm_")){
    const id = interaction.customId.split("_")[1]
    const group = await getUserGroup(interaction)

    await fetch(`${API_URL}?action=offline&id=${id}&group=${group}`)

    return interaction.update({content:"🔴 Offline aplicado",components:[]})
  }

})

// ================= START =================

client.login(TOKEN)
