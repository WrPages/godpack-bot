const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
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

  // PANEL CREATION
  client.on("messageCreate", async (message) => {
    try {
      if (message.channel.id !== ALLOWED_CHANNEL_ID) return;
      if (!message.webhookId) return;
      if (!message.content.includes("God Pack found")) return;

      // Regex flexible
      const rarityMatch = message.content.match(/\[(\d)\/5\]/);
      if (!rarityMatch) return;
      const rarity = parseInt(rarityMatch[1]);

      const packMatch = message.content.match(/\[(\d+)P\]/i);
      const packNumber = packMatch ? parseInt(packMatch[1]) : null;
      const packText = packNumber ? `${packNumber}P` : "1P";

      const usernameMatch = message.content.match(/^(.+?)\s*\(\d+\)/m);
      if (!usernameMatch) return;
      const username = usernameMatch[1];

      // Embed y botones sin imagen
      let color = 0x999999;
      if (rarity === 5) color = 0xFFD700;
      if (rarity === 3) color = 0x0099ff;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setDescription(`## ✨ ${rarity}/5 • ${packText}  |  **${username}**`);

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

      // Mensaje principal: solo panel
      const sentMessage = await message.channel.send({
        embeds: [embed],
        components: [buttons]
      });

      packVotes.set(sentMessage.id, {
        alive: new Set(),
        dead: new Set(),
        confirmed: false
      });

      // THREAD con todos los attachments
      let thread;
      try {
        thread = await sentMessage.startThread({
          name: `GP • ${rarity}/5`,
          autoArchiveDuration: 1440
        });
      } catch (err) {
        console.error("No se pudo crear el thread:", err);
      }

      if (thread) {
        await thread.send("📂 Original webhook message:");
        await thread.send({ content: message.content });

        // Enviar todos los attachments (incluida la principal) al thread
        if (message.attachments.size > 0) {
          const threadFiles = message.attachments.map(att => ({ attachment: att.url, name: att.name }));
          await thread.send({ files: threadFiles });
        }
      }

      await message.delete().catch(() => {});
    } catch (err) {
      console.error("Error en messageCreate:", err);
    }
  });

  // BUTTON SYSTEM
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