const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require("discord.js");
const fs = require("fs");

const ALLOWED_CHANNEL_ID = "1484015417411244082";
const STATS_CHANNEL_ID = "1484015417411244082";
const DATA_FILE = "./gp_stats.json";

let packVotes = new Map();

let statsData = {
  currentDay: new Date().toDateString(),
  todayCount: 0,
  lastFiveDays: [],
  statsMessageId: null
};

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(statsData, null, 2));
}

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    statsData = JSON.parse(fs.readFileSync(DATA_FILE));
  }
}

async function updateStats(client) {
  const today = new Date().toDateString();
  if (today !== statsData.currentDay) {
    statsData.lastFiveDays.unshift({
      day: statsData.currentDay,
      count: statsData.todayCount
    });
    if (statsData.lastFiveDays.length > 5) statsData.lastFiveDays.pop();
    statsData.todayCount = 0;
    statsData.currentDay = today;
    saveData();
  }

  const channel = await client.channels.fetch(STATS_CHANNEL_ID);
  const embed = new EmbedBuilder()
    .setTitle("📊 GOD PACKS - 24H STATS")
    .setColor(0x00ff99)
    .setDescription(
      `# 🟢 Today: ${statsData.todayCount}\n\n` +
      (statsData.lastFiveDays.length > 0
        ? statsData.lastFiveDays.map(d => `▫️ ${d.day}: ${d.count}`).join("\n")
        : "No previous records")
    );

  if (!statsData.statsMessageId) {
    const msg = await channel.send({ embeds: [embed] });
    statsData.statsMessageId = msg.id;
    saveData();
  } else {
    const msg = await channel.messages.fetch(statsData.statsMessageId);
    await msg.edit({ embeds: [embed] });
  }
}

module.exports = (client) => {
  loadData();

  setInterval(() => {
    updateStats(client).catch(() => {});
  }, 60 * 60 * 1000);

  client.on("messageCreate", async (message) => {
    try {
      if (message.channel.id !== ALLOWED_CHANNEL_ID) return;
      if (!message.webhookId) return;
      if (!message.content.includes("God Pack found")) return;

      // =======================
      // Imagen principal solo para embed
      // =======================
      let imageFile = null;
      if (message.attachments.size > 0) {
        const firstAttachment = message.attachments.first();
        const attachmentBuilder = new AttachmentBuilder(firstAttachment.url, { name: firstAttachment.name });
        imageFile = `attachment://${firstAttachment.name}`;
      }

      // =======================
      // Datos del pack
      // =======================
      const rarityMatch = message.content.match(/\[(\d)\/5\]/);
      if (!rarityMatch) return;
      const rarity = parseInt(rarityMatch[1]);

      const packMatch = message.content.match(/\[(\d+)P\]/i);
      const packNumber = packMatch ? parseInt(packMatch[1]) : null;
      const packText = packNumber ? `${packNumber}P` : "1P";

      const usernameMatch = message.content.match(/^(.+?) \(\d+\)$/m);
      if (!usernameMatch) return;
      const username = usernameMatch[1];

      let color = 0x999999;
      if (rarity === 5) color = 0xFFD700;
      if (rarity === 3) color = 0x0099ff;

      // =======================
      // Embed y botones
      // =======================
      const embed = new EmbedBuilder()
        .setColor(color)
        .setDescription(`## ✨ ${rarity}/5 • ${packText}  |  **${username}**`);

      if (imageFile) embed.setImage(imageFile);

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("gp_alive")
          .setLabel("🟢 Alive")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("gp_dead")
          .setLabel("🔴 Dead")
          .setStyle(ButtonStyle.Danger)
      );

      // =======================
      // Mensaje principal SIN attachments adicionales
      // =======================
      const sentMessage = await message.channel.send({
        embeds: [embed],
        components: [buttons],
        files: imageFile ? [new AttachmentBuilder(message.attachments.first().url, { name: message.attachments.first().name })] : []
      });

      packVotes.set(sentMessage.id, {
        alive: new Set(),
        dead: new Set(),
        confirmed: false
      });

      // =======================
      // Thread con mensaje original y attachments secundarios
      // =======================
      const thread = await sentMessage.startThread({
        name: `GP • ${rarity}/5`,
        autoArchiveDuration: 1440
      });

      await thread.send("📂 Original webhook message:");
      await thread.send({ content: message.content });

      if (message.attachments.size > 1) {
        const secondaryFiles = message.attachments.map((att, i) => {
          if (i === 0) return null; // omitir principal
          return new AttachmentBuilder(att.url, { name: att.name });
        }).filter(Boolean);

        if (secondaryFiles.length > 0) await thread.send({ files: secondaryFiles });
      }

      await message.delete().catch(() => {});
    } catch (err) {
      console.error("Error en messageCreate:", err);
    }
  });

  // =========================
  // BUTTON SYSTEM
  // =========================
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

    const oldEmbed = interaction.message.embeds[0];

    // CONFIRM ALIVE
    if (data.alive.size >= 2) {
      data.confirmed = true;
      statsData.todayCount++;
      saveData();
      await updateStats(interaction.client);

      const updatedEmbed = EmbedBuilder.from(oldEmbed)
        .setColor(0x00ff00)
        .setFooter({ text: "🟢 CONFIRMED ALIVE" });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("gp_alive")
          .setLabel(`🟢 Alive (${data.alive.size})`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(true)
      );

      return interaction.message.edit({ embeds: [updatedEmbed], components: [row] });
    }

    // CONFIRM DEAD
    if (data.dead.size >= 3) {
      data.confirmed = true;

      const updatedEmbed = EmbedBuilder.from(oldEmbed)
        .setColor(0xff0000)
        .setFooter({ text: "🔴 CONFIRMED DEAD" });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("gp_dead")
          .setLabel(`🔴 Dead (${data.dead.size})`)
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true)
      );

      return interaction.message.edit({ embeds: [updatedEmbed], components: [row] });
    }

    // NORMAL UPDATE
    const normalRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("gp_alive")
        .setLabel(`🟢 Alive (${data.alive.size})`)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("gp_dead")
        .setLabel(`🔴 Dead (${data.dead.size})`)
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.message.edit({ components: [normalRow] });
  });
};