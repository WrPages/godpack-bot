const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

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
  const now = new Date();
  const today = now.toDateString();

  if (today !== statsData.currentDay) {
    statsData.lastFiveDays.unshift({
      day: statsData.currentDay,
      count: statsData.todayCount
    });

    if (statsData.lastFiveDays.length > 5)
      statsData.lastFiveDays.pop();

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
        ? statsData.lastFiveDays.map(d =>
            `▫️ ${d.day}: ${d.count}`
          ).join("\n")
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

  // ==============================
  // MESSAGE CREATE (WEBHOOK PANEL)
  // ==============================
  client.on("messageCreate", async (message) => {

    if (message.channel.id !== ALLOWED_CHANNEL_ID) return;
    if (!message.webhookId) return;
    if (!message.content.includes("God Pack found")) return;

    let imageFile = null;
    let imageName = null;

    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      imageFile = attachment.url;
      imageName = attachment.name;
    }

    const rarityMatch = message.content.match(/\[(\d)\/5\]/);
    if (!rarityMatch) return;

    const rarity = parseInt(rarityMatch[1]);

    const packMatch = message.content.match(/\[(\d)P\]/i);
    const packNumber = packMatch ? parseInt(packMatch[1]) : null;

    const usernameMatch = message.content.match(/^(.+?) \(\d+\)$/m);
    if (!usernameMatch) return;

    const username = usernameMatch[1];

    let color = 0x999999;
    if (rarity === 5) color = 0xFFD700;
    if (rarity === 3) color = 0x0099ff;

    const embed = new EmbedBuilder()
      .setTitle(`✨ GOD PACK ${rarity}/5${packNumber ? ` • Pack ${packNumber}` : ""}`)
      .setDescription(`👤 **@${username}**`)
      .setColor(color);

    if (imageFile && imageName) {
      embed.setImage(`attachment://${imageName}`);
    }

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

    const sentMessage = await message.channel.send({
      embeds: [embed],
      files: imageFile ? [{
        attachment: imageFile,
        name: imageName
      }] : [],
      components: [buttons]
    });

    packVotes.set(sentMessage.id, {
      alive: new Set(),
      dead: new Set(),
      confirmed: false
    });

    const thread = await sentMessage.startThread({
      name: `GP • ${rarity}/5`,
      autoArchiveDuration: 1440,
    });

    await thread.send("📂 Original webhook message:");
    await thread.send({ content: message.content });

    if (message.attachments.size > 0) {
      await thread.send({
        files: message.attachments.map(a => a.url)
      });
    }

    await message.delete().catch(() => {});
  });

  // ==============================
  // INTERACTIONS (BUTTON SYSTEM)
  // ==============================
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    const data = packVotes.get(interaction.message.id);
    if (!data) return;

    const userId = interaction.user.id;

    if (interaction.customId === "gp_alive") {
      data.alive.add(userId);
      data.dead.delete(userId);
    }

    if (interaction.customId === "gp_dead") {
      data.dead.add(userId);
      data.alive.delete(userId);
    }

    const totalVotes = data.alive.size + data.dead.size;

    const thread = interaction.message.thread;
    if (thread) {
      await thread.send(
        `🗳️ **${interaction.user.username} voted ${
          interaction.customId === "gp_alive" ? "ALIVE" : "DEAD"
        }**`
      );
    }

    // CONFIRMED
    if (totalVotes >= 3 && data.alive.size >= 2 && !data.confirmed) {
      data.confirmed = true;
      statsData.todayCount++;
      saveData();

      const confirmedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setFooter({ text: "🟢 CONFIRMED ALIVE" })
        .setColor(0x00ff00);

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("gp_alive")
          .setLabel(`🟢 Alive (${data.alive.size})`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(true)
      );

      await updateStats(interaction.client);

      return await interaction.update({
        embeds: [confirmedEmbed],
        components: [disabledRow]
      });
    }

    // LIKELY ALIVE (2 votes)
    if (data.alive.size >= 2 && !data.confirmed) {

      const likelyEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setFooter({ text: "🟢 Likely Alive (2 votes reached)" })
        .setColor(0x2ecc71);

      const aliveOnlyRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("gp_alive")
          .setLabel(`🟢 Alive (${data.alive.size})`)
          .setStyle(ButtonStyle.Success)
      );

      return await interaction.update({
        embeds: [likelyEmbed],
        components: [aliveOnlyRow]
      });
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

    return await interaction.update({
      components: [normalRow]
    });
  });

};