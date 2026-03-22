const { EmbedBuilder } = require("discord.js");
let lastWebhookImage = null;
let lastWebhookChannel = null;

const ALLOWED_CHANNEL_ID = "1484015417411244082"; // 👈 ID del canal permitido

module.exports = (client) => {

  client.on("messageCreate", async (message) => {

    // ✅ Solo escuchar el canal específico
    if (message.channel.id !== ALLOWED_CHANNEL_ID) return;

    // ✅ Solo aceptar mensajes de webhook
    if (!message.webhookId) return;
// Si trae imagen, guardarla
if (message.attachments.size > 0) {
  const attachmentsArray = Array.from(message.attachments.values());
  lastWebhookImage = attachmentsArray[0].url;
  lastWebhookChannel = message.channel.id;
  console.log("🧠 Imagen guardada temporalmente");
}

// Si contiene God Pack
if (!message.content.includes("God Pack found")) return;

// Si no hay imagen guardada, salir
if (!lastWebhookImage || lastWebhookChannel !== message.channel.id) {
  console.log("❌ No hay imagen asociada");
  return;
}

const mainImage = lastWebhookImage;

// limpiar memoria
lastWebhookImage = null;
lastWebhookChannel = null;
    

    console.log("📩 MENSAJE DE WEBHOOK DETECTADO");
    console.log("Contenido:", message.content);

    // Debe contener God Pack
    if (!message.content.includes("God Pack found")) return;

    // Detectar rareza [5/5]
    const rarityMatch = message.content.match(/\[(\d)\/5\]/);
    if (!rarityMatch) {
      console.log("❌ No se detectó rareza");
      return;
    }

    const rarity = parseInt(rarityMatch[1]);

    // Detectar username (línea que termina en (numeros))
    const usernameMatch = message.content.match(/^(.+?) \(\d+\)$/m);
    if (!usernameMatch) {
      console.log("❌ No se detectó username");
      return;
    }

    const username = usernameMatch[1];

    // ✅ Detectar imagen del webhook
   let mainImage = null;

// 1️⃣ Intentar desde attachments
if (message.attachments.size > 0) {
  const attachmentsArray = Array.from(message.attachments.values());
  mainImage = attachmentsArray[0].url;
  console.log("📷 Imagen desde attachment:", mainImage);
}

// 2️⃣ Si no hay attachment, intentar desde embeds
if (!mainImage && message.embeds.length > 0) {
  const embedImage = message.embeds[0]?.image?.url;
  if (embedImage) {
    mainImage = embedImage;
    console.log("🖼 Imagen desde embed:", mainImage);
  }
}

// 3️⃣ Si tampoco, buscar URL en el texto
if (!mainImage) {
  const urlMatch = message.content.match(/https?:\/\/\S+\.(png|jpg|jpeg|webp)/i);
  if (urlMatch) {
    mainImage = urlMatch[0];
    console.log("🌐 Imagen desde texto:", mainImage);
  }
}

if (!mainImage) {
  console.log("❌ No se pudo detectar imagen por ningún método");
}

    // Color según rareza
    let color = 0x999999;
    if (rarity === 5) color = 0xFFD700;
    if (rarity === 3) color = 0x0099ff;

    const embed = new EmbedBuilder()
      .setTitle(`✨ GOD PACK ${rarity}/5`)
      .setDescription(`👤 **@${username}**`)
      .setColor(color);

    if (mainImage) {
      embed.setImage(mainImage);
    }

    console.log("✅ Enviando embed...");

    // Borra mensaje original
    await message.delete().catch(() => {});

    await message.channel.send({ embeds: [embed] });

  });

};
