const { EmbedBuilder } = require("discord.js");

let lastWebhookImage = null;
let lastWebhookChannel = null;

const ALLOWED_CHANNEL_ID = "1484015417411244082";

module.exports = (client) => {

  client.on("messageCreate", async (message) => {

    // Solo canal permitido
    if (message.channel.id !== ALLOWED_CHANNEL_ID) return;

    // Solo webhook
    if (!message.webhookId) return;

    // =========================
    // 1️⃣ SI TRAE IMAGEN → GUARDAR
    // =========================
    if (message.attachments.size > 0) {
      const attachmentsArray = Array.from(message.attachments.values());
      lastWebhookImage = attachmentsArray[0].url;
      lastWebhookChannel = message.channel.id;

      console.log("🧠 Imagen guardada temporalmente");
      return; // Salimos, esperamos el mensaje con texto
    }

    // =========================
    // 2️⃣ SI NO ES GOD PACK → SALIR
    // =========================
    if (!message.content.includes("God Pack found")) return;

    console.log("🔥 God Pack detectado");

    // =========================
    // 3️⃣ VERIFICAR QUE HAYA IMAGEN GUARDADA
    // =========================
    if (!lastWebhookImage || lastWebhookChannel !== message.channel.id) {
      console.log("❌ No hay imagen asociada");
      return;
    }

    const mainImage = lastWebhookImage;

    // Limpiar memoria
    lastWebhookImage = null;
    lastWebhookChannel = null;

    // =========================
    // 4️⃣ DETECTAR RAREZA
    // =========================
    const rarityMatch = message.content.match(/\[(\d)\/5\]/);
    if (!rarityMatch) {
      console.log("❌ No se detectó rareza");
      return;
    }

    const rarity = parseInt(rarityMatch[1]);

    // =========================
    // 5️⃣ DETECTAR USERNAME
    // =========================
    const usernameMatch = message.content.match(/^(.+?) \(\d+\)$/m);
    if (!usernameMatch) {
      console.log("❌ No se detectó username");
      return;
    }

    const username = usernameMatch[1];

    // =========================
    // 6️⃣ CREAR EMBED
    // =========================
    let color = 0x999999;
    if (rarity === 5) color = 0xFFD700;
    if (rarity === 3) color = 0x0099ff;

    const embed = new EmbedBuilder()
      .setTitle(`✨ GOD PACK ${rarity}/5`)
      .setDescription(`👤 **@${username}**`)
      .setColor(color)
      .setImage(mainImage);

    console.log("✅ Enviando embed...");

    await message.channel.send({ embeds: [embed] });

    // Opcional: borrar mensaje texto
    await message.delete().catch(() => {});

  });

};
