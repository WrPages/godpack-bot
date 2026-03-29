const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  REST,
  Routes,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const fetch = require("node-fetch");

// ===== SISTEMA DE MENCIONES ONLINE =====
const USERS_GIST_ID = "bb18eda2ea748723d8fe0131dd740b70"; // tu gist users.json
const IDS_GIST_RAW_URL = "https://gist.githubusercontent.com/WrPages/d9db3a72fed74c496fd6cc830f9ca6e9/raw/elite_ids.txt";






async function getOnlineIDs() {
  try {
    const res = await fetch(IDS_GIST_RAW_URL + "?t=" + Date.now());
    const text = await res.text();
    return text.split("\n").map(x => x.trim()).filter(x => x.length > 0);
  } catch {
    return [];
  }
}

async function getUsers() {
  try {
    const res = await fetch(
      `https://api.github.com/gists/${USERS_GIST_ID}?t=${Date.now()}`,
      {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      }
    );

    const data = await res.json();

    if (!data.files || !data.files["elite_users.json"]) return {};

    return JSON.parse(data.files["elite_users.json"].content || "{}");
  } catch (err) {
    console.error("GET USERS ERROR:", err);
    return {};
  }
}


const ALLOWED_CHANNELS = [
  "1486277594629275770", // canal 1
  "1484015417411244082",
  "1487362022864588902"// canal 2
   // canal 3
];

const STATS_CHANNEL_ID = "1484416376436424794"; // Mismo canal para estadísticas

const GIST_ID = process.env.GIST_ID;
const LIVE_GIST_ID = process.env.LIVE_GIST_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const FILE_NAME = "gp_record.txt";

// ===== LIVE GP STATS =====
const LIVE_STATS_FILE = "gp_live_stats.json";

let liveStats = {
  totalGP: 0,
  totalAlive: 0,
  currentDay: null,
  daily: { gp: 0, alive: 0 },
  history: []
};

function getUTC6DateString() {
  const now = new Date();
  const utc6 = new Date(now.getTime() - (6 * 60 * 60 * 1000));
  return utc6.toISOString().split("T")[0];
}






let statsData = {
  currentDay: new Date().toDateString(),
  todayCount: 0,
  lastFiveDays: [],
  statsMessageId: null
};

async function saveData() {
  try {
    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: "PATCH",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        files: {
          [FILE_NAME]: {
            content: JSON.stringify(statsData, null, 2)
          }
        }
      })
    });
  } catch (err) {
    console.error("SAVE GIST ERROR:", err);
  }
}

async function loadData() {
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`);
    const data = await res.json();
    const content = data.files[FILE_NAME].content;
    statsData = JSON.parse(content);
  } catch (err) {
    console.error("LOAD GIST ERROR:", err);
  }
}
//cambia alive o desd hilos
async function updateThreadName(message, status, rarity, packNumber, username, friendId) {
  try {
    if (!message.hasThread) return;

    const thread = await message.thread.fetch();

    let emoji = "⚪";

    if (status === "alive") {
      emoji = "✅";
    }

    if (status === "dead") {
      emoji = "❌";
    }

 const name = `${emoji} [${rarity}/5][${packNumber}P] ${username} ${friendId}`.slice(0, 90);

    await thread.setName(name);
  } catch (err) {
    console.error("THREAD NAME ERROR:", err);
  }
}

// termina

// ===== CARGAR LIVE STATS =====
async function loadLiveStats() {
  try {
    const res = await fetch(`https://api.github.com/gists/${LIVE_GIST_ID}`);
    const data = await res.json();

    if (!data.files[LIVE_STATS_FILE]) return;

    liveStats = JSON.parse(data.files[LIVE_STATS_FILE].content);
  } catch (err) {
    console.error("LOAD LIVE STATS ERROR:", err);
  }
}

// ===== GUARDAR LIVE STATS =====
async function saveLiveStats() {
  try {
    await fetch(`https://api.github.com/gists/${LIVE_GIST_ID}`, {
      method: "PATCH",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        files: {
          [LIVE_STATS_FILE]: {
            content: JSON.stringify(liveStats, null, 2)
          }
        }
      })
    });
  } catch (err) {
    console.error("SAVE LIVE STATS ERROR:", err);
  }
}

