 const { Client, GatewayIntentBits, EmbedBuilder, ModalBuilder,
  TextInputBuilder,TextInputStyle,ActionRowBuilder,StringSelectMenuBuilder, ButtonBuilder, ButtonStyle} = require('discord.js')
const fetch = require('node-fetch')

const { startPanelSystem } = require("./statsPanel");



const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
})

const TOKEN = process.env.TOKEN
const API_URL = "https://add-ids.netlify.app/.netlify/functions/api"


const GITHUB_TOKEN = process.env.GITHUB_TOKEN

//detecta onlineppm
const GROUP_CONFIG = {
  Trainer: {
    USERS_FILENAME: "trainer_users.json",
    USERS_GIST_ID: "1c066922bc39ac136b6f234fad6d9420",
    IDS_GIST_ID: "4edcf4d341cd4f7d5d0fb8a50f8b8c3c",
    VIP_GIST_ID: "16541fd83785a49ad4a0f22bbeb06000"
  },
  Gym_Leader: {
    USERS_FILENAME: "gym_users.json",
    USERS_GIST_ID: "a3f5f3d8a2e6ddf2378fb3481dff49f6",
    IDS_GIST_ID: "e110c37b3e0b8de83a33a1b0a5eb64e8",
    VIP_GIST_ID: "79a0e30c401cfd63e78d9ec5a9210091"
  },
  Elite_Four: {
    USERS_FILENAME: "elite_users.json",
    USERS_GIST_ID: "bb18eda2ea748723d8fe0131dd740b70",
    IDS_GIST_ID: "d9db3a72fed74c496fd6cc830f9ca6e9",
    VIP_GIST_ID: "5f2f23e0391882ab4e255bd67e98334a"
  }
}




function getUserGroup(interaction) {
  const member = interaction.member

  const role = member.roles.cache.find(r =>
    Object.keys(GROUP_CONFIG).includes(r.name)
  )

  if (!role) return null

  return role.name
}



async function getOnlineIDs(gistId) {
  try {

    const res = await fetch(
      `https://api.github.com/gists/${gistId}?t=${Date.now()}`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Cache-Control": "no-cache"
        }
      }
    )

    const data = await res.json()

const content = data.files[config.IDS_FILENAME]?.content || "";

    return content
      .split("\n")
      .map(x => x.trim())
      .filter(x => x.length > 0)

  } catch (err) {
    console.error("Error leyendo ids:", err)
    return []
  }
}

//termina
const fs = require("fs")

const HISTORY_FILE = "./ppm_history.json"
const TWELVE_HOURS = 12 * 60 * 60 * 1000

// ================= DAILY SCHEDULE SYSTEM =================

const SCHEDULE_FILE = "./daily_schedules.json"

function loadSchedules() {
  if (!fs.existsSync(SCHEDULE_FILE)) return {}
  return JSON.parse(fs.readFileSync(SCHEDULE_FILE))
}

function saveSchedules(data) {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2))
}

function startDailyScheduler() {

  setInterval(async () => {

    const schedules = loadSchedules()
    const now = new Date()

    const utcHour = now.getUTCHours()
    const utcMinute = now.getUTCMinutes()
    const todayUTC = now.toISOString().slice(0,10)

    for (const userId in schedules) {

      const data = schedules[userId]
      if (!data.group || !data.main_id) continue

      // ONLINE
      if (
        data.online_hour === utcHour &&
        data.online_minute === utcMinute &&
        data.last_online !== todayUTC
      ) {
        await fetch(`${API_URL}?action=online&id=${data.main_id}&group=${data.group}`)
        data.last_online = todayUTC
        console.log("🟢 Daily ONLINE ejecutado:", data.main_id)
      }

      // OFFLINE
      if (
        data.offline_hour === utcHour &&
        data.offline_minute === utcMinute &&
        data.last_offline !== todayUTC
      ) {
        await fetch(`${API_URL}?action=offline&id=${data.main_id}&group=${data.group}`)
        data.last_offline = todayUTC
        console.log("🔴 Daily OFFLINE ejecutado:", data.main_id)
      }

    }

    saveSchedules(schedules)

  }, 60 * 1000)

}


function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return []
  return JSON.parse(fs.readFileSync(HISTORY_FILE))
}

function saveHistory(data) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(data))
}

