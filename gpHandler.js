const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require("discord.js");

const fs = require("fs");

const ALLOWED_CHANNEL_ID = "1484015417411244082";
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

// =========================
// STATS SYSTEM
// =========================
async function updateStats(client) {
  const channel = await client.channels.fetch(ALLOWED_CHANNEL_ID);
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

    saveData();
  }

  const historyText =
    statsData.lastFiveDays.length > 0
      ? statsData.lastFiveDays
          .map(d => `▫️ ${d.day}: ${d.count}`)
          .join("\n")
      : "No previous records";

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📊 GP Stats")
    .setDescription(
      `**Today:** ${statsData.todayCount}\n\n**Last days:**\n${historyText}`
    );

  try {
    if (!statsData.statsMessageId) {
      const msg = await channel.send({ embeds: [embed] });
      statsData.statsMessageId = msg.id;
      saveData();
    } else {
      const msg = await channel.messages.fetch(statsData.statsMessageId);
      await msg.edit({ embeds: [embed] });
    }
  } catch {
    statsData.statsMessageId = null;
  }
}

// =========================
// MAIN MODULE
// =========================
module.exports = (client) => {

  loadData();

  setInterval(() => {
    updateStats(client).catch(() => {});
  }, 60 * 60 * 1000);

  client.on("messageCreate", async (message) => {

    if (message.channel.id !== ALLOWED_CHANNEL_ID) return;
    if (!message.webhookId) return;
    if (!message.content.includes("God Pack found")) return;

    try {

      const attachments = [...message.attachments.values()];
const cardsImage = attachments[0]?.proxyURL || attachments[0]?.url || null;

      const rarityMatch = message.content.match(/\[(\d)\/5\]/);
      if (!rarityMatch) return;

      const rarity = parseInt(rarityMatch[1]);

      const packMatch = message.content.match(/\[(\d)P\]/i);
      const packNumber = packMatch ? parseInt(packMatch[1]) : 1;

      const lines = message.content.split("\n");

      const usernameLine = lines.find(line =>
        line.includes("(") && line.includes(")")
      );

      let username = "Unknown";

      if (usernameLine) {
        const match = usernameLine.match(/^(.+?)\s*\(/);
        if (match) {
          username = match[1].trim();
        }
      }

      let color = 0x999999;
      if (rarity === 5) color = 0xFFD700;
      if (rarity === 4) color = 0x00ffcc;
      if (rarity === 3) color = 0x0099ff;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setDescription(`## ✨ ${rarity}/5 • ${packNumber}P  |  **${username}**`);

      if (cardsImage) embed.setImage(cardsImage);

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

     let sentMessage;

if (cardsImage) {
  sentMessage = await message.channel.send({
    embeds: [embed],
    components: [buttons],
    files: [{
      attachment: cardsImage,
      name: "cards.png"
    }]
  });

  // usar la imagen subida en el embed
  embed.setImage("attachment://cards.png");

  await sentMessage.edit({
    embeds: [embed]
  });

} else {
  sentMessage = await message.channel.send({
    embeds: [embed],
    components: [buttons]
  });
}

      packVotes.set(sentMessage.id, {
        alive: new Set(),
        dead: new Set(),
        confirmed: false
      });

      // THREAD
      try {
  await new Promise(res => setTimeout(res, 500));

  const thread = await sentMessage.startThread({
    name: `GP • ${rarity}/5`,
    autoArchiveDuration: 1440,
    type: ChannelType.PublicThread
  });

  await thread.send("📂 Original webhook message:");
  await thread.send({ content: message.content });

  if (message.attachments.size > 0) {
    await thread.send({
      files: [...message.attachments.values()].map(a => a.proxyURL || a.url)
    });
  }

} catch (err) {
  console.error("THREAD ERROR:", err);
}

      // DELETE
      try {
        await message.delete();
      } catch (err) {
        console.log("Reintentando borrar...");
        setTimeout(async () => {
          try {
            await message.delete();
          } catch (e) {
            console.error("DELETE FINAL ERROR:", e);
          }
        }, 2000);
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

    if (data.alive.size >= 2) {
      data.confirmed = true;

      statsData.todayCount++;
      saveData();
      await updateStats(interaction.client);

      const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0x00ff00)
        .setFooter({ text: "🟢 CONFIRMED ALIVE" });

      return interaction.message.edit({
        embeds: [updatedEmbed],
        components: []
      });
    }

    if (data.dead.size >= 3) {
      data.confirmed = true;

      const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0xff0000)
        .setFooter({ text: "🔴 CONFIRMED DEAD" });

      return interaction.message.edit({
        embeds: [updatedEmbed],
        components: []
      });
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
