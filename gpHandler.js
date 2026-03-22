const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    // IMPORTANTE: Asegúrate de que este ID sea el del CANAL, no el del Webhook.
    const CANAL_DETECCION_ID = '1484009807181779096'; 

    client.on('messageCreate', async (message) => {
        // 1. FILTRO: Solo procesar en el canal específico
        if (message.channel.id !== CANAL_DETECCION_ID) return;

        // 2. DETECCIÓN: Buscamos "God Pack found" sin importar quién lo envíe
        if (message.content.includes('God Pack found')) {
            console.log("🚀 [gpHandler] Iniciando creación de panel...");

            try {
                const content = message.content;

                // --- EXTRACCIÓN DE DATOS ---
                const tagMatch = content.match(/(@\w+)/);
                const userTag = tagMatch ? tagMatch[1] : 'N/A';

                // Buscar el nombre antes del ID entre paréntesis
                const nameMatch = content.match(/^([^\s(]+)\s*\(/m);
                const accountName = nameMatch ? nameMatch[1].trim() : 'Desconocido';

                const rarityMatch = content.match(/(\[\d+\/\d+\]\[\w+\])/);
                const rarity = rarityMatch ? rarityMatch[1] : 'Especial';

                // --- IMÁGENES ---
                // Convertimos a array para asegurar el orden
                const attachments = Array.from(message.attachments.values());
                const imgGodPack = attachments[0] ? attachments[0].url : null;
                const imgProfile = attachments[1] ? attachments[1].url : null;

                console.log(`📸 Imágenes detectadas: ${attachments.length}`);

                // --- CONSTRUCCIÓN DEL EMBED ---
                const embed = new EmbedBuilder()
                    .setTitle('✨ ¡NUEVO GOD PACK DETECTADO! ✨')
                    .setColor(0xF1C40F)
                    .addFields(
                        { name: '👤 Usuario', value: `**${userTag}**`, inline: true },
                        { name: '🆔 Cuenta', value: `\`${accountName}\``, inline: true },
                        { name: '💎 Rareza', value: `**${rarity}**`, inline: true }
                    )
                    .setTimestamp();

                if (imgGodPack) embed.setImage(imgGodPack);
                if (imgProfile) embed.setThumbnail(imgProfile);

                // --- ENVÍO CON CAPTURA DE ERROR ---
                await message.channel.send({ embeds: [embed] })
                    .then(() => console.log(`✅ [gpHandler] Panel enviado para ${accountName}`))
                    .catch(err => console.error(`❌ [gpHandler] Error al enviar el mensaje:`, err));

            } catch (error) {
                console.error('❌ [gpHandler] Error crítico en el proceso:', error);
            }
        }
    });

    console.log("✅ Modulo gpHandler cargado y escuchando...");
};
