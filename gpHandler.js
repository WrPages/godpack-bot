const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    // ID del canal donde llegan los mensajes (según tu log)
    const CANAL_DETECCION_ID = '1484009807181779096'; 

    client.on('messageCreate', async (message) => {
        // 1. Filtro por canal (Si no es este canal, ignorar)
        if (message.channel.id !== CANAL_DETECCION_ID) return;

        // 2. Filtro de autor (No responderse a sí mismo)
        if (message.author.id === client.user.id) return;

        // 3. Verificamos si el mensaje contiene la frase clave de God Pack
        const content = message.content || "";
        if (content.includes('God Pack found')) {
            
            console.log("🚀 [gpHandler] ¡Detectado! Iniciando panel visual...");

            try {
                // --- EXTRACCIÓN DE DATOS ---
                // Tag: @Lordchaosz
                const tagMatch = content.match(/(@\w+)/);
                const userTag = tagMatch ? tagMatch[1] : 'N/A';

                // Nombre: LordhGP (antes del paréntesis)
                const nameMatch = content.match(/^([^\s(]+)\s*\(/m);
                const accountName = nameMatch ? nameMatch[1].trim() : 'Desconocido';

                // Rareza: [3/5][2P][PaldeanWonders]
                const rarityMatch = content.match(/(\[\d+\/\d+\]\[\w+\](?:\[\w+\])?)/);
                const rarity = rarityMatch ? rarityMatch[1] : 'Especial';

                // --- IMÁGENES ---
                // Obtenemos los adjuntos (imágenes del webhook)
                const attachments = Array.from(message.attachments.values());
                const imgGodPack = attachments[0] ? attachments[0].url : null;
                const imgProfile = attachments[1] ? attachments[1].url : null;

                // --- CREACIÓN DEL EMBED ---
                const embed = new EmbedBuilder()
                    .setTitle('✨ ¡GOD PACK ENCONTRADO! ✨')
                    .setDescription('Se ha localizado un sobre con cartas raras.')
                    .setColor(0xF1C40F) // Color Dorado
                    .addFields(
                        { name: '👤 Usuario', value: `**${userTag}**`, inline: true },
                        { name: '🆔 Cuenta', value: `\`${accountName}\``, inline: true },
                        { name: '💎 Rareza', value: `**${rarity}**`, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'TCG Pocket Reroll Bot', iconURL: client.user.displayAvatarURL() });

                // Si hay imágenes, las ponemos
                if (imgGodPack) embed.setImage(imgGodPack); // Imagen grande de las cartas
                if (imgProfile) embed.setThumbnail(imgProfile); // Imagen pequeña del perfil

                // --- ENVIAR ---
                await message.channel.send({ embeds: [embed] });
                console.log(`✅ [gpHandler] Panel enviado para: ${accountName}`);

            } catch (error) {
                console.error('❌ [gpHandler] Error crítico:', error);
            }
        }
    });

    console.log("✅ Modulo gpHandler cargado y monitoreando canal " + CANAL_DETECCION_ID);
};
