const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // ¡IMPORTANTE! Activa esto en el Discord Developer Portal
    ],
});

// --- CONFIGURACIÓN DE IDs ---
const CONFIG = {
    CANAL_DETECCION_ID: '1484015417411244082', // Pega aquí el ID del canal de rerolls
    COLOR_PANEL: 0xF1C40F, // Amarillo/Dorado para el God Pack
};

client.on('messageCreate', async (message) => {
    // 1. FILTRO DE CANAL: Si el mensaje NO es en el canal específico, ignoramos
    if (message.channel.id !== CONFIG.CANAL_DETECCION_ID) return;

    // 2. FILTRO DE AUTOR: Ignorar mensajes del propio bot para evitar bucles
    if (message.author.id === client.user.id) return;

    // 3. DETECCIÓN DE CONTENIDO (Buscamos la palabra "God Pack" para estar seguros)
    if (message.content.includes('God Pack found')) {
        try {
            const content = message.content;

            // --- EXTRACCIÓN CON REGEX ---
            
            // Extraer Tag (@wr98)
            const tagMatch = content.match(/(@\w+)/);
            const userTag = tagMatch ? tagMatch[1] : 'N/A';

            // Extraer Nombre de cuenta (B-124) - Texto al inicio antes del '('
            const nameMatch = content.match(/^([^\s(]+)\s*\(/m);
            const accountName = nameMatch ? nameMatch[1].trim() : 'Desconocido';

            // Extraer Rareza ([5/5][1P])
            const rarityMatch = content.match(/(\[\d+\/\d+\]\[\w+\])/);
            const rarity = rarityMatch ? rarityMatch[1] : '[?/?]';

            // --- MANEJO DE IMÁGENES ---
            const attachments = Array.from(message.attachments.values());
            
            // Usamos la primera imagen (cartas) como principal y la segunda (perfil) como miniatura
            const imgGodPack = attachments[0] ? attachments[0].url : null;
            const imgProfile = attachments[1] ? attachments[1].url : null;

            if (!imgGodPack) return; // Si no hay imagen del pack, no generamos panel

            // --- CONSTRUCCIÓN DEL PANEL MEJORADO ---
            const embed = new EmbedBuilder()
                .setTitle('🌟 ¡GOD PACK IDENTIFICADO! 🌟')
                .setDescription(`Se ha localizado un paquete especial en el sistema de reroll.`)
                .setColor(CONFIG.COLOR_PANEL)
                .addFields(
                    { name: '👤 Usuario', value: `**${userTag}**`, inline: true },
                    { name: '🆔 Cuenta', value: `\`${accountName}\``, inline: true },
                    { name: '💎 Rareza', value: `**${rarity}**`, inline: true }
                )
                .setImage(imgGodPack) // Imagen grande: Las 5 cartas
                .setThumbnail(imgProfile) // Imagen pequeña: El Friend ID
                .setFooter({ text: 'TCGPocket Reroll System', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            // 4. ENVIAR Y LIMPIAR
            // Enviamos el panel nuevo
            await message.channel.send({ embeds: [embed] });

            // (Opcional) Borrar el mensaje original del bot/webhook para que solo quede el panel bonito
            // await message.delete().catch(() => {}); 

        } catch (error) {
            console.error('Error al procesar el webhook:', error);
        }
    }
});

client.login('TU_TOKEN_AQUI');
