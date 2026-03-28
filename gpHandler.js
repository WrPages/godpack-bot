const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
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


const ALLOWED_CHANNEL_ID = "1484015417411244082"; // Canal para packs y prueba
const STATS_CHANNEL_ID = "1484416376436424794"; // Mismo canal para estadísticas

const GIST_ID = process.env.GIST_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const FILE_NAME = "gp_record.txt";

let packVotes = new Map();

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
  const oldMessages = await channel.messages.fetch({ limit: 10 });
  await channel.bulkDelete(oldMessages, true).catch(() => {});

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
  packVotes.set(msg.id, { alive: new Set(), dead: new Set(), confirmed: false });
}

module.exports = async (client) => {
  await loadData();

  // Crear/actualizar panel de estadísticas y mensaje de prueba
  (async () => {
    try {
      console.log("Enviando/actualizando panel de estadísticas...");
      await updateStats(client);
      console.log("Panel de estadísticas OK");
      console.log("Creando mensaje de prueba...");
      await createTestMessage(client);
      console.log("Mensaje de prueba creado correctamente");
    } catch (err) {
      console.error("Error inicializando bot:", err);
    }
  })();

  setInterval(() => {
    updateStats(client).catch(() => {});
  }, 60 * 60 * 1000);

client.on("messageCreate", async (message) => {
  if (message.channel.id !== ALLOWED_CHANNEL_ID) return;
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

    const lines = message.content.split("\n");
    let username = "Unknown";

    const usernameLine = lines.find(line => line.includes("(") && line.includes(")"));
    if (usernameLine) {
      const match = usernameLine.match(/^(.+?)\s*\(/);
      if (match) username = match[1].trim();
    }

    // ===== COLOR =====
    let color = 0x999999;
    if (rarity === 5) color = 0xFFD700;
    if (rarity === 4) color = 0x00ffcc;
    if (rarity === 3) color = 0x0099ff;

    // ===== MENCIONES =====
    const onlineIDs = await getOnlineIDs();
    const users = await getUsers();

    const onlineClean = onlineIDs.map(id => id.trim());
    let mentionList = [];

    for (const discordId in users) {
      const userData = users[discordId];

      const mainId = userData.main_id?.trim();
      const secId = userData.sec_id?.trim();

      if (
        onlineClean.includes(mainId) ||
        (secId && onlineClean.includes(secId))
      ) {
        mentionList.push(`<@${discordId}>`);
      }
    }

    const onlineMention = mentionList.join(" ");

    // ===== EMBED =====
    let description = `## ✨ ${rarity}/5 • ${packNumber}P  |  **${username}**`;

 

    const embed = new EmbedBuilder()
      .setColor(color)
      .setDescription(description)
      .setTimestamp();

   if (imageFile) {
  embed.setImage("attachment://card.png");
}

    // ===== BOTONES =====
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

    // ===== ENVIAR =====
const sentMessage = await message.channel.send({
  embeds: [embed],
  components: [buttons],
  files: imageFile ? [imageFile] : [],
  allowedMentions: { parse: ["users"] }
});

    packVotes.set(sentMessage.id, {
      alive: new Set(),
      dead: new Set(),
      confirmed: false
    });

    // ===== HILO =====
    try {
      const thread = await sentMessage.startThread({
        name: `GP • ${rarity}/5`,
        autoArchiveDuration: 1440,
        type: ChannelType.PublicThread
      });

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
    if (!interaction.isButton()) return;

    const data = packVotes.get(interaction.message.id);
    if (!data) return;

    await interaction.deferUpdate();
    if (data.confirmed) return;

    const userId = interaction.user.id;

    if (interaction.customId === "gp_alive") {
      const beforeSize = data.alive.size;
      data.alive.add(userId);
      data.dead.delete(userId);
      if (data.alive.size === beforeSize) return;
    }

    if (interaction.customId === "gp_dead") {
      const beforeSize = data.dead.size;
      data.dead.add(userId);
      data.alive.delete(userId);
      if (data.dead.size === beforeSize) return;
    }

    if (data.alive.size >= 2 && !data.confirmed) {
      data.confirmed = true;
      statsData.todayCount++;
      await saveData();
      await updateStats(interaction.client);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("gp_alive")
          .setLabel(`🟢 Alive (${data.alive.size})`)
          .setStyle(ButtonStyle.Success)
      );
      return interaction.message.edit({ components: [row] });
    }

    if (data.dead.size >= 3 && !data.confirmed) {
      data.confirmed = true;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("gp_dead")
          .setLabel(`🔴 Dead (${data.dead.size})`)
          .setStyle(ButtonStyle.Danger)
      );
      return interaction.message.edit({ components: [row] });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("gp_alive")
        .setLabel(`🟢 Alive (${data.alive.size})`)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("gp_dead")
        .setLabel(`🔴 Dead (${data.dead.size})`)
        .setStyle(ButtonStyle.Danger)
    );
    await interaction.message.edit({ components: [row] });
  });
};
