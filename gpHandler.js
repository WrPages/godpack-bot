const { EmbedBuilder } = require("discord.js");
const ALLOWED_CHANNEL_ID = "1484015417411244082"; // 👈 PON AQUÍ EL ID DEL CANAL
module.exports = (client) => {


  if (!message.webhookId) return;
  client.on("messageCreate", async (message) => {

    console.log("📩 MENSAJE DETECTADO");
    console.log("Contenido:", message.content);

    // Permitir webhook
    //if (message.author.bot && !message.webhookId) return;

    // Debe contener God Pack
    if (!message.content.includes("God Pack found")) return;

    // Detectar rareza [5/5]
    const rarityMatch = message.content.match(/\[(\d)\/5\]/);
    if (!rarityMatch) {
      console.log("❌ No se detectó rareza");
      return;
    }

    const rarity = rarityMatch[1];

    // Detectar username (línea que termina en (numeros))
    const usernameMatch = message.content.match(/^(.+?) \(\d+\)$/m);
    if (!usernameMatch) {
      console.log("❌ No se detectó username");
      return;
    }

    const username = usernameMatch[1];

let mainImage = null;

if (message.attachments.size > 0) {
  console.log("📷 Adjuntos detectados:", message.attachments.size);

  const attachmentsArray = Array.from(message.attachments.values());

  // Primera imagen
  mainImage = attachmentsArray[0].url;

  console.log("✅ Imagen encontrada:", mainImage);
}

if (!mainImage) {
  console.log("❌ No se encontró imagen en el webhook");
}

    
    let color = 0x999999;
    if (rarity == 5) color = 0xFFD700;
    if (rarity == 3) color = 0x0099ff;

    const embed = new EmbedBuilder()
      .setTitle(`✨ GOD PACK ${rarity}/5`)
      .setDescription(`👤 **@${username}**`)
      .setImage(mainImage)
      .setColor(color);

    console.log("✅ Enviando embed...");

    // Borra mensaje original
    await message.delete().catch(() => {});

    await message.channel.send({ embeds: [embed] });

  });

};