//let onlineUsers = {}

async function getUsers(gistId, fileName) {
  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}?t=${Date.now()}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Cache-Control": "no-cache"
      }
    })

    const data = await res.json()

    if (!data.files || !data.files[fileName]) {
      return {}
    }

    return JSON.parse(data.files[fileName].content || "{}")

  } catch (err) {
    console.error("Error loading users:", err)
    return {}
  }
}


async function saveUsers(users, gistId, fileName) {
  await fetch(`https://api.github.com/gists/${gistId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json"
    },
    body: JSON.stringify({
      files: {
        [fileName]: {
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
 startDailyScheduler() 
  console.log("Bot ready 🔥")
})
require("./gpHandler")(client);


//Comandos
client.once("ready", async () => {
  console.log(`✅ Bot listo como ${client.user.tag}`);
  
  
  client.once("ready", () => {
    console.log("Bot online");

    startPanelSystem(client); // 👈 AQUÍ ACTIVAS EL PANEL
});



  const { REST, Routes, SlashCommandBuilder } = require("discord.js");

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  //try {


    // 🗑️ BORRAR COMANDOS ANTIGUOS DEL SERVIDOR
   // await rest.put(
     // Routes.applicationGuildCommands(
      // process.env.CLIENT_ID,
     //  process.env.GUILD_ID
     // ),
   //   { body: [] }
  // );

  //  console.log("🗑️ Comandos antiguos eliminados");

 // } catch (error) {
 //   console.error("❌ Error borrando comandos:", error);
 // }

  // 🔥 DEFINIR COMANDOS NUEVOS
  const commands = [

    new SlashCommandBuilder()
      .setName("register")
      .setDescription("Register your main game ID")
      .addStringOption(option =>
        option.setName("id")
          .setDescription("Your 16 digit main ID")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("add_sec")
      .setDescription("Register your secondary game ID")
      .addStringOption(option =>
        option.setName("id")
          .setDescription("Your 16 digit secondary ID")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("change")
      .setDescription("Change your main game ID")
      .addStringOption(option =>
        option.setName("id")
          .setDescription("New 16 digit ID")
          .setRequired(true)
      ),

///////

new SlashCommandBuilder()
  .setName("schedule_events")
  .setDescription("Daily online/offline scheduler (UTC)")
  .addStringOption(opt =>
    opt.setName("mode")
      .setDescription("Start or Stop")
      .setRequired(true)
      .addChoices(
        { name: "Start Daily Schedule", value: "start" },
        { name: "Stop All Schedules", value: "stop" }
      )
  )
  .addIntegerOption(opt =>
    opt.setName("online_hour")
      .setDescription("Online Hour (UTC 0-23)")
      .setRequired(false)
  )
  .addIntegerOption(opt =>
    opt.setName("online_minute")
      .setDescription("Online Minute (0-59)")
      .setRequired(false)
  )
  .addIntegerOption(opt =>
    opt.setName("offline_hour")
      .setDescription("Offline Hour (UTC 0-23)")
      .setRequired(false)
  )
  .addIntegerOption(opt =>
    opt.setName("offline_minute")
      .setDescription("Offline Minute (0-59)")
      .setRequired(false)
  ),

new SlashCommandBuilder()
  .setName("set_offline")
  .setDescription("Force a user offline"),



   
/////
    new SlashCommandBuilder()
      .setName("online")
      .setDescription("Set your main account online"),

    new SlashCommandBuilder()
      .setName("online_sec")
      .setDescription("Set your secondary account online"),

    new SlashCommandBuilder()
      .setName("offline")
      .setDescription("Set your accounts offline"),

    new SlashCommandBuilder()
      .setName("list")
      .setDescription("List registered users"),

    new SlashCommandBuilder()
      .setName("online_list")
      .setDescription("List online users in your group"),

    new SlashCommandBuilder()
      .setName("gp")
      .setDescription("Add VIP ID")
      .addStringOption(option =>
        option.setName("id")
          .setDescription("16 digit VIP ID")
          .setRequired(true)
      )
  
      
      

  ].map(cmd => cmd.toJSON());

  try {

    // 🚀 REGISTRAR NUEVOS COMANDOS
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log("✅ Slash commands registrados automáticamente");

  } catch (error) {
    console.error("❌ Error registrando comandos:", error);
  }
});
//termina comandos

client.login(process.env.TOKEN)

// StartPPMCounter

const HEARTBEAT_CHANNEL_ID = "1483616146996465735"
const TOTAL_CHANNEL_ID = "1484416376436424794"

// ===== CONTADOR DE PPM =====
//const HISTORY_FILE = "./ppm_history.json";
//const TWELVE_HOURS = 12 * 60 * 60 * 1000;

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  return JSON.parse(fs.readFileSync(HISTORY_FILE));
}

function saveHistory(data) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(data));
}

// ====== NUEVO updateTotalPPM ======
//const HISTORY_FILE = "./ppm_history.json";
//const TWELVE_HOURS = 12 * 60 * 60 * 1000;

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  return JSON.parse(fs.readFileSync(HISTORY_FILE));
}

function saveHistory(data) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(data));
}

async function updateTotalPPM() {
  try {
    const heartbeatChannel = await client.channels.fetch(HEARTBEAT_CHANNEL_ID);
    const totalChannel = await client.channels.fetch(TOTAL_CHANNEL_ID);

    const messages = await heartbeatChannel.messages.fetch({ limit: 20 });

    // 🔹 Cargar lista online actual
    const eliteConfig = GROUP_CONFIG["Elite_Four"];
    const onlineUsers = await getUsers(eliteConfig.USERS_GIST_ID, eliteConfig.USERS_FILENAME);
    
    // Solo los usuarios que tienen main_id o sec_id online (simplificamos)
    const onlineNamesSet = new Set();
    for (const uid in onlineUsers) {
      const u = onlineUsers[uid];
      if (u.main_id || u.sec_id) onlineNamesSet.add(u.name.split("#")[0].trim());
    }

    let totalPPM = 0;
    const ppmUsers = [];
    const processedNames = new Set();

    for (const msg of messages.values()) {
      if (!msg.author.bot) continue;

      const lines = msg.content.split("\n").map(l => l.trim());
      if (lines.length < 2) continue;

      const heartbeatName = lines[0].replace(":", "").trim();

      // ✅ Solo procesar si el nombre está en la lista online
      if (![...onlineNamesSet].some(n => heartbeatName.toLowerCase() === n.toLowerCase())) continue;
      if (processedNames.has(heartbeatName)) continue;

      // Buscar línea de ppm
      const avgLine = lines.find(l => l.includes("Avg:"));
      if (!avgLine) continue;

      const match = avgLine.match(/Avg:\s*([\d.]+)/);
      if (!match) continue;

      const ppm = parseFloat(match[1]);
      if (isNaN(ppm)) continue;

      totalPPM += ppm;
      ppmUsers.push({ name: heartbeatName, ppm });
      processedNames.add(heartbeatName);
    }

    // ===== HISTORIAL 12H =====
    let history = loadHistory();
    const now = Date.now();
    history.push({ timestamp: now, value: totalPPM });
    history = history.filter(entry => now - entry.timestamp <= TWELVE_HOURS);
    saveHistory(history);

    const avg12h = history.length > 0 ? history.reduce((a, b) => a + b.value, 0) / history.length : 0;

    // ===== CONSTRUIR MENSAJE =====
    ppmUsers.sort((a, b) => b.ppm - a.ppm);

    let messageContent = "";
    messageContent += "━━━━━━━━━━━━━━━━━━━━━━\n";
    messageContent += "🚀 **Global PPM**\n";
    messageContent += "━━━━━━━━━━━━━━━━━━━━━━\n\n";
    messageContent += `# 🔥 ${totalPPM.toFixed(2)}\n`;
    messageContent += "**Current PPM**\n\n";
    messageContent += "━━━━━━━━━━━━━━━━━━━━━━\n";
    messageContent += `📊 **12H Average:** ${avg12h.toFixed(2)} ppm\n`;
    messageContent += "━━━━━━━━━━━━━━━━━━━━━━\n\n";

    if (ppmUsers.length === 0) {
      messageContent += "⚫ No users online\n";
    } else {
      messageContent += "🟢 **Online users**\n";
      messageContent += "────────────────────\n";
      for (const user of ppmUsers) {
        messageContent += `• **${user.name}** → \`${user.ppm.toFixed(2)} ppm\`\n`;
      }
    }
    messageContent += "\n━━━━━━━━━━━━━━━━━━━━━━";

    // 🔹 Editar o enviar mensaje
    const existingMessages = await totalChannel.messages.fetch({ limit: 5 });
    const botMessage = existingMessages.find(m => m.author.id === client.user.id);

    if (botMessage) {
      await botMessage.edit(messageContent);
    } else {
      await totalChannel.send(messageContent);
    }

    console.log("✅ PPM total actualizado");

  } catch (err) {
    console.error("❌ Error actualizando PPM:", err);
  }
}

