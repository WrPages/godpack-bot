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

const GIST_ID = process.env.GIST_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const FILE_NAME = "gp_record.txt";

const ALLOWED_CHANNELS = [
  "1486277594629275770",
  "1484015417411244082",
  "1487362022864588902"
];

const STATS_CHANNEL_ID = "1484416376436424794";

let packVotes = new Map();
let statsData = {
  currentDay: new Date().toDateString(),
  todayCount: 0,
  lastFiveDays: [],
  statsMessageId: null
};

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
      { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
    );
    const data = await res.json();
    if (!data.files || !data.files["elite_users.json"]) return {};
    return JSON.parse(data.files["elite_users.json"].content || "{}");
  } catch (err) {
    console.error("GET USERS ERROR:", err);
    return {};
  }
}

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

// Funciones de threads, stats y demás se mantienen intactas
async function updateThreadName(message, status, rarity, packNumber, username) {
  try {
    if (!message.hasThread) return;
    const thread = await message.thread.fetch();
    let emoji = "⚪";
    if (status === "alive") emoji = "✅";
    if (status === "dead") emoji = "❌";
    const name = `${emoji} [${rarity}/5][${packNumber}P] ${username}`.slice(0, 90);
    await thread.setName(name);
  } catch (err) {
    console.error("THREAD NAME ERROR:", err);
  }
}

// Función updateStats se mantiene igual
// Función cleanWebhookMessage se mantiene igual
// Función createTestMessage se mantiene igual

