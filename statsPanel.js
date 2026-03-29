/****************************************************
 *              🔥 PANEL ULTRA PRO 🔥
 ****************************************************/

console.log("🚀 Iniciando Stats Panel...");

const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const axios = require("axios");

/****************************************************
 *              🔧 CONFIGURACIÓN
 ****************************************************/

const TOKEN = process.env.TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const HEARTBEAT_CHANNEL_ID = "1483616146996465735";
const STATS_CHANNEL_ID = "1484015417411244082";

const GIST_REGISTROS_ID = "312803a8e6964070593081d99a705d19";
const GIST_ONLINE_IDS_ID = "d9db3a72fed74c496fd6cc830f9ca6e9";
const GIST_GP_HISTORY_ID = "4773653072f4851e91958a333e503de9";
const GIST_PPM_HISTORY_ID = "20527051079d88ec4d414c310cdfdf26";

/****************************************************
 *              VALIDACIONES
 ****************************************************/

if (!TOKEN) {
  console.log("❌ TOKEN no detectado");
  process.exit(1);
}

if (!GITHUB_TOKEN) {
  console.log("❌ GITHUB_TOKEN no detectado");
  process.exit(1);
}

/****************************************************
 *              INICIAR BOT
 ****************************************************/

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  await updatePanel();
  setInterval(updatePanel, 300000); // cada 5 min
});

client.on("error", console.error);
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

/****************************************************
 *              FUNCIONES GIST
 ****************************************************/

async function getGist(id) {
  try {
    const res = await axios.get(`https://api.github.com/gists/${id}`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
    });

    const file = Object.keys(res.data.files)[0];
    const content = res.data.files[file].content;

    return content ? JSON.parse(content) : [];
  } catch (err) {
    console.log("❌ Error leyendo gist:", id);
    console.log(err.response?.data || err.message);
    return [];
  }
}

async function updateGist(id, content) {
  try {
    await axios.patch(
      `https://api.github.com/gists/${id}`,
      {
        files: {
          "data.json": {
            content: JSON.stringify(content, null, 2)
          }
        }
      },
      {
        headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
      }
    );
  } catch (err) {
    console.log("❌ Error actualizando gist:", id);
    console.log(err.response?.data || err.message);
  }
}

/****************************************************
 *      BUSCAR ÚLTIMO MENSAJE HEARTBEAT
 ****************************************************/

async function getUserHeartbeatData(username) {
  try {
    const channel = await client.channels.fetch(HEARTBEAT_CHANNEL_ID);
    const messages = await channel.messages.fetch({ limit: 100 });

    const userMessage = messages.find(m =>
      m.content.includes(username)
    );

    if (!userMessage) return null;

    const content = userMessage.content;

    const ppmMatch = content.match(/pack por minuto[:\s]+([\d.]+)/i);
    const onlineMatch = content.match(/online[:\s]+(.+)/i);
    const offlineMatch = content.match(/offline[:\s]+(.+)/i);
    const packsMatch = content.match(/packs abiertos[:\s]+(\d+)/i);
    const openingMatch = content.match(/opening\s+(\w+)/i);

    return {
      ppm: ppmMatch ? parseFloat(ppmMatch[1]) : 0,
      onlineInstances: onlineMatch
        ? onlineMatch[1].split(",").filter(i => i.trim() !== "main").length
        : 0,
      offlineInstances: offlineMatch
        ? offlineMatch[1].split(",").filter(i => i.trim() !== "main").length
        : 0,
      packs: packsMatch ? parseInt(packsMatch[1]) : 0,
      opening: openingMatch ? openingMatch[1] : ""
    };
  } catch (err) {
    console.log("❌ Error leyendo heartbeat de", username);
    return null;
  }
}

/****************************************************
 *              ACTUALIZAR PANEL
 ****************************************************/

