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
const PANEL_CHANNEL_ID = "1484015417411244082"

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

///safereply
async function safeReply(interaction, options) {
  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp(options)
    } else {
      return await interaction.reply(options)
    }
  } catch (err) {
    console.error("safeReply error:", err)
  }
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

  const embed = new EmbedBuilder()
    .setTitle("🎮 PANEL CONTROL")
    .setDescription("Usa botones para controlar todo")

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

  await channel.send({embeds:[embed],components:[row1,row2,row3,row4,row5]})
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
  

  // ================= BOTONES =================




if (interaction.isButton()) {

  const modalButtons = ["register","add_sec","change","schedule","gp"]

  if (modalButtons.includes(interaction.customId)) {
    // ❌ NO defer aquí
  } else {
    await interaction.deferReply({ flags:64 })
  }
}
  // 🔥 SOLO AQUÍ defer
//  await interaction.deferReply({ flags:64 })

  const group = await getUserGroup(interaction)
  const config = GROUP_CONFIG[group]
  if (!group) return interaction.editReply("❌ No group")

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

  const group = await getUserGroup(interaction)

  if (!group) {
    return interaction.editReply("❌ No group")
  }

  const config = GROUP_CONFIG[group]

  const users = await getUsers(config.USERS_GIST_ID, config.USERS_FILENAME)
  const userData = users[interaction.user.id]

  if (!userData || !userData.main_id) {
    return interaction.editReply("❌ You must register your main ID first")
  }

  const res = await fetch(`${API_URL}?action=online&id=${userData.main_id}&group=${group}`)
  const text = await res.text()

  console.log("ONLINE:", text)

  return interaction.editReply("🟢 Main account set online")
}

    // ===== ONLINE SEC =====
  if (interaction.customId === "online_sec") {

  const group = await getUserGroup(interaction)

  if (!group) {
    return interaction.editReply("❌ No group")
  }

  const config = GROUP_CONFIG[group]

  const users = await getUsers(config.USERS_GIST_ID, config.USERS_FILENAME)
  const userData = users[interaction.user.id]

  if (!userData || !userData.sec_id) {
    return interaction.editReply("❌ You must register your secondary ID first")
  }

  const res = await fetch(`${API_URL}?action=online&id=${userData.sec_id}&group=${group}`)
  const text = await res.text()

  console.log("ONLINE SEC:", text)

  return interaction.editReply("🟢 Secondary account set online")
}

    // ===== OFFLINE =====
 if (interaction.customId === "online_sec") {

  const group = await getUserGroup(interaction)

  if (!group) {
    return interaction.editReply("❌ No group")
  }

  const config = GROUP_CONFIG[group]

  const users = await getUsers(config.USERS_GIST_ID, config.USERS_FILENAME)
  const userData = users[interaction.user.id]

  if (!userData || !userData.sec_id) {
    return interaction.editReply("❌ You must register your secondary ID first")
  }

  const res = await fetch(`${API_URL}?action=online&id=${userData.sec_id}&group=${group}`)
  const text = await res.text()

  console.log("ONLINE SEC:", text)

  return interaction.editReply("🟢 Secondary account set online")
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

  const member = interaction.member

  // 🔍 roles válidos que el usuario YA tiene
  const userGroups = Object.keys(GROUP_CONFIG).filter(group =>
    member.roles.cache.some(role => role.name === group)
  )

  if (userGroups.length === 0) {
    return interaction.editReply("❌ No tienes roles válidos")
  }

  if (userGroups.length === 1) {
    return interaction.editReply(`⚠️ Solo tienes un rol (**${userGroups[0]}**)`)
  }

  const options = userGroups.map(group => ({
    label: group.replace("_"," "),
    value: group
  }))

  const menu = new StringSelectMenuBuilder()
    .setCustomId("role_select")
    .setPlaceholder("Selecciona tu rol activo")
    .addOptions(options)

  return interaction.editReply({
    content:"🎯 Selecciona tu grupo:",
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
  if (!group) return safeReply(interaction,{content:"❌ No group",flags:64})

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

    return safeReply(interaction,{content:"✅ Registered",flags:64})
  }

  if (interaction.customId === "sec_modal") {
    const id = interaction.fields.getTextInputValue("id")

    if (!users[interaction.user.id])
      return safeReply(interaction,{content:"❌ Register first",flags:64})

    users[interaction.user.id].sec_id = id

    await saveUsers(users,config.USERS_GIST_ID,config.USERS_FILENAME)
    return safeReply(interaction,{content:"✅ Secondary added",flags:64})
  }

  if (interaction.customId === "change_modal") {
    const id = interaction.fields.getTextInputValue("id")

    if (!users[interaction.user.id])
      return safeReply(interaction,{content:"❌ Register first",flags:64})

    users[interaction.user.id].main_id = id

    await saveUsers(users,config.USERS_GIST_ID,config.USERS_FILENAME)
    return safeReply(interaction,{content:"🔄 Updated",flags:64})
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

    return safeReply(interaction,{content:"✅ Schedule saved",flags:64})
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
      flags:64
    })
  }

}



  // ================= SELECT MENUS =================

  if (interaction.isStringSelectMenu()) {

  if (interaction.customId.startsWith("gp_select_")) {

    const id = interaction.customId.split("_")[2]
    const group = interaction.values[0]

    await addVipID(id,group)

    return interaction.update({
      content:`✅ VIP added`,
      components:[]
    })
  }

    if (interaction.customId === "offline_select") {
      const id = interaction.values[0]
      const group = await getUserGroup(interaction)

      await fetch(`${API_URL}?action=offline&id=${id}&group=${group}`)

      return interaction.update({content:`🔴 Offline ${id}`,components:[]})
    }

   if (interaction.customId === "role_select") {

  const selectedRole = interaction.values[0]
  const member = interaction.member

  // quitar roles de grupo actuales
  const rolesToRemove = member.roles.cache.filter(r =>
    Object.keys(GROUP_CONFIG).includes(r.name)
  )

  for (const role of rolesToRemove.values()) {
    await member.roles.remove(role)
  }

  // agregar el nuevo rol
  const newRole = interaction.guild.roles.cache.find(r => r.name === selectedRole)

  if (newRole) {
    await member.roles.add(newRole)
  }

  return interaction.update({
    content:`✅ Ahora eres ${selectedRole}`,
    components:[]
  })
}

  }

})

// ================= START =================

client.login(TOKEN)
