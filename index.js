 const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js')
const fetch = require('node-fetch')

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

const content = gistData.files["elite_ids.txt"]?.content || "";

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
  console.log("Bot ready 🔥")
})
require("./gpHandler")(client);


//Comandos
client.once("ready", async () => {
  console.log(`✅ Bot listo como ${client.user.tag}`);

  const { REST, Routes, SlashCommandBuilder } = require("discord.js");

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {


    // 🗑️ BORRAR COMANDOS ANTIGUOS DEL SERVIDOR
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: [] }
    );

    console.log("🗑️ Comandos antiguos eliminados");

  } catch (error) {
    console.error("❌ Error borrando comandos:", error);
  }

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
const HISTORY_FILE = "./ppm_history.json";
const TWELVE_HOURS = 12 * 60 * 60 * 1000;

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  return JSON.parse(fs.readFileSync(HISTORY_FILE));
}

function saveHistory(data) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(data));
}

async function updateTotalPPM() {
  try {
    // 🔹 Config y canales
    const config = GROUP_CONFIG["Elite_Four"];
    const heartbeatChannel = await client.channels.fetch(HEARTBEAT_CHANNEL_ID);
    const totalChannel = await client.channels.fetch(TOTAL_CHANNEL_ID);

    // 🔹 IDs online desde gist elite_ids.txt
    const onlineIDs = await getOnlineIDs(config.IDS_GIST_ID);
    console.log("Online IDs detected:", onlineIDs);

    // 🔹 Usuarios registrados
    const users = await getUsers(config.USERS_GIST_ID, config.USERS_FILENAME);
    console.log("Registered users loaded:", Object.keys(users).length);

    // 🔹 Preparar datos
    let totalPPM = 0;
    let ppmUsers = [];
    const processedUsers = new Set();

    // 🔹 Leer últimos mensajes heartbeat
    const messages = await heartbeatChannel.messages.fetch({ limit: 10 });

    for (const msg of messages.values()) {
      if (!msg.author.bot) continue;

      const lines = msg.content.split("\n").map(l => l.trim());
      if (lines.length < 3) continue;

      const heartbeatName = lines[0].replace(":", "").split("#")[0].trim();

      // 🔹 Buscar ID registrado
      let foundId = null;
      for (const uid in users) {
        const registeredName = users[uid].name.split("#")[0].trim();
        if (heartbeatName.toLowerCase() === registeredName.toLowerCase()) {
          // Coincide nombre, tomamos main_id
          foundId = users[uid].main_id;
          break;
        }
      }

      if (!foundId) continue;
      if (!onlineIDs.includes(foundId)) continue;
      if (processedUsers.has(heartbeatName)) continue;

      // 🔹 Extraer PPM
      const avgLine = lines.find(l => l.includes("Avg:"));
      if (!avgLine) continue;

      const match = avgLine.match(/Avg:\s*([\d.]+)/);
      if (!match) continue;

      const ppm = parseFloat(match[1]);
      if (isNaN(ppm)) continue;

      totalPPM += ppm;
      ppmUsers.push({ name: heartbeatName, ppm });
      processedUsers.add(heartbeatName);
    }

    // ===== HISTORIAL 12H =====
    let history = loadHistory();
    const now = Date.now();

    history.push({ timestamp: now, value: totalPPM });
    history = history.filter(entry => now - entry.timestamp <= TWELVE_HOURS);
    saveHistory(history);

    let average12h = 0;
    if (history.length > 0) {
      const sum = history.reduce((acc, entry) => acc + entry.value, 0);
      average12h = sum / history.length;
    }

    // ===== CONSTRUIR MENSAJE =====
    ppmUsers.sort((a, b) => b.ppm - a.ppm);

    let messageContent = "━━━━━━━━━━━━━━━━━━━━━━\n";
    messageContent += "🚀 **Global PPM**\n";
    messageContent += "━━━━━━━━━━━━━━━━━━━━━━\n\n";
    messageContent += `# 🔥 ${totalPPM.toFixed(2)}\n`;
    messageContent += "**Current PPM**\n\n";
    messageContent += "━━━━━━━━━━━━━━━━━━━━━━\n";
    messageContent += `📊 **12H Average:** ${average12h.toFixed(2)} ppm\n`;
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

    // 🔹 Editar o enviar mensaje en canal de resultados
    const existingMessages = await totalChannel.messages.fetch({ limit: 5 });
    const botMessage = existingMessages.find(m => m.author.id === client.user.id);

    if (botMessage) {
      await botMessage.edit(messageContent);
    } else {
      await totalChannel.send(messageContent);
    }

    console.log("PPM total actualizado");

  } catch (err) {
    console.error("Error actualizando PPM:", err);
  }
}

// 🔹 Reemplazar el setInterval original
client.on("ready", () => {
  setInterval(updateTotalPPM, 5 * 60 * 1000); // cada 5 min
  updateTotalPPM();
  console.log("Bot listo y PPM counter activo 🔥");
});
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
// 🔹 ONLINE LIST - Elite_Four
if (interaction.commandName === "online_list") {
  try {
    await interaction.deferReply();

    const group = getUserGroup(interaction);
    if (!group) return interaction.editReply("❌ You don't belong to any reroll group");

    // 🔹 Configuración del grupo
    const config = GROUP_CONFIG[group];

    // 🔹 Obtener IDs online desde el gist elite_ids.txt
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

    if (!resOnline.ok) return interaction.editReply("❌ Error fetching online IDs");

    const gistOnline = await resOnline.json();
    const contentOnline = gistOnline.files["elite_ids.txt"]?.content || "";

    const onlineIds = contentOnline
      .split(/\r?\n/)
      .map(x => x.trim())
      .filter(x => /^\d{16}$/.test(x));

    if (onlineIds.length === 0) return interaction.editReply("⚫ No users online");

    // 🔹 Obtener usuarios registrados del gist elite_users.json
    const registeredUsers = await getUsers(config.USERS_GIST_ID, config.USERS_FILENAME);

    if (!registeredUsers || Object.keys(registeredUsers).length === 0) {
      return interaction.editReply("📭 No users registered");
    }

    // 🔹 Comparar IDs online con usuarios registrados
    let msg = `🟢 **Online users in ${group}:**\n\n`;
    let foundAny = false;

    for (const id of onlineIds) {
      let name = "Unknown";

      for (const uid in registeredUsers) {
        const user = registeredUsers[uid];
        const mainId = (user.main_id || "").trim();
        const secId = (user.sec_id || "").trim();

        if (mainId === id || secId === id) {
          name = user.name;
          foundAny = true;
          break;
        }
      }

      msg += `🟢 ${name} → ${id}\n`;
    }

    if (!foundAny) msg += "⚫ No registered users online\n";

    return interaction.editReply(msg);

  } catch (error) {
    console.error("Online list error:", error);
    return interaction.editReply("❌ Something went wrong while fetching online users");
  }
}

// 🔹 FIN DE TODOS LOS COMANDOS DEL INTERACTIONCREATE
}); // 🔹 CIERRE CORRECTO DE client.on("interactionCreate")

    

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


