const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    // REEMPLAZA ESTO CON EL ID REAL DE TU CANAL
    const CANAL_DETECCION_ID = '1484009807181779096'; // O el ID del canal donde quieres que aparezca

    client.on('messageCreate', async (message) => {
        // 1. Filtros de seguridad
        if (message.channel.id !== CANAL_DETECCION_ID) return;
        if (message.author.id === client.user.id) return;

        // 2. Comprobar si es el mensaje del God Pack
        if (message.content.includes('God Pack found')) {
            console.log("📩 PROCESANDO GOD PACK...");

            try {
                const content = message.content;

                // --- EXTRACCIÓN MEJORADA PARA TU FORMATO ---
                
                // Extraer el Tag (ej: @Lordchaosz)
                const tagMatch = content.match(/(@\w+)/);
                const userTag = tagMatch ? tagMatch[1] : 'N/A';

                // Extraer el Nombre de Cuenta (ej: LordhGP) que está antes del paréntesis
                const nameMatch = content.match(/^([^\s(]+)\s*\(/m);
                const accountName = nameMatch ? nameMatch[1].trim() : 'Desconocido';

                // Extraer la Rareza (ej: [3/5][2P])
                const rarityMatch = content.match(/(\[\d+\/\d+\]\[\w+\])/);
                const rarity = rarityMatch ? rarityMatch[1] : 'Desconocida';

                // --- MANEJO DE IMÁGENES ---
                const attachments = Array.from(message.attachments.values());
                
                // Imagen 1: El God Pack (Cartas)
                // Imagen 2: El Perfil (Friend ID)
                const imgGodPack = attachments[0] ? attachments[0].url : null;
                const imgProfile = attachments[1] ? attachments[1].url : null;

                // --- CREACIÓN DEL EMBED ---
                const embed = new EmbedBuilder()
                    .setTitle('✨ ¡NUEVO GOD PACK DETECTADO! ✨')
                    .setDescription(`¡Felicidades! Se ha encontrado un paquete especial.`)
                    .setColor(0xF1C40F) // Dorado
                    .addFields(
                        { name: '👤 Usuario', value: `**${userTag}**`, inline: true },
                        { name: '🆔 Cuenta', value: `\`${accountName}\``, inline: true },
                        { name: '💎 Rareza', value: `**${rarity}**`, inline: true }
                    )
                    .setTimestamp();

                // Añadir imagen grande si existe
                if (imgGodPack) {
                    embed.setImage(imgGodPack);
                }

                // Añadir miniatura del perfil si existe
                if (imgProfile) {
                    embed.setThumbnail(imgProfile);
                }

                // --- ENVIAR ---
                await message.channel.send({ embeds: [embed] });
                console.log(`✅ Panel enviado con éxito para la cuenta: ${accountName}`);

            } catch (error) {
                console.error('❌ Error al generar el panel:', error);
            }
        }
    });

    console.log("✅ Modulo gpHandler cargado correctamente.");
};
