const { EmbedBuilder } = require("discord.js");

const ALLOWED_CHANNEL_ID = "1484015417411244082";


const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const fs = require("fs");

const ALLOWED_CHANNEL_ID = "1484015417411244082";
const STATS_CHANNEL_ID = "PON_AQUI_EL_ID_DEL_CANAL_STATS";
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

module.exports = (client) => {
loadData();
setInterval(() => {
  updateStats(client);
}, 60 * 60 * 1000);

  client.on("messageCreate", async (message) => {

    if (message.channel.id !== ALLOWED_CHANNEL_ID) return;
    if (!message.webhookId) return;

    console.log("📩 MENSAJE DE WEBHOOK DETECTADO");
    console.log("Contenido completo:", message.content);

    if (!message.content.includes("God Pack found")) return;

    // ======================
    // Detectar imagen principal
    // ======================

    let imageFile = null;
    let imageName = null;

    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      imageFile = attachment.url;
      imageName = attachment.name;
    }

    // ======================
    // Detectar rareza
    // ======================

    const rarityMatch = message.content.match(/\[(\d)\/5\]/);
    if (!rarityMatch) return;

    const rarity = parseInt(rarityMatch[1]);

    const packMatch = message.content.match(/\[(\d)P\]/i);
    let packNumber = null;

    if (packMatch) {
      packNumber = parseInt(packMatch[1]);
      console.log("📦 Pack detectado:", packNumber);
    }

    // ======================
    // Detectar username
    // ======================

    const usernameMatch = message.content.match(/^(.+?) \(\d+\)$/m);
    if (!usernameMatch) return;

    const username = usernameMatch[1];

    // ======================
    // Crear embed
    // ======================

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

    console.log("✅ Enviando embed...");

    // ======================
    // Guardar datos originales
    // ======================

    const originalContent = message.content;
    const originalAttachments = [...message.attachments.values()];

    // ======================
    // 1️⃣ Enviar panel
    // ======================
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

//aqui envia

 const sentMessage = await message.channel.send({
  embeds: [embed],
  files: imageFile ? [imageFile] : [],
  components: [buttons]
});

packVotes.set(sentMessage.id, {
  alive: new Set(),
  dead: new Set(),
  confirmed: false
});

    // ======================
    // 2️⃣ Crear thread independiente
    // ======================

    const thread = await message.channel.threads.create({
      name: `GP • ${rarity}/5`,
      autoArchiveDuration: 1440,
    });

    console.log("🧵 Thread creado");

    // ======================
    // 3️⃣ Enviar contenido original al thread
    // ======================

    await thread.send("📂 Mensaje original del webhook:");

    if (originalContent) {
      await thread.send({ content: originalContent });
    }

    if (originalAttachments.length > 0) {
      await thread.send({
        files: originalAttachments.map(att => att.url)
      });
    }

    // ======================
    // 4️⃣ Borrar webhook original
    // ======================

    await message.delete().catch(() => {});

  });
  
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

  await interaction.reply({
    content: "✅ Voto registrado",
    ephemeral: true
  });

  const totalVotes = data.alive.size + data.dead.size;

  if (totalVotes >= 3 && data.alive.size >= 2 && !data.confirmed) {

    data.confirmed = true;
    statsData.todayCount++;
    saveData();

    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setFooter({ text: "🟢 CONFIRMADO VIVO" })
      .setColor(0x00ff00);

    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("gp_alive")
        .setLabel(`🟢 Alive (${data.alive.size})`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),

      new ButtonBuilder()
        .setCustomId("gp_dead")
        .setLabel(`🔴 Dead (${data.dead.size})`)
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true)
    );

    await interaction.message.edit({
      embeds: [updatedEmbed],
      components: [disabledRow]
    });

    updateStats(interaction.client);
  }
});

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
      `# 🟢 Hoy: ${statsData.todayCount}\n\n` +
      statsData.lastFiveDays.map(d =>
        `▫️ ${d.day}: ${d.count}`
      ).join("\n")
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

};