async function updatePanel() {

  console.log("🔄 Actualizando panel...");

  try {

    let registros = await getGist(GIST_REGISTROS_ID);
    let onlineIDs = await getGist(GIST_ONLINE_IDS_ID);
    let gpHistory = await getGist(GIST_GP_HISTORY_ID);
    let ppmHistory = await getGist(GIST_PPM_HISTORY_ID);

    // Normalizar registros
    if (!Array.isArray(registros)) {
      registros = Object.entries(registros).map(([id, data]) => ({
        id,
        username: data.username || data.name || "Unknown"
      }));
    }

    // Normalizar onlineIDs
    if (!Array.isArray(onlineIDs)) {
      onlineIDs = Object.keys(onlineIDs);
    }

    if (!Array.isArray(ppmHistory)) {
      ppmHistory = [];
    }

    const users = [];
    let totalPPM = 0;
    let totalInstances = 0;
    let totalPacks = 0;

    for (const user of registros) {

      const isOnline = onlineIDs.includes(user.id);

      const heartbeatData = isOnline
        ? await getUserHeartbeatData(user.username)
        : null;

      const ppm = heartbeatData?.ppm || 0;
      const onlineInstances = heartbeatData?.onlineInstances || 0;
      const offlineInstances = heartbeatData?.offlineInstances || 0;
      const totalUserInstances = onlineInstances + offlineInstances;
      const packs = heartbeatData?.packs || 0;

      if (isOnline) totalPPM += ppm;
      totalInstances += totalUserInstances;
      totalPacks += packs;

      users.push({
        username: user.username,
        isOnline,
        ppm,
        onlineInstances,
        totalUserInstances,
        packs,
        opening: heartbeatData?.opening || ""
      });
    }

    // MEDIA 12H
    const now = Date.now();
    ppmHistory.push({ time: now, ppm: totalPPM });

    ppmHistory = ppmHistory.filter(p =>
      now - p.time <= 12 * 60 * 60 * 1000
    );

    const avgPPM = ppmHistory.length
      ? (ppmHistory.reduce((a, b) => a + b.ppm, 0) / ppmHistory.length).toFixed(2)
      : "0.00";

    await updateGist(GIST_PPM_HISTORY_ID, ppmHistory);

    /************* EMBED *************/

    const embed = new EmbedBuilder()
      .setTitle("🔥 REROLL STATISTICS PANEL 🔥")
      .setColor(0x00ffcc)
      .setTimestamp();

    const onlineList = users
      .filter(u => u.isOnline)
      .map(u =>
        `🟢 **${u.username}** | ${u.ppm} PPM | ${u.onlineInstances}/${u.totalUserInstances} inst`
      ).join("\n") || "Ninguno";

    const offlineList = users
      .filter(u => !u.isOnline)
      .map(u => `🔴 ${u.username}`)
      .join("\n") || "Ninguno";

    embed.addFields(
      { name: "🟢 Online Users", value: onlineList },
      { name: "🔴 Offline Users", value: offlineList },
      {
        name: "🌎 Global Stats",
        value:
          `🔥 **PPM ACTUAL:** ${totalPPM.toFixed(2)}\n` +
          `📊 Media 12h: ${avgPPM}\n` +
          `📦 Packs Totales: ${totalPacks}\n` +
          `⚙ Instancias Totales: ${totalInstances}\n` +
          `👥 Registrados: ${registros.length}\n` +
          `🟢 Online: ${users.filter(u => u.isOnline).length}`
      }
    );

    if (gpHistory && gpHistory.today !== undefined) {
      embed.addFields({
        name: "💎 GP Stats",
        value:
          `✨ GP Hoy: ${gpHistory.today || 0}\n` +
          `🟢 GP Vivos Hoy: ${gpHistory.aliveToday || 0}\n` +
          `📈 Media últimos días: ${gpHistory.last5Avg || 0}`
      });
    }

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
    console.log("❌ ERROR EN updatePanel:");
    console.log(err);
  }
}

client.login(TOKEN);