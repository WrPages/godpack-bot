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
    // Detectar imagen principal
    // ======================

    let mainImage = null;

    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
mainImage = attachment.url;
      console.log("📷 Imagen limpia:", mainImage);
    }

    // ======================
    // Detectar rareza
    // ======================

    const rarityMatch = message.content.match(/\[(\d)\/5\]/);
    if (!rarityMatch) return;

    const rarity = parseInt(rarityMatch[1]);

    // Detectar número de pack [1P]
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

    if (mainImage) {
      embed.setImage(mainImage);
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

    const sentMessage = await message.channel.send({
      embeds: [embed]
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

};