/****************************************************
 *              🔧 CONFIGURACIÓN
 ****************************************************/

const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const axios = require("axios");

const TOKEN = process.env.TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const HEARTBEAT_CHANNEL_ID = "1483616146996465735";
const STATS_CHANNEL_ID = "1484015417411244082";

const GIST_REGISTROS_ID = "312803a8e6964070593081d99a705d19";
const GIST_ONLINE_IDS_ID = "d9db3a72fed74c496fd6cc830f9ca6e9";
const GIST_GP_HISTORY_ID = "4773653072f4851e91958a333e503de9";
const GIST_PPM_HISTORY_ID = "20527051079d88ec4d414c310cdfdf26";

/****************************************************
 *              🚀 CLIENT
 ****************************************************/

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/****************************************************
 *              📦 GIST FUNCTIONS
 ****************************************************/

async function getGist(gistId) {
  try {
    const res = await axios.get(
      `https://api.github.com/gists/${gistId}`,
      {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      }
    );

    const file = Object.values(res.data.files)[0];
    return JSON.parse(file.content);

  } catch (err) {
    console.log("❌ Error leyendo gist:", err.message);
    return null;
  }
}

async function updateGist(gistId, data) {
  try {
    await axios.patch(
      `https://api.github.com/gists/${gistId}`,
      {
        files: {
          "data.json": {
            content: JSON.stringify(data, null, 2)
          }
        }
      },
      {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      }
    );
  } catch (err) {
    console.log("❌ Error actualizando gist:", err.message);
  }
}

/****************************************************
 *              🔥 PANEL LOGIC
 ****************************************************/

async function updatePanel() {

  console.log("🔄 Actualizando panel...");

  try {

    const registros = await getGist(GIST_REGISTROS_ID) || {};
    const onlineIDs = await getGist(GIST_ONLINE_IDS_ID) || [];
    const ppmHistory = await getGist(GIST_PPM_HISTORY_ID) || [];

    const users = [];
    let totalPPM = 0;
    let totalInstances = 0;
    let totalPacks = 0;

    // 🔥 Sacamos IDs automáticamente desde registros
    const registroIDs = Object.keys(registros);

    for (const userId of registroIDs) {

      const username = registros[userId].username;
      const isOnline = onlineIDs.includes(userId);

      // 🔥 Buscar datos en el canal heartbeat
      let heartbeatData = null;

      try {
        const channel = await client.channels.fetch(HEARTBEAT_CHANNEL_ID);
        const messages = await channel.messages.fetch({ limit: 50 });

        const userMessage = messages.find(msg =>
          msg.content.includes(username)
        );

        if (userMessage) {
          heartbeatData = JSON.parse(userMessage.content);
        }

      } catch (err) {
        console.log("Error leyendo heartbeat:", err.message);
      }

      const ppm = isOnline ? (heartbeatData?.ppm || 0) : 0;
      const onlineInstances = heartbeatData?.onlineInstances || 0;
      const offlineInstances = heartbeatData?.offlineInstances || 0;
      const packs = heartbeatData?.packs || 0;

      const totalUserInstances = onlineInstances + offlineInstances;

      if (isOnline) totalPPM += ppm;
      totalInstances += totalUserInstances;
      totalPacks += packs;

      users.push({
        username,
        isOnline,
        ppm,
        onlineInstances,
        totalUserInstances,
        packs
      });
    }

    /**************** MEDIA 12H ****************/

    const now = Date.now();

    ppmHistory.push({ time: now, ppm: totalPPM });

    const filteredHistory = ppmHistory.filter(p =>
      now - p.time <= 12 * 60 * 60 * 1000
    );

    const avgPPM = filteredHistory.length
      ? (filteredHistory.reduce((a, b) => a + b.ppm, 0) / filteredHistory.length).toFixed(2)
      : "0.00";

    await updateGist(GIST_PPM_HISTORY_ID, filteredHistory);

    /**************** EMBED ****************/

    const embed = new EmbedBuilder()
      .setTitle("🔥 REROLL GLOBAL CONTROL PANEL 🔥")
      .setColor(0x00ffcc)
      .setTimestamp();

    const onlineList = users
      .filter(u => u.isOnline)
      .map(u =>
        `🟢 **${u.username}** | ${u.ppm.toFixed(2)} PPM | ${u.onlineInstances}/${u.totalUserInstances}`
      ).join("\n") || "Ninguno";

    const offlineList = users
      .filter(u => !u.isOnline)
      .map(u => `🔴 ${u.username}`)
      .join("\n") || "Ninguno";

    embed.addFields(
      { name: "🟢 ONLINE", value: onlineList },
      { name: "🔴 OFFLINE", value: offlineList },
      {
        name: "🌎 GLOBAL",
        value:
          `🔥 PPM ACTUAL: ${totalPPM.toFixed(2)}\n` +
          `📊 Media 12h: ${avgPPM}\n` +
          `📦 Packs: ${totalPacks}\n` +
          `⚙ Instancias: ${totalInstances}`
      }
    );

    const channel = await client.channels.fetch(STATS_CHANNEL_ID);
    const messages = await channel.messages.fetch({ limit: 10 });
    const existing = messages.find(m => m.author.id === client.user.id);

    if (existing) {
      await existing.edit({ embeds: [embed] });
    } else {
      await channel.send({ embeds: [embed] });
    }

    console.log("✅ Panel actualizado correctamente");

  } catch (err) {
    console.log("❌ ERROR GENERAL:", err);
  }
}

/****************************************************
 *              🤖 READY
 ****************************************************/

client.once("ready", async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  await updatePanel();
  setInterval(updatePanel, 60000);
});

client.login(TOKEN);
