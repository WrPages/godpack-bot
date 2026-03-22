const { EmbedBuilder } = require('discord.js');

// Exportamos una función que recibe el 'client' como argumento
module.exports = (client) => {
    
    const CANAL_DETECCION_ID = 'TU_ID_AQUÍ'; 

    client.on('messageCreate', async (message) => {
        // Filtros de seguridad
        if (message.channel.id !== CANAL_DETECCION_ID) return;
        if (message.author.id === client.user.id) return;

        if (message.content.includes('God Pack found')) {
            try {
                const content = message.content;

                // Regex para extraer datos
                const tagMatch = content.match(/(@\w+)/);
                const userTag = tagMatch ? tagMatch[1] : 'N/A';

                const nameMatch = content.match(/^([^\s(]+)\s*\(/m);
                const accountName = nameMatch ? nameMatch[1].trim() : 'Desconocido';

                const rarityMatch = content.match(/(\[\d+\/\d+\]\[\w+\])/);
                const rarity = rarityMatch ? rarityMatch[1] : '[?/?]';

                const attachments = Array.from(message.attachments.values());
                const imgGodPack = attachments[0] ? attachments[0].url : null;
                const imgProfile = attachments[1] ? attachments[1].url : null;

                if (!imgGodPack) return;

                const embed = new EmbedBuilder()
                    .setTitle('🌟 ¡GOD PACK IDENTIFICADO! 🌟')
                    .setColor(0xF1C40F)
                    .addFields(
                        { name: '👤 Usuario', value: `**${userTag}**`, inline: true },
                        { name: '🆔 Cuenta', value: `\`${accountName}\``, inline: true },
                        { name: '💎 Rareza', value: `**${rarity}**`, inline: true }
                    )
                    .setImage(imgGodPack)
                    .setThumbnail(imgProfile)
                    .setTimestamp();

                await message.channel.send({ embeds: [embed] });

            } catch (error) {
                console.error('Error en gpHandler:', error);
            }
        }
    });

    console.log("✅ Modulo gpHandler cargado correctamente.");
};
