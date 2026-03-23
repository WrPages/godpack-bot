const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require("discord.js");

const fetch = require("node-fetch");

const ALLOWED_CHANNEL_ID = "1484015417411244082"; // Canal para packs
const STATS_CHANNEL_ID = "TU_SEGUNDO_CANAL_ID"; // Canal para estadísticas GP

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

// Función segura para enviar/actualizar panel de estadísticas
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
    const messages = await channel.messages.fetch({ limit: 5 });
    const webhookMsg = messages.find(
      msg => msg.webhookId && msg.content.includes("God Pack found")
    );
    if (webhookMsg) await webhookMsg.delete().catch(() => {});
  } catch (err) {
    console.error("CLEAN ERROR:", err);
  }
}

module.exports = async (client) => {
  await loadData();

  // Crear/actualizar panel de estadísticas inmediatamente al iniciar el bot
  (async () => {
    try {
      console.log("Intentando enviar/actualizar panel de estadísticas...");
      await updateStats(client);
      console.log("Panel de estadísticas enviado o actualizado correctamente");
    } catch (err) {
      console.error("Error enviando panel inicial:", err);
    }
  })();

  // Actualizar estadísticas cada hora
  setInterval(() => {
    updateStats(client).catch(() => {});
  }, 60 * 60 * 1000);

  client.on("messageCreate", async (message) => {
    if (message.channel.id !== ALLOWED_CHANNEL_ID) return;
    if (!message.webhookId) return;
    if (!message.content.includes("God Pack found")) return;

    try {
      const attachment = message.attachments.first();
      let imageFile = null;
      if (attachment) {
        imageFile = {
          attachment: attachment.proxyURL || attachment.url,
          name: "card.png"
        };
      }

      const rarityMatch = message.content.match(/\[(\d)\/5\]/);
      if (!rarityMatch) return;
      const rarity = parseInt(rarityMatch[1]);
      const packMatch = message.content.match(/\[(\d)P\]/i);
      const packNumber = packMatch ? parseInt(packMatch[1]) : 1;

      const lines = message.content.split("\n");
      const usernameLine = lines.find(line => line.includes("(") && line.includes(")"));
      let username = "Unknown";
      if (usernameLine) {
        const match = usernameLine.match(/^(.+?)\s*\(/);
        if (match) username = match[1].trim();
      }

      let color = 0x999999;
      if (rarity === 5) color = 0xFFD700;
      if (rarity === 4) color = 0x00ffcc;
      if (rarity === 3) color = 0x0099ff;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setDescription(`## ✨ ${rarity}/5 • ${packNumber}P  |  **${username}**`);

      if (imageFile) embed.setImage("attachment://card.png");

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
        files: imageFile ? [imageFile] : []
      });

      await cleanWebhookMessage(message.channel);

      packVotes.set(sentMessage.id, { alive: new Set(), dead: new Set(), confirmed: false });

      // Crear thread sobre el panel
      try {
        const thread = await sentMessage.startThread({
          name: `GP • ${rarity}/5`,
          autoArchiveDuration: 1440,
          type: ChannelType.PublicThread
        });
        await thread.send("📂 Original webhook message:");
        await thread.send({ content: message.content });
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
      data.alive.add(userId);
      data.dead.delete(userId);
    }

    if (interaction.customId === "gp_dead") {
      data.dead.add(userId);
      data.alive.delete(userId);
    }

    // Alive llega a 2 → eliminar botón Dead
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

    // Dead llega a 3 → eliminar botón Alive
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

    // Actualizar contadores mientras no se confirme
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