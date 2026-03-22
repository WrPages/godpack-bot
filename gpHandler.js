const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    // ID del canal donde llegan los webhooks (según tus logs)
    const CANAL_DETECCION_ID = '1484009807181779096'; 

    client.on('messageCreate', async (message) => {
        // 1. Filtros: Solo en el canal específico y que no sea el propio bot
        if (message.channel.id !== CANAL_DETECCION_ID) return;
        if (message.author.id === client.user.id) return;

        // 2. Solo procesar si es un mensaje de God Pack
        if (message.content.includes('God Pack found')) {
            try {
                const text = message.content;

                // --- EXTRACCIÓN DE DATOS ---
                // Extraer el Tag (@usuario)
                const tagMatch = text.match(/(@\w+)/);
                const userTag = tagMatch ? tagMatch[1] : 'N/A';

                // Extraer Nombre (antes del paréntesis)
                const nameMatch = text.match(/^([^\s(]+)\s*\(/m);
                const accountName = nameMatch ? nameMatch[1].trim() : 'Desconocido';

                // Extraer Rareza ([5/5][1P])
                const rarityMatch = text.match(/(\[\d+\/\d+\]\[\w+\])/);
                const rarity = rarityMatch ? rarityMatch[1] : 'Especial';

                // --- IMÁGENES ---
                const attachments = Array.from(message.attachments.values());
                const imgGodPack = attachments[0] ? attachments[0].url : null;
                const imgProfile = attachments[1] ? attachments[1].url : null;

                // --- CREACIÓN DEL PANEL ---
                const embed = new EmbedBuilder()
                    .setTitle('✨ ¡GOD PACK ENCONTRADO! ✨')
                    .setDescription('Se ha detectado una cuenta con un sobre especial.')
                    .setColor(0xF1C40F) // Dorado
                    .addFields(
                        { name: '👤 Usuario', value: `**${userTag}**`, inline: true },
                        { name: '🆔 Cuenta', value: `\`${accountName}\``, inline: true },
                        { name: '💎 Rareza', value: `**${rarity}**`, inline: true }
                    )
                    .setImage(imgGodPack) // Imagen grande (Cartas)
                    .setThumbnail(imgProfile) // Miniatura (Perfil/ID)
                    .setTimestamp()
                    .setFooter({ text: 'Sistema de Reroll TCGPocket', iconURL: client.user.displayAvatarURL() });

                // Enviar el panel mejorado
                await message.channel.send({ embeds: [embed] });
                console.log(`✅ [gpHandler] Panel generado para: ${accountName}`);

            } catch (error) {
                console.error('❌ [gpHandler] Error procesando el mensaje:', error);
            }
        }
    });

    console.log("✅ Modulo gpHandler cargado correctamente.");
};