// ===== RESET DIARIO UTC-6 =====
async function checkDailyReset() {
  const today = getUTC6DateString();

  if (!liveStats.currentDay) {
    liveStats.currentDay = today;
    return;
  }

  if (today !== liveStats.currentDay) {

    liveStats.history.unshift({
      date: liveStats.currentDay,
      gp: liveStats.daily.gp,
      alive: liveStats.daily.alive
    });

    liveStats.history = liveStats.history.slice(0, 5);

    liveStats.currentDay = today;
    liveStats.daily = { gp: 0, alive: 0 };

    await saveLiveStats();
  }
}





async function updateStats(client) {
  const channel = await client.channels.fetch(STATS_CHANNEL_ID);
  if (!channel) return;

  const now = new Date();
  const today = now.toDateString();

  if (today !== statsData.currentDay) {
    statsData.lastFiveDays.unshift({
      day: statsData.currentDay,
      count: statsData.todayCount
    });
    statsData.lastFiveDays = statsData.lastFiveDays.slice(0, 5);
    statsData.currentDay = today;
    statsData.todayCount = 0;
    await saveData();
  }

  const historyText =
    statsData.lastFiveDays.length > 0
      ? statsData.lastFiveDays.map(d => `▫️ **${d.day}**: ${d.count} GP`).join("\n")
      : "No previous records";

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📊 GP Statistics")
    .addFields(
      { name: "✨ GP Today", value: `${statsData.todayCount}`, inline: false },
      { name: "🕘 Last 5 days", value: historyText, inline: false }
    )
    .setFooter({ text: "Data synced with Gist" })
    .setTimestamp();

  try {
    let msg;
    if (statsData.statsMessageId) {
      try {
        msg = await channel.messages.fetch(statsData.statsMessageId);
      } catch {
        statsData.statsMessageId = null;
      }
    }

    if (!statsData.statsMessageId) {
      msg = await channel.send({ embeds: [embed] });
      statsData.statsMessageId = msg.id;
      await saveData();
    } else if (msg) {
      await msg.edit({ embeds: [embed] });
    }
  } catch (err) {
    console.error("Error creando/actualizando panel de estadísticas:", err);
    statsData.statsMessageId = null;
  }
}

async function cleanWebhookMessage(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 10 });
    const webhookMsg = messages.find(
      msg => msg.webhookId && msg.content.includes("God Pack found")
    );
    if (webhookMsg) await webhookMsg.delete().catch(() => {});
  } catch (err) {
    console.error("CLEAN ERROR:", err);
  }
}

// **Nueva función para limpiar mensajes antiguos y enviar un mensaje de prueba**
async function createTestMessage(client) {
  const channel = await client.channels.fetch(ALLOWED_CHANNEL_ID);
  if (!channel) return;

  // Eliminar mensajes antiguos (limit 10 para no sobrecargar)
 // const oldMessages = await channel.messages.fetch({ limit: 10 });
  //await channel.bulkDelete(oldMessages, true).catch(() => {});

  // Crear mensaje de prueba para asegurar que los botones funcionen
  const testEmbed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("✅ GP Bot Test Message")
    .setDescription("Este es un mensaje de prueba para botones Alive/Dead.");

  const testButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("gp_alive")
      .setLabel("🟢 Alive (0)")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("gp_dead")
      .setLabel("🔴 Dead (0)")
      .setStyle(ButtonStyle.Danger)
  );

  const msg = await channel.send({ embeds: [testEmbed], components: [testButtons] });

}

