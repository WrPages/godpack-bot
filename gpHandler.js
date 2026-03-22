const { EmbedBuilder } = require("discord.js");

const ALLOWED_CHANNEL_ID = "1484015417411244082";

module.exports = (client) => {

  client.on("messageCreate", async (message) => {

    if (message.channel.id !== ALLOWED_CHANNEL_ID) return;
    if (!message.webhookId) return;

    console.log("📩 MENSAJE DE WEBHOOK DETECTADO");
    console.log("Contenido completo:", message.content);

    if (!message.content.includes("God Pack found")) return;

    // ======================
    // Detectar 

let mainImage = null;

if (message.attachments.size > 0) {
  const attachment = message.attachments.first();

  // Forzar URL limpia sin parámetros temporales
  mainImage = attachment.url.split("?")[0];

  console.log("📷 Imagen limpia:", mainImage);
}

    // ======================
    // Detectar rareza
    // ======================

    const rarityMatch = message.content.match(/\[(\d)\/5\]/);
    if (!rarityMatch) return;
// Detectar número de pack [1P]
const packMatch = message.content.match(/\[(\d)P\]/i);

let packNumber = null;
if (packMatch) {
  packNumber = parseInt(packMatch[1]);
  console.log("📦 Pack detectado:", packNumber);
}
    const rarity = parseInt(rarityMatch[1]);

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
      .setColor(color)
      .setImage(mainImage);

    console.log("✅ Enviando embed...");

    await message.channel.send({ embeds: [embed] });

    // Opcional borrar original
    await message.delete().catch(() => {});

  });

};