module.exports = async (client) => {
  // CARGAR DATOS
  await loadData();

  client.once("ready", async () => {
    console.log(`Bot listo como ${client.user.tag}`);

    // ===== REGISTRAR COMANDOS =====
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
        Routes.applicationGuildCommands(client.user.id, "1483615153743462571"),
        { body: commands }
      );
      console.log("✅ /editpanel registrado");
    } catch (err) {
      console.error("❌ Error registrando comando:", err);
    }

    // ===== INICIALIZAR PANEL DE MENSAJES ANTIGUOS =====
    for (const channelId of ALLOWED_CHANNELS) {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) continue;

      const messages = await channel.messages.fetch({ limit: 50 }).catch(() => new Map());
      for (const [, message] of messages) {
        if (!message.webhookId) continue;
        if (!message.content.includes("God Pack found")) continue;

        if (!packVotes.has(message.id)) {
          const rarityMatch = message.content.match(/\[(\d)\/5\]/);
          const packMatch = message.content.match(/\[(\d)P\]/i);
          const usernameLine = message.content.split("\n").find(l => l.includes("(") && l.includes(")"));
          const rarity = rarityMatch ? parseInt(rarityMatch[1]) : 1;
          const packNumber = packMatch ? parseInt(packMatch[1]) : 1;
          let username = "Unknown";
          if (usernameLine) {
            const match = usernameLine.match(/^(.+?)\s*\(/);
            if (match) username = match[1].trim();
          }

          packVotes.set(message.id, {
            alive: new Set(),
            dead: new Set(),
            confirmed: false,
            rarity,
            packNumber,
            username
          });

          if (!message.components || message.components.length === 0) {
            const buttons = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("gp_alive")
                .setLabel(`🟢 Alive (0)`)
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId("gp_dead")
                .setLabel(`🔴 Dead (0)`)
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId(`edit_panel_${message.id}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("✏️")
            );
            await message.edit({ components: [buttons] }).catch(() => {});
          }
        }
      }
    }

    console.log("✅ Paneles antiguos inicializados.");

    await updateStats(client).catch(console.error);
    setInterval(() => updateStats(client).catch(console.error), 60 * 60 * 1000);
  });

  // ===== EVENTO MESSAGE CREATE =====
  client.on("messageCreate", async (message) => {
    if (!ALLOWED_CHANNELS.includes(message.channel.id)) return;
    if (!message.webhookId) return;
    if (!message.content.includes("God Pack found")) return;

    try {
      const rarityMatch = message.content.match(/\[(\d)\/5\]/);
      if (!rarityMatch) return;
      const rarity = parseInt(rarityMatch[1]);

      const packMatch = message.content.match(/\[(\d)P\]/i);
      const packNumber = packMatch ? parseInt(packMatch[1]) : 1;

      let username = "Unknown";
      const usernameLine = message.content.split("\n").find(l => l.includes("(") && l.includes(")"));
      if (usernameLine) {
        const match = usernameLine.match(/^(.+?)\s*\(/);
        if (match) username = match[1].trim();
      }

      let color = 0x808080;
      if (rarity === 3) color = 0x3498db;
      if (rarity === 4) color = 0x9b59b6;
      if (rarity === 5) color = 0xFFD700;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setDescription(`## ✨ ${rarity}/5 • ${packNumber}P  |  **${username}**`)
        .setTimestamp();

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("gp_alive")
          .setLabel("🟢 Alive (0)")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("gp_dead")
          .setLabel("🔴 Dead (0)")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`edit_panel_${message.id}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("✏️")
      );

      const sentMessage = await message.channel.send({
        embeds: [embed],
        components: [buttons],
        files: message.attachments.map(a => ({ attachment: a.url, name: a.name })),
        allowedMentions: { parse: ["users"] }
      });

      packVotes.set(sentMessage.id, {
        alive: new Set(),
        dead: new Set(),
        confirmed: false,
        rarity,
        packNumber,
        username
      });

      await message.delete().catch(() => {});
    } catch (err) {
      console.error("Error creando panel:", err);
    }
  });

  // ===== EVENTO INTERACTION CREATE =====
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton() && !interaction.isModalSubmit()) return;

    const data = packVotes.get(interaction.message.id);
    if (!data && !interaction.isModalSubmit()) return interaction.reply({ content: "❌ Datos no encontrados.", ephemeral: true });

    const userId = interaction.user.id;

    // ----- BOTONES ALIVE/DEAD -----
    if (interaction.isButton()) {
      await interaction.deferUpdate();

      if (interaction.customId === "gp_alive") {
        if (!data.alive.has(userId)) {
          data.alive.add(userId);
          data.dead.delete(userId);

          if (data.alive.size >= 2 && !data.confirmed) {
            data.confirmed = true;
            statsData.todayCount++;
            await saveData();
            await updateStats(interaction.client);
          }
        }
      }

      if (interaction.customId === "gp_dead") {
        if (!data.dead.has(userId)) {
          data.dead.add(userId);
          data.alive.delete(userId);
        }
      }

      // Actualizar labels
      const newComponents = interaction.message.components.map(row => {
        const newRow = ActionRowBuilder.from(row);
        newRow.components.forEach(btn => {
          if (btn.customId === "gp_alive") btn.setLabel(`🟢 Alive (${data.alive.size})`);
          if (btn.customId === "gp_dead") btn.setLabel(`🔴 Dead (${data.dead.size})`);
        });
        return newRow;
      });

      await interaction.message.edit({ components: newComponents }).catch(() => {});
      return;
    }

    // ----- MODAL SUBMIT -----
    if (interaction.isModalSubmit() && interaction.customId.startsWith("edit_panel_")) {
      const messageId = interaction.customId.replace("edit_panel_", "");
      const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
      if (!message) return interaction.reply({ content: "❌ Mensaje no encontrado.", ephemeral: true });

      const data = packVotes.get(message.id);
      if (!data) return interaction.reply({ content: "❌ Datos no encontrados.", ephemeral: true });

      const rarity = parseInt(interaction.fields.getTextInputValue("rarity"));
      const packNumber = parseInt(interaction.fields.getTextInputValue("pack"));
      const username = interaction.fields.getTextInputValue("username");

      if (isNaN(rarity) || rarity < 1 || rarity > 5)
        return interaction.reply({ content: "❌ Rareza inválida.", ephemeral: true });

      data.rarity = rarity;
      data.packNumber = packNumber;
      data.username = username;

      let color = 0x808080;
      if (rarity === 3) color = 0x3498db;
      if (rarity === 4) color = 0x9b59b6;
      if (rarity === 5) color = 0xFFD700;

      const embed = EmbedBuilder.from(message.embeds[0])
        .setColor(color)
        .setDescription(`## ✨ ${rarity}/5 • ${packNumber}P  |  **${username}**`);

      await message.edit({ embeds: [embed] });
      await updateThreadName(message, data.confirmed ? "alive" : null, rarity, packNumber, username);

      return interaction.reply({ content: "✅ Panel actualizado.", ephemeral: true });
    }
  });
};