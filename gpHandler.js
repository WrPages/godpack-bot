const { 
  EmbedBuilder 
} = require("discord.js");

module.exports = (client) => {

  client.on("messageCreate", async (message) => {
   if (message.author.bot && !message.webhookId) return;
if (!message.webhookId && message.author.id !== "111114110569029632") return;

    // ⚠️ CAMBIA ESTO POR EL ID DE TU CANAL group-packs
    const allowedChannel = "1484015417411244082";
    if (message.channel.id !== allowedChannel) return;

    // Detectar rareza [5/5], [3/5], [1/5]
    const rarityMatch = message.content.match(/\[(\d)\/5\]/);
    if (!rarityMatch) return;

    const rarity = rarityMatch[1];

    // Detectar username (ejemplo: [5/5][1P] wrx128 (123123))
const nameMatch = message.content.match(/\]\[\dP\]\s(.+?)\s\(/);
    
    if (!nameMatch) return;

    const username = nameMatch[1];

    // Detectar imagen
    const image = message.attachments.first();
    if (!image) return;

    // Color según rareza
    let color;
    if (rarity == 5) color = 0xFFD700;       // Dorado
    else if (rarity == 3) color = 0x0099ff;  // Azul
    else color = 0x999999;                   // Gris

    const embed = new EmbedBuilder()
      .setTitle(`✨ GOD PACK ${rarity}/5`)
      .setDescription(`👤 **@${username}**`)
      .setImage(image.url)
      .setColor(color)
      .setFooter({ text: "EternalGP Service" });

    // Borrar mensaje original del webhook (opcional)
    await message.delete().catch(() => {});

    await message.channel.send({
      embeds: [embed]
    });

  });

};
