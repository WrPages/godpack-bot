const { EmbedBuilder } = require("discord.js");

module.exports = (client) => {

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

    // Detectar imagen
    const attachment = message.attachments.first();
    if (!attachment) {
      console.log("❌ No se detectó imagen");
      return;
    }

    let color = 0x999999;
    if (rarity == 5) color = 0xFFD700;
    if (rarity == 3) color = 0x0099ff;

    const embed = new EmbedBuilder()
      .setTitle(`✨ GOD PACK ${rarity}/5`)
      .setDescription(`👤 **@${username}**`)
      .setImage(attachment.url)
      .setColor(color);

    console.log("✅ Enviando embed...");

    // Borra mensaje original
    await message.delete().catch(() => {});

    await message.channel.send({ embeds: [embed] });

  });

};
