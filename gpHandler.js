const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} = require('discord.js');

const TARGET_CHANNEL_ID = 1484015417411244082;

// Guardamos votos en memoria
const votes = new Map();

module.exports = (client) => {

    client.on('messageCreate', async (message) => {

        // 1. Solo mensajes de webhook en tu canal
        if (message.channel.id !== TARGET_CHANNEL_ID) return;
        if (!message.webhookId) return;

        try {
            const content = message.content;

            // 2. Extraer rareza [4/5][1P]
            const rarityMatch = content.match(/\[(\d\/\d)\]\[(\dP)\]/i);
            const rarity = rarityMatch ? `${rarityMatch[1]} • ${rarityMatch[2]}` : 'Unknown';

            // 3. Extraer usuario (ej: | LordhGP)
            const userMatch = content.match(/\|\s(.+)/);
            const username = userMatch ? userMatch[1].trim() : 'Unknown';

            // 4. Obtener imágenes
            const attachments = [...message.attachments.values()];
            const cardsImage = attachments[0]?.url || null;
            const profileImage = attachments[1]?.url || null;

            // 5. Crear embed tipo panel
            const embed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle(`✨ ${rarity} | ${username}`)
                .setImage(cardsImage)
                .setThumbnail(profileImage);

            // 6. Botones
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('alive')
                    .setLabel('Alive')
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId('dead')
                    .setLabel('Dead')
                    .setStyle(ButtonStyle.Danger)
            );

            // 7. Enviar nuevo panel
            const panelMessage = await message.channel.send({
                embeds: [embed],
                components: [row]
            });

            // Inicializar votos
            votes.set(panelMessage.id, {
                alive: new Set(),
                dead: new Set()
            });

            // 8. Crear hilo
            const thread = await panelMessage.startThread({
                name: `Registro ${username}`,
                autoArchiveDuration: 60,
                type: ChannelType.PublicThread
            });

            // 9. Guardar mensaje original en el hilo
            await thread.send({
                content: `Mensaje original:\n${content}`,
                files: attachments.map(a => a.url)
            });

            // 10. Borrar mensaje original
            await message.delete();

        } catch (err) {
            console.error('Error procesando webhook:', err);
        }
    });


    // 🎮 Manejo de botones
    client.on('interactionCreate', async (interaction) => {

        if (!interaction.isButton()) return;

        const data = votes.get(interaction.message.id);
        if (!data) return;

        const userId = interaction.user.id;

        if (interaction.customId === 'alive') {
            data.alive.add(userId);
            data.dead.delete(userId);
        }

        if (interaction.customId === 'dead') {
            data.dead.add(userId);
            data.alive.delete(userId);
        }

        // 🔥 Condiciones
        if (data.alive.size >= 2) {
            await interaction.update({
                content: '🟢 ESTE GP ESTÁ VIVO',
                components: []
            });
            votes.delete(interaction.message.id);
            return;
        }

        if (data.dead.size >= 3) {
            await interaction.update({
                content: '🔴 ESTE GP ESTÁ MUERTO',
                components: []
            });
            votes.delete(interaction.message.id);
            return;
        }

        // Respuesta normal
        await interaction.reply({
            content: `Alive: ${data.alive.size} | Dead: ${data.dead.size}`,
            ephemeral: true
        });
    });
};