module.exports = async (client) => {
    await loadData();
        await loadLiveStats();
        
  

client.once("clientReady", async () => {

  const commands = [
    new SlashCommandBuilder()
      .setName("editpanel")
      .setDescription("Editar un panel de GP")
      .addStringOption(option =>
        option
          .setName("mensaje_id")
          .setDescription("ID del mensaje del panel")
          .setRequired(true)
      )
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log("Registrando /editpanel...");

    await rest.put(
      Routes.applicationGuildCommands(
        client.user.id,
        "1483615153743462571" // TU SERVER ID
      ),
      { body: commands }
    );

    console.log("✅ /editpanel registrado");
  } catch (error) {
    console.error("❌ Error registrando comando:", error);
  }
});



  
  
  
  


  // Crear/actualizar panel de estadísticas y mensaje de prueba
  (async () => {
    try {
      console.log("Enviando/actualizando panel de estadísticas...");
      await updateStats(client);
      console.log("Panel de estadísticas OK");
    } catch (err) {
      console.error("Error inicializando bot:", err);
    }
  })();

  setInterval(() => {
    updateStats(client).catch(() => {});
  }, 60 * 60 * 1000);


client.on("messageCreate", async (message) => {
if (!ALLOWED_CHANNELS.includes(message.channel.id)) return;
  if (!message.webhookId) return;
  if (!message.content.includes("God Pack found")) return;

  try {
    // ===== IMAGEN =====
    const attachment = message.attachments.first();
    let imageFile = null;
    if (attachment) {
      imageFile = {
        attachment: attachment.url,
        name: "card.png"
      };
    }

    // ===== DATOS =====
    const rarityMatch = message.content.match(/\[(\d)\/5\]/);
    if (!rarityMatch) return;
    const rarity = parseInt(rarityMatch[1]);

    const packMatch = message.content.match(/\[(\d)P\]/i);
    const packNumber = packMatch ? parseInt(packMatch[1]) : 1;

    let username = "Unknown";
    const usernameLine = message.content.split("\n").find(line => line.includes("(") && line.includes(")"));
    if (usernameLine) {
      const match = usernameLine.match(/^(.+?)\s*\(/);
      if (match) username = match[1].trim();
    }

// ===== FRIEND ID (16 dígitos con o sin espacios) =====
let friendId = "Unknown";

const rawText = message.content;

// Buscar 16 dígitos seguidos
let match = rawText.match(/\b\d{16}\b/);

// Si no encuentra, buscar formato con espacios
if (!match) {
  match = rawText.match(/\b(\d{4}\s\d{4}\s\d{4}\s\d{4})\b/);
  if (match) {
    friendId = match[1].replace(/\s/g, ""); // quitar espacios
  }
} else {
  friendId = match[0];
}

console.log("Friend ID detectado:", friendId);



    // ===== COLOR =====
    let color = 0x808080;
    if (rarity === 3) color = 0x3498db;
    if (rarity === 4) color = 0x9b59b6;
    if (rarity === 5) color = 0xFFD700;

    // ===== EMBED =====
    let description = `## ✨ ${rarity}/5 • ${packNumber}P  |  **${username}**`;
    const embed = new EmbedBuilder()
      .setColor(color)
      .setDescription(description)
      .setTimestamp();
    if (imageFile) embed.setImage("attachment://card.png");

// ===== BOTONES =====
// ===== ENVIAR MENSAJE SIN BOTÓN EDIT PRIMERO =====
const buttons = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("gp_alive")
    .setLabel("🟢 Alive (0)")
    .setStyle(ButtonStyle.Success),
  new ButtonBuilder()
    .setCustomId("gp_dead")
    .setLabel("🔴 Dead (0)")
    .setStyle(ButtonStyle.Danger)
);

const sentMessage = await message.channel.send({
  embeds: [embed],
  components: [buttons],
  files: imageFile ? [imageFile] : [],
  allowedMentions: { parse: ["users"] }
});


// ===== SUMAR GP TOTAL =====
await checkDailyReset();

liveStats.totalGP += 1;
liveStats.daily.gp += 1;

await saveLiveStats();



// ===== AHORA AGREGAR BOTÓN EDIT CON EL ID REAL =====
const editButton = new ButtonBuilder()
  .setCustomId(`edit_panel_${sentMessage.id}`)
  .setStyle(ButtonStyle.Secondary)
  .setEmoji("✏️"); // solo icono, cuadro pequeño

// Tomamos la fila de botones existente y agregamos Edit
const newButtons = ActionRowBuilder.from(buttons).addComponents(editButton);

await sentMessage.edit({
  components: [newButtons]
});
    

    // ===== CREAR HILO =====
    try {
      const thread = await sentMessage.startThread({
        name: `[${rarity}/5][${packNumber}P] [${username}P] [${friendId}P]`,
        autoArchiveDuration: 1440,
        type: ChannelType.PublicThread
      });

      // Menciones online
      const onlineIDs = await getOnlineIDs();
      const users = await getUsers();
      const onlineClean = onlineIDs.map(id => id.trim());
      const mentionList = [];
      for (const discordId in users) {
        const userData = users[discordId];
        const mainId = userData.main_id?.trim();
        const secId = userData.sec_id?.trim();
        if (onlineClean.includes(mainId) || (secId && onlineClean.includes(secId))) {
          mentionList.push(`<@${discordId}>`);
        }
      }
      const onlineMention = mentionList.join(" ");
      if (onlineMention) {
        await thread.send({
          content: onlineMention,
          allowedMentions: { parse: ["users"] }
        });
      }

      await thread.send("📂 Original webhook message:");
      await thread.send({
        content: message.content,
        files: message.attachments.map(att => att.url),
        allowedMentions: { parse: [] }
      });

      await message.delete().catch(() => {});
    } catch (err) {
      console.error("THREAD ERROR:", err);
    }

  } catch (err) {
    console.error("GP Handler Error:", err);
  }
});



client.on("interactionCreate", async (interaction) => {

  // =========================
  // 1️⃣ BOTÓN EDIT
  // =========================
if (interaction.isButton() && interaction.customId.startsWith("edit_panel_")) {

  const messageId = interaction.customId.replace("edit_panel_", "");
  const message = await interaction.channel.messages.fetch(messageId).catch(() => null);

  if (!message) {
    return interaction.reply({ content: "❌ Mensaje no encontrado.", ephemeral: true });
  }

  // 🔥 LEER DATOS DESDE EL EMBED (AQUÍ VA EL PASO 4)
  const embed = message.embeds[0];
  const desc = embed?.description || "";

  const rarityMatch = desc.match(/(\d)\/5/);
  const packMatch = desc.match(/• (\d+)P/);
  const userMatch = desc.match(/\*\*(.*?)\*\*/);

  const rarity = rarityMatch ? rarityMatch[1] : "1";
  const packNumber = packMatch ? packMatch[1] : "1";
  const username = userMatch ? userMatch[1] : "Unknown";

  const modal = new ModalBuilder()
    .setCustomId(`edit_panel_${message.id}`)
    .setTitle("Editar GP Panel");

  const rarityInput = new TextInputBuilder()
    .setCustomId("rarity")
    .setLabel("Rareza (1-5)")
    .setStyle(TextInputStyle.Short)
    .setValue(String(rarity));

  const packInput = new TextInputBuilder()
    .setCustomId("pack")
    .setLabel("Packs")
    .setStyle(TextInputStyle.Short)
    .setValue(String(packNumber));

  const userInput = new TextInputBuilder()
    .setCustomId("username")
    .setLabel("Usuario")
    .setStyle(TextInputStyle.Short)
    .setValue(username);

  modal.addComponents(
    new ActionRowBuilder().addComponents(rarityInput),
    new ActionRowBuilder().addComponents(packInput),
    new ActionRowBuilder().addComponents(userInput)
  );

  return interaction.showModal(modal);
}

// =========================
// 2️⃣ MODAL SUBMIT
// =========================
if (interaction.isModalSubmit() && interaction.customId.startsWith("edit_panel_")) {

  await interaction.deferReply({ ephemeral: true });

  const messageId = interaction.customId.replace("edit_panel_", "");
  const message = await interaction.channel.messages.fetch(messageId).catch(() => null);

  if (!message) {
    return interaction.editReply("❌ Mensaje no encontrado.");
  }

  const rarity = parseInt(interaction.fields.getTextInputValue("rarity"));
  const packNumber = parseInt(interaction.fields.getTextInputValue("pack"));
  const username = interaction.fields.getTextInputValue("username");

  if (isNaN(rarity) || rarity < 1 || rarity > 5) {
    return interaction.editReply("❌ Rareza inválida.");
  }

  let color = 0x808080;
  if (rarity === 3) color = 0x3498db;
  if (rarity === 4) color = 0x9b59b6;
  if (rarity === 5) color = 0xFFD700;

  const oldEmbed = message.embeds[0];

  const newEmbed = EmbedBuilder.from(oldEmbed)
    .setColor(color)
    .setDescription(`## ✨ ${rarity}/5 • ${packNumber}P  |  **${username}**`);
    setImage(null); // 🔥 extra seguridad

await message.edit({ embeds: [newEmbed] });

  await interaction.editReply("✅ Panel actualizado correctamente.");
  return; // 🔥 IMPORTANTE
}

// =========================
// 3️⃣ BOTONES ALIVE / DEAD
// =========================
if (interaction.isButton()) {

  if (interaction.customId !== "gp_alive" && interaction.customId !== "gp_dead") return;

  const message = interaction.message;
  const embed = message.embeds[0];

  // ===== LEER FOOTER =====
  let footer = embed.footer?.text || "VOTES:alive=|dead=";

  let aliveUsers = [];
  let deadUsers = [];

  const matchAlive = footer.match(/alive=([^|]*)/);
  const matchDead = footer.match(/dead=(.*)/);

  if (matchAlive) aliveUsers = matchAlive[1] ? matchAlive[1].split(",") : [];
  if (matchDead) deadUsers = matchDead[1] ? matchDead[1].split(",") : [];

  const userId = interaction.user.id;

  // 🚫 BLOQUEAR SI YA VOTÓ (ANTES de defer)
 if (aliveUsers.includes(userId) || deadUsers.includes(userId)) {
  await interaction.deferUpdate();

  return interaction.followUp({
    content: "⚠️ You have already voted in this GP.",
    ephemeral: true
  });
}

  await interaction.deferUpdate();

  // ===== CONTADORES =====
  const row = message.components[0];
  const buttons = row.components;

  let aliveCount = 0;
  let deadCount = 0;

  const aliveBtn = buttons.find(b => b.customId === "gp_alive");
  const deadBtn = buttons.find(b => b.customId === "gp_dead");

  if (aliveBtn) {
    const m = aliveBtn.label.match(/\((\d+)\)/);
    if (m) aliveCount = parseInt(m[1]);
  }

  if (deadBtn) {
    const m = deadBtn.label.match(/\((\d+)\)/);
    if (m) deadCount = parseInt(m[1]);
  }

  // ===== VOTO =====
  if (interaction.customId === "gp_alive") {
    aliveCount++;
    aliveUsers.push(userId);
  }

  if (interaction.customId === "gp_dead") {
    deadCount++;
    deadUsers.push(userId);
  }

// ===== ENVIAR LOG AL HILO =====
try {
  if (message.hasThread) {
    const thread = await message.thread.fetch();

await thread.send({
  content: `🗳️ <@${userId}> votó **${interaction.customId === "gp_alive" ? "Alive" : "Dead"}**`,
  allowedMentions: { parse: [] }
});
  }
} catch (err) {
  console.error("THREAD LOG ERROR:", err);
}


  // ===== GUARDAR FOOTER =====
  const newFooter = `VOTES:alive=${aliveUsers.join(",")}|dead=${deadUsers.join(",")}`;
  const newEmbed = EmbedBuilder.from(embed).setFooter({ text: newFooter });

  // ===== CONFIRMACIONES =====
  let status = null;

  if (aliveCount >= 2) status = "alive";
  if (deadCount >= 3) status = "dead";

  if (status) {
    const desc = embed.description || "";

    const rarity = (desc.match(/(\d)\/5/) || [])[1] || 0;
    const pack = (desc.match(/• (\d+)P/) || [])[1] || 0;
    const user = (desc.match(/\*\*(.*?)\*\*/) || [])[1] || "Unknown";

    await updateThreadName(message, status, rarity, pack, user, "ID");
  }

  // ===== BOTONES =====
  const newRow = new ActionRowBuilder();

  if (deadCount < 3) {
    newRow.addComponents(
      new ButtonBuilder()
        .setCustomId("gp_alive")
        .setLabel(`🟢 Alive (${aliveCount})`)
        .setStyle(ButtonStyle.Success)
    );
  }

  if (aliveCount < 2) {
    newRow.addComponents(
      new ButtonBuilder()
        .setCustomId("gp_dead")
        .setLabel(`🔴 Dead (${deadCount})`)
        .setStyle(ButtonStyle.Danger)
    );
  }

  newRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`edit_panel_${message.id}`)
      .setEmoji("✏️")
      .setStyle(ButtonStyle.Secondary)
  );

await message.edit({
  embeds: [newEmbed],
  components: [newRow]
});

return;
}

// 👇 cierre del interactionCreate
});

// 👇 cierre del module.exports
};
