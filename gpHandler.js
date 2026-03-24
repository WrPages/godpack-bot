const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require("discord.js");

const fetch = require("node-fetch");

const ALLOWED_CHANNEL_ID = "1483616248406474832";

const USERS_GIST_ID = "312803a8e6964070593081d99a705d19";
const IDS_GIST_RAW_URL = "https://gist.githubusercontent.com/WrPages/1fc02ff0921e82b3af1d3101cee44e4c/raw/ids.txt";

async function getOnlineIDs() {
  try {
    const res = await fetch(IDS_GIST_RAW_URL + "?t=" + Date.now());
    const text = await res.text();
    return text.split("\n").map(x => x.trim()).filter(x => x.length > 0);
  } catch (err) {
    console.error("Error leyendo ids.txt:", err);
    return [];
  }
}

async function getUsers() {
  try {
    const res = await fetch(`https://api.github.com/gists/${USERS_GIST_ID}?t=${Date.now()}`);
    const data = await res.json();

    if (!data.files || !data.files["users.json"]) return {};

    return JSON.parse(data.files["users.json"].content || "{}");
  } catch (err) {
    console.error("Error leyendo users.json:", err);
    return {};
  }
}

module.exports = async (client) => {

  client.on("messageCreate", async (message) => {

    if (message.channel.id !== ALLOWED_CHANNEL_ID) return;
    if (message.author.bot) return;

    try {

      const embed = new EmbedBuilder()
        .setTitle("🎉 GP Detectado")
        .setDescription("Nuevo GP encontrado.")
        .setColor("Gold")
        .setTimestamp();

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("vote_yes")
          .setLabel("👍")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("vote_no")
          .setLabel("👎")
          .setStyle(ButtonStyle.Danger)
      );

      // 🔥 Obtener usuarios online
      const onlineIDs = await getOnlineIDs();
      const users = await getUsers();

      let mentionList = [];

      for (const discordId in users) {
        const gameId = users[discordId].id;

        if (onlineIDs.includes(gameId)) {
          mentionList.push(`<@${discordId}>`);
        }
      }

      const onlineMention = mentionList.join(" ");

      const sentMessage = await message.channel.send({
        content: onlineMention || null,
        embeds: [embed],
        components: [buttons],
        allowedMentions: { parse: ["users"] }
      });

      // 🔥 Crear hilo sin volver a mencionar
      try {
        const thread = await sentMessage.startThread({
          name: `GP Thread`,
          autoArchiveDuration: 1440,
          type: ChannelType.PublicThread
        });

        await thread.send("📂 Original webhook message:");
        await thread.send({
          content: message.content,
          allowedMentions: { parse: [] } // 👈 evita re-mención
        });

      } catch (err) {
        console.error("THREAD ERROR:", err);
      }

    } catch (err) {
      console.error("GP HANDLER ERROR:", err);
    }

  });

};