// 🔹 Activar contador cada 5 minutos
setInterval(updateTotalPPM, 5 * 60 * 1000);
updateTotalPPM();
//FinishPPM




client.on("interactionCreate", async (interaction) => {
 // if (!interaction.isChatInputCommand()) return
  const { commandName } = interaction;

  const userId = interaction.user.id
  let users = await getUsers()

//SCHENDULE

if (interaction.commandName === "schedule_events") {

  const mode = interaction.options.getString("mode")
  const schedules = loadSchedules()

const now = new Date()

const utcNow = now.toISOString().slice(11,16) // HH:MM en UTC real 24h
  if (mode === "stop") {

    delete schedules[interaction.user.id]
    saveSchedules(schedules)

    return interaction.reply(`🛑 All daily schedules stopped.\n🕒 Current UTC time: ${utcNow}`)
  }

  const group = getUserGroup(interaction)
  if (!group) return interaction.reply("❌ No reroll group detected")

  const config = GROUP_CONFIG[group]

  let users = await getUsers(config.USERS_GIST_ID, config.USERS_FILENAME)
  const userData = users[interaction.user.id]

  if (!userData?.main_id) {
    return interaction.reply("❌ You must register first")
  }

  const onlineHour = interaction.options.getInteger("online_hour")
  const onlineMinute = interaction.options.getInteger("online_minute")
  const offlineHour = interaction.options.getInteger("offline_hour")
  const offlineMinute = interaction.options.getInteger("offline_minute")

  if (
    onlineHour == null || onlineMinute == null ||
    offlineHour == null || offlineMinute == null
  ) {
    return interaction.reply("❌ You must provide all time values")
  }

  if (
    onlineHour < 0 || onlineHour > 23 ||
    offlineHour < 0 || offlineHour > 23 ||
    onlineMinute < 0 || onlineMinute > 59 ||
    offlineMinute < 0 || offlineMinute > 59
  ) {
    return interaction.reply("❌ Invalid UTC time format")
  }

  schedules[interaction.user.id] = {
    group,
    main_id: userData.main_id,
    online_hour: onlineHour,
    online_minute: onlineMinute,
    offline_hour: offlineHour,
    offline_minute: offlineMinute,
    last_online: null,
    last_offline: null
  }

  saveSchedules(schedules)

  return interaction.reply(
    `✅ Daily schedule activated\n\n` +
    `🟢 Online: ${onlineHour.toString().padStart(2,"0")}:${onlineMinute.toString().padStart(2,"0")} UTC\n` +
    `🔴 Offline: ${offlineHour.toString().padStart(2,"0")}:${offlineMinute.toString().padStart(2,"0")} UTC\n\n` +
    `🕒 Current UTC time: ${utcNow}`
  )
}



 
// 🔹 VIP ids
if (interaction.commandName === "gp") {
  const id = interaction.options.getString("id")

  if (!/^\d{16}$/.test(id)) {
    return interaction.reply("❌ ID must be 16 digits")
  }

  await addVipID(id)

  return interaction.reply(`🔥 VIP ID añadido: ${id}`)
}

//tegister

if (interaction.commandName === "register") {

  const group = getUserGroup(interaction)
  if (!group) {
    return interaction.reply("❌ You don't belong to any reroll group")
  }

  const config = GROUP_CONFIG[group]

  const id = interaction.options.getString("id")

  if (!/^\d{16}$/.test(id)) {
    return interaction.reply("❌ ID must be 16 digits")
  }

  // 🔥 Cargar archivo correcto del gist correcto
  let users = await getUsers(
    config.USERS_GIST_ID,
    config.USERS_FILENAME
  )

  users[interaction.user.id] = {
    main_id: id,
    sec_id: null,
    name: interaction.member.displayName
  }

  // 🔥 Guardar en archivo correcto del gist correcto
  await saveUsers(
    users,
    config.USERS_GIST_ID,
    config.USERS_FILENAME
  )

  return interaction.reply(`✅ Main ID registered in ${group}`)
}


//adsec
if (interaction.commandName === "add_sec") {

  const group = getUserGroup(interaction)
  if (!group) {
    return interaction.reply("❌ No reroll group detected")
  }

  const config = GROUP_CONFIG[group]

  const secId = interaction.options.getString("id")

  if (!/^\d{16}$/.test(secId)) {
    return interaction.reply("❌ ID must be 16 digits")
  }

  // 🔥 Cargar desde el archivo correcto
  let users = await getUsers(
    config.USERS_GIST_ID,
    config.USERS_FILENAME
  )

  const userData = users[interaction.user.id]

  if (!userData) {
    return interaction.reply("❌ You must register main ID first")
  }

  userData.sec_id = secId

  // 🔥 Guardar en el archivo correcto
  await saveUsers(
    users,
    config.USERS_GIST_ID,
    config.USERS_FILENAME
  )

  return interaction.reply("✅ Secondary ID added")
}


//change

if (interaction.commandName === "change") {

  try {

    await interaction.deferReply({ ephemeral: true })

    const group = getUserGroup(interaction)

    if (!group) {
      return interaction.editReply("❌ You don't belong to any reroll group")
    }

    const config = GROUP_CONFIG[group]

    const newId = interaction.options.getString("id")

    if (!/^\d{16}$/.test(newId)) {
      return interaction.editReply("❌ ID must be exactly 16 digits (numbers only)")
    }

    // 🔥 Cargar correctamente el archivo del grupo
    let users = await getUsers(
      config.USERS_GIST_ID,
      config.USERS_FILENAME
    )

    const userData = users[interaction.user.id]

    if (!userData) {
      return interaction.editReply("❌ You must register first")
    }

    // 🔴 Poner OFFLINE el main_id anterior
    if (userData.main_id) {
      try {
        await fetch(`${API_URL}?action=offline&id=${userData.main_id}&group=${group}`)
      } catch (e) {
        console.error("Error putting old ID offline:", e)
      }
    }

    // 🔄 Actualizar manteniendo sec_id
    users[interaction.user.id] = {
      main_id: newId,
      sec_id: userData.sec_id || null,
      name: interaction.member.displayName
    }

    await saveUsers(
      users,
      config.USERS_GIST_ID,
      config.USERS_FILENAME
    )

    return interaction.editReply(`🔄 Main ID updated in ${group}`)

  } catch (error) {

    console.error("CHANGE ERROR:", error)

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply("❌ Unexpected error updating ID")
    } else {
      return interaction.reply("❌ Unexpected error updating ID")
    }
  }
}

  
  if (interaction.commandName === "online") {

  const group = getUserGroup(interaction)
  if (!group) {
    return interaction.reply("❌ You don't belong to any reroll group")
  }

  const config = GROUP_CONFIG[group]

  let users = await getUsers(
    config.USERS_GIST_ID,
    config.USERS_FILENAME
  )

  const userData = users[interaction.user.id]

  // 🔥 CAMBIO IMPORTANTE
  if (!userData || !userData.main_id) {
    return interaction.reply("❌ You must register your main ID first")
  }

  await fetch(`${API_URL}?action=online&id=${userData.main_id}&group=${group}`)

  return interaction.reply("🟢 Main account set online")
}


//online sec
if (interaction.commandName === "online_sec") {

  const group = getUserGroup(interaction)
  if (!group) {
    return interaction.reply("❌ You don't belong to any reroll group")
  }

  const config = GROUP_CONFIG[group]

  let users = await getUsers(
    config.USERS_GIST_ID,
    config.USERS_FILENAME
  )

  const userData = users[interaction.user.id]

  if (!userData || !userData.sec_id) {
    return interaction.reply("❌ You must register your secondary ID first")
  }

  await fetch(`${API_URL}?action=online&id=${userData.sec_id}&group=${group}`)

  return interaction.reply("🟢 Secondary account set online")
}




 

  // 🔹 OFFLINE
  if (interaction.commandName === "offline") {

  await interaction.deferReply()

  // 🔎 Detectar grupo por rol
  const group = getUserGroup(interaction)

  if (!group) {
    return interaction.editReply("❌ You don't belong to any reroll group")
  }

  const config = GROUP_CONFIG[group]

  // 📂 Cargar users del grupo correcto
let users = await getUsers(
  config.USERS_GIST_ID,
  config.USERS_FILENAME
)

  const userData = users[interaction.user.id]

  if (!userData) {
    return interaction.editReply("❌ You are not registered in your group")
  }

  // 🌐 Llamar API con grupo
if (userData.main_id) {
  await fetch(`${API_URL}?action=offline&id=${userData.main_id}&group=${group}`)
}

if (userData.sec_id) {
  await fetch(`${API_URL}?action=offline&id=${userData.sec_id}&group=${group}`)
}

  return interaction.editReply(`🔴 ${userData.name} is now OFFLINE in ${group}`)
}
 
//SETOFFLINE

 if (interaction.commandName === "set_offline") {

const member = interaction.member;

if (!member.roles.cache.some(role => role.name === "Champion")) {
  return interaction.reply({
    content: "❌ You need the **Champion** role to use this command.",
    ephemeral: true
  });
}
  
  const group = getUserGroup(interaction)
  if (!group) return interaction.reply("❌ No group")

  const config = GROUP_CONFIG[group]

  // 🔹 Obtener IDs online
  const res = await fetch(
    `https://api.github.com/gists/${config.IDS_GIST_ID}?t=${Date.now()}`,
    {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`
      }
    }
  )

  const data = await res.json()
  const content = data.files["elite_ids.txt"]?.content || ""

  const onlineIds = content
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean)

  if (onlineIds.length === 0) {
    return interaction.reply("⚫ No users online")
  }

  const users = await getUsers(
    config.USERS_GIST_ID,
    config.USERS_FILENAME
  )

  const options = []

  for (const id of onlineIds) {
    let name = "Unknown"

    for (const uid in users) {
      const u = users[uid]

      if (u.main_id === id || u.sec_id === id) {
        name = u.name
        break
      }
    }

    options.push({
      label: `${name}`,
      description: id,
      value: id
    })
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("select_offline_user")
    .setPlaceholder("Select user")
    .addOptions(options.slice(0, 25))

  const row = new ActionRowBuilder().addComponents(menu)

  await interaction.reply({
    content: "Select user to set OFFLINE:",
    components: [row],
    ephemeral: true
  })
}
//////
 if (interaction.isStringSelectMenu() && interaction.customId === "select_offline_user") {

  const id = interaction.values[0]

  const confirm = new ButtonBuilder()
    .setCustomId(`confirm_offline_${id}`)
    .setLabel("Confirm")
    .setStyle(ButtonStyle.Danger)

  const row = new ActionRowBuilder().addComponents(confirm)

  await interaction.update({
    content: `⚠️ Confirm OFFLINE for ID: ${id}?`,
    components: [row]
  })
}

if (interaction.isButton() && interaction.customId.startsWith("confirm_offline_")) {

  const id = interaction.customId.replace("confirm_offline_", "")

  const group = getUserGroup(interaction)

  await fetch(`${API_URL}?action=offline&id=${id}&group=${group}`)

  await interaction.update({
    content: `🔴 ID ${id} set OFFLINE`,
    components: []
  })
}
 //////////

// 🔹 LIST
if (interaction.commandName === "list") {

  const group = getUserGroup(interaction);
  if (!group) {
    return interaction.reply("❌ No reroll group detected");
  }

  const config = GROUP_CONFIG[group];
  const registeredUsers = await getUsers(
    config.USERS_GIST_ID,
    config.USERS_FILENAME
  );

  if (Object.keys(registeredUsers).length === 0) {
    return interaction.reply("📭 No users registered");
  }

  let msg = `📋 **Registered users in ${group}:**\n\n`;

  for (const uid in registeredUsers) {
    const user = registeredUsers[uid];
    msg += `👤 ${user.name} → Main ID: ${user.main_id}\n`;
  }

  return interaction.reply(msg);
}

 // 🔹 ONLINE LIST
if (interaction.commandName === "online_list") {
  try {
    await interaction.deferReply();

    const group = getUserGroup(interaction);
    if (!group) {
      return interaction.editReply("❌ You don't belong to any reroll group");
    }

    const config = GROUP_CONFIG[group];

    // 🔹 Obtener IDs online del grupo correcto
    const resOnline = await fetch(
      `https://api.github.com/gists/${config.IDS_GIST_ID}?t=${Date.now()}`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Cache-Control": "no-cache"
        }
      }
    );

    if (!resOnline.ok) {
      return interaction.editReply("❌ Error fetching online IDs");
    }

    const gistOnline = await resOnline.json();

    const contentOnline =
      gistOnline.files[config.IDS_FILENAME]?.content || "";

    const onlineIds = contentOnline
      .split(/\r?\n/)
      .map(x => x.trim())
      .filter(x => /^\d{16}$/.test(x));

    if (onlineIds.length === 0) {
      return interaction.editReply(`⚫ No users online in ${group}`);
    }

    // 🔹 Obtener usuarios registrados del grupo
    const registeredUsers = await getUsers(
      config.USERS_GIST_ID,
      config.USERS_FILENAME
    );

    let msg = `🟢 **Online users in ${group}:**\n\n`;
    let found = false;

    for (const id of onlineIds) {

      for (const uid in registeredUsers) {
        const user = registeredUsers[uid];

        if (user.main_id === id || user.sec_id === id) {
          msg += `👤 ${user.name} → ${id}\n`;
          found = true;
          break;
        }
      }
    }

    if (!found) {
      msg += "⚫ No registered users online\n";
    }

    return interaction.editReply(msg);

  } catch (error) {
    console.error("Online list error:", error);
    return interaction.editReply("❌ Something went wrong");
  }
}


 

if (commandName === "editpanel") {
  try {
    // Verificar si el usuario tiene el rol Champion
    const member = interaction.member; // miembro que ejecuta el comando
    if (!member.roles.cache.some(role => role.name === "Champion")) {
      return interaction.reply({
        content: "❌ You need the **Champion** role to use this command.",
        ephemeral: true
      });
    }

    // ----- Resto del comando aquí -----
    await interaction.reply({
      content: "📝 Please send the **Message ID** of the panel you want to edit:",
      ephemeral: true
    });

    const filter = m => m.author.id === interaction.user.id;
    const collectedId = await interaction.channel.awaitMessages({
      filter,
      max: 1,
      time: 60000,
      errors: ["time"]
    });
    const messageId = collectedId.first().content.trim();

    const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      return interaction.followUp({ content: "❌ Message not found.", ephemeral: true });
    }

    if (!message.embeds.length) {
      return interaction.followUp({ content: "❌ That message has no embed.", ephemeral: true });
    }

    await interaction.followUp({
      content: "🔢 Now, please send the new **Rarity (1-5)**:",
      ephemeral: true
    });

    const collectedRarity = await interaction.channel.awaitMessages({
      filter,
      max: 1,
      time: 60000,
      errors: ["time"]
    });

    const rarityInput = parseInt(collectedRarity.first().content.trim());
    if (isNaN(rarityInput) || rarityInput < 1 || rarityInput > 5) {
      return interaction.followUp({
        content: "❌ Invalid rarity. Must be a number between 1 and 5.",
        ephemeral: true
      });
    }

    const oldEmbed = message.embeds[0];

    let color = 0x999999;
    if (rarityInput === 5) color = 0xFFD700;
    if (rarityInput === 4) color = 0x00ffcc;
    if (rarityInput === 3) color = 0x0099ff;

    const descMatch = oldEmbed.description?.match(/• (\d+)P\s+\|\s+\*\*(.+)\*\*/i);
    const pack = descMatch ? parseInt(descMatch[1]) : 1;
    const username = descMatch ? descMatch[2] : "Unknown";

    const newEmbed = new EmbedBuilder()
      .setColor(color)
      .setDescription(`## ✨ ${rarityInput}/5 • ${pack}P  |  **${username}**`);

    if (oldEmbed.image?.url) newEmbed.setImage(oldEmbed.image.url);

    await message.edit({ embeds: [newEmbed] });

    await interaction.followUp({
      content: `✅ Panel updated successfully to **${rarityInput}/5**!`,
      ephemeral: true
    });

  } catch (err) {
    console.error("EDIT PANEL ERROR:", err);
    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ Something went wrong.",
        ephemeral: true
      });
    }
  }
}
});
    
  // 🔹 CIERRE CORRECTO DE client.on("interactionCreate")

    

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
