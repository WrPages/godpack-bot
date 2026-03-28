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
//cambia alive o desd hilos
async function updateThreadName(message, status, rarity, packNumber, username) {
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

    const name = `${emoji} [${rarity}/5][${packNumber}P] ${username}`.slice(0, 90);

    await thread.setName(name);
  } catch (err) {
    console.error("THREAD NAME ERROR:", err);
  }
}

// termina
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
  packVotes.set(msg.id, { alive: new Set(), dead: new Set(), confirmed: false });
}

module.exports = async (client) => {
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

        // Reconstruir botones si faltan
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

  // ===== PANEL DE ESTADÍSTICAS =====
  await updateStats(client).catch(console.error);

  // Actualizar stats cada hora
  setInterval(() => updateStats(client).catch(console.error), 60 * 60 * 1000);
});



client.on("interactionCreate", async (interaction) => {

  // ===== BOTONES =====
  if (interaction.isButton()) {
    const data = packVotes.get(interaction.message.id);
    if (!data) return interaction.reply({ content: "❌ Datos no encontrados.", ephemeral: true });

    const userId = interaction.user.id;

    // BOTÓN ALIVE
    if (interaction.customId === "gp_alive") {
      if (data.alive.has(userId)) return interaction.reply({ content: "Ya votaste Alive.", ephemeral: true });
      data.alive.add(userId);
      data.dead.delete(userId);

      // Si alcanza 2 votos Alive y no se ha confirmado
      if (data.alive.size >= 2 && !data.confirmed) {
        data.confirmed = true;
        statsData.todayCount++;
        await saveData(); // guarda en Gist
        await updateStats(client);
      }
    }

    // BOTÓN DEAD
    if (interaction.customId === "gp_dead") {
      if (data.dead.has(userId)) return interaction.reply({ content: "Ya votaste Dead.", ephemeral: true });
      data.dead.add(userId);
      data.alive.delete(userId);
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

    await interaction.update({ components: newComponents });
    return;
  }

  // ===== BOTÓN EDIT PANEL =====
  if (interaction.isButton() && interaction.customId.startsWith("edit_panel_")) {
    // Solo rol Champion puede usar
    if (!interaction.member.roles.cache.some(r => r.name === "Champion")) {
      return interaction.reply({ content: "❌ Only Champion can edit this panel.", ephemeral: true });
    }

    const messageId = interaction.customId.replace("edit_panel_", "");
    const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
    if (!message) return interaction.reply({ content: "❌ Mensaje no encontrado.", ephemeral: true });

    const data = packVotes.get(message.id);
    if (!data) return interaction.reply({ content: "❌ Datos no encontrados.", ephemeral: true });

    // Crear modal
    const modal = new ModalBuilder()
      .setCustomId(`edit_panel_${message.id}`)
      .setTitle("Editar GP Panel");

    const rarityInput = new TextInputBuilder()
      .setCustomId("rarity")
      .setLabel("Rareza (1-5)")
      .setStyle(TextInputStyle.Short)
      .setValue(String(data.rarity));

    const packInput = new TextInputBuilder()
      .setCustomId("pack")
      .setLabel("Packs")
      .setStyle(TextInputStyle.Short)
      .setValue(String(data.packNumber));

    const userInput = new TextInputBuilder()
      .setCustomId("username")
      .setLabel("Usuario")
      .setStyle(TextInputStyle.Short)
      .setValue(data.username);

    modal.addComponents(
      new ActionRowBuilder().addComponents(rarityInput),
      new ActionRowBuilder().addComponents(packInput),
      new ActionRowBuilder().addComponents(userInput)
    );

    return interaction.showModal(modal);
  }

  // ===== MODAL SUBMIT =====
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
  if (!message.content.includes("God Pack found")) return;

  try {
    // ===== IMAGEN =====
    const attachment = message.attachments.first();
    const imageFile = attachment
      ? { attachment: attachment.url, name: "card.png" }
      : null;

    // ===== DATOS =====
    const rarityMatch = message.content.match(/\[(\d)\/5\]/);
    const packMatch = message.content.match(/\[(\d)P\]/i);
    const usernameLine = message.content.split("\n").find(l => l.includes("(") && l.includes(")"));

    const rarity = rarityMatch ? parseInt(rarityMatch[1]) : 1;
    const packNumber = packMatch ? parseInt(packMatch[1]) : 1;
    const username = usernameLine ? usernameLine.match(/^(.+?)\s*\(/)[1].trim() : "Unknown";

    // ===== COLOR =====
    const color = [0x808080, 0x3498db, 0x9b59b6, 0xFFD700][rarity - 1] || 0x808080;

    // ===== EMBED =====
    const embed = new EmbedBuilder()
      .setColor(color)
      .setDescription(`## ✨ ${rarity}/5 • ${packNumber}P  |  **${username}**`)
      .setTimestamp();
    if (imageFile) embed.setImage("attachment://card.png");

    // ===== BOTONES =====
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("gp_alive").setLabel("🟢 Alive (0)").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("gp_dead").setLabel("🔴 Dead (0)").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`edit_panel_${message.id}`).setStyle(ButtonStyle.Secondary).setEmoji("✏️")
    );

    // ===== ENVIAR MENSAJE =====
    const sentMessage = await message.channel.send({
      embeds: [embed],
      components: [buttons],
      files: imageFile ? [imageFile] : [],
      allowedMentions: { parse: ["users"] }
    });

    // ===== REGISTRAR EN packVotes =====
    packVotes.set(sentMessage.id, {
      alive: new Set(),
      dead: new Set(),
      confirmed: false,
      rarity,
      packNumber,
      username
    });

    // ===== CREAR HILO =====
    try {
      const thread = await sentMessage.startThread({
        name: `[${rarity}/5][${packNumber}P] ${username}`,
        autoArchiveDuration: 1440,
        type: ChannelType.PublicThread
      });

      // ===== Menciones ONLINE =====
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

      if (mentionList.length > 0) {
        await thread.send({
          content: mentionList.join(" "),
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

  // ===== BOTÓN EDIT PANEL =====
  if (interaction.isButton() && interaction.customId.startsWith("edit_panel_")) {

    // Solo rol Champion puede usar
    if (!interaction.member.roles.cache.some(r => r.name === "Champion")) {
      return interaction.reply({ content: "❌ Only Champion can edit this panel.", ephemeral: true });
    }

 

  const messageId = interaction.customId.replace("edit_panel_", "");
  const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
  if (!message) return interaction.reply({ content: "❌ Mensaje no encontrado.", ephemeral: true });

  const data = packVotes.get(message.id);
  if (!data) return interaction.reply({ content: "❌ Datos no encontrados.", ephemeral: true });

  // Abrir modal como antes...
}

// ===== BOTÓN EDIT =====
if (interaction.isButton() && interaction.customId.startsWith("edit_panel_")) {
    const messageId = interaction.customId.replace("edit_panel_", "");
    const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
    if (!message) return interaction.reply({ content: "❌ Mensaje no encontrado.", ephemeral: true });

    const data = packVotes.get(message.id);
    if (!data) return interaction.reply({ content: "❌ Datos no encontrados.", ephemeral: true });

    // Crear modal
    const modal = new ModalBuilder()
        .setCustomId(`edit_panel_${message.id}`)
        .setTitle("Editar GP Panel");

    const rarityInput = new TextInputBuilder()
        .setCustomId("rarity")
        .setLabel("Rareza (1-5)")
        .setStyle(TextInputStyle.Short)
        .setValue(String(data.rarity));

    const packInput = new TextInputBuilder()
        .setCustomId("pack")
        .setLabel("Packs")
        .setStyle(TextInputStyle.Short)
        .setValue(String(data.packNumber));

    const userInput = new TextInputBuilder()
        .setCustomId("username")
        .setLabel("Usuario")
        .setStyle(TextInputStyle.Short)
        .setValue(data.username);

    modal.addComponents(
        new ActionRowBuilder().addComponents(rarityInput),
        new ActionRowBuilder().addComponents(packInput),
        new ActionRowBuilder().addComponents(userInput)
    );

    return interaction.showModal(modal);
}

  // ===== MODAL SUBMIT =====
  if (interaction.isModalSubmit()) {

    if (!interaction.customId.startsWith("edit_panel_")) return;

    const messageId = interaction.customId.replace("edit_panel_", "");

    const message = await interaction.channel.messages.fetch(messageId).catch(() => null);

    if (!message) {
      return interaction.reply({ content: "❌ No se encontró el mensaje.", ephemeral: true });
    }

    const data = packVotes.get(message.id);

    if (!data) {
      return interaction.reply({ content: "❌ Datos no encontrados.", ephemeral: true });
    }

    const rarity = parseInt(interaction.fields.getTextInputValue("rarity"));
    const packNumber = parseInt(interaction.fields.getTextInputValue("pack"));
    const username = interaction.fields.getTextInputValue("username");

    if (isNaN(rarity) || rarity < 1 || rarity > 5) {
      return interaction.reply({ content: "❌ Rareza inválida.", ephemeral: true });
    }

    let color = 0x808080;
    if (rarity === 3) color = 0x3498db;
    if (rarity === 4) color = 0x9b59b6;
    if (rarity === 5) color = 0xFFD700;

    const embed = EmbedBuilder.from(message.embeds[0]);

    embed
      .setColor(color)
      .setDescription(`## ✨ ${rarity}/5 • ${packNumber}P  |  **${username}**`);

    await message.edit({ embeds: [embed] });

    data.rarity = rarity;
    data.packNumber = packNumber;
    data.username = username;

    await updateThreadName(
      message,
      data.confirmed ? (data.alive.size >= 2 ? "alive" : "dead") : null,
      rarity,
      packNumber,
      username
    );

    return interaction.reply({
      content: "✅ Panel actualizado.",
      ephemeral: true
    });
  }

  // ===== BOTONES =====
  if (interaction.isButton()) {

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
    // Después de actualizar data.alive y data.dead
if (data.alive.size > 0 || data.dead.size > 0) {
  // eliminar botón de Editar
  const newComponents = interaction.message.components.map(row => {
    // filtra cualquier botón de edit_panel_
    const newRow = ActionRowBuilder.from(row);
    newRow.components = newRow.components.filter(b => !b.customId.startsWith("edit_panel_"));
    return newRow;
  });

  await interaction.message.edit({ components: newComponents }).catch(() => {});
}

    // tu lógica sigue igual...
  }
});
};
