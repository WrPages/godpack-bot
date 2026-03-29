/****************************************************
 *              🔥 PANEL ULTRA PRO 🔥
 *   Sistema avanzado de estadísticas de reroll
 ****************************************************/

const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder 
} = require("discord.js");

const axios = require("axios");

/****************************************************
 *              🔧 VARIABLES CONFIGURABLES
 ****************************************************/

// === DISCORD ===
const TOKEN = process.env.TOKEN;
const HEARTBEAT_CHANNEL_ID = "1483616146996465735";
const STATS_CHANNEL_ID = "1484015417411244082";

// === GISTS ===
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const GIST_REGISTROS_ID = "312803a8e6964070593081d99a705d19";
const GIST_ONLINE_IDS_ID = "d9db3a72fed74c496fd6cc830f9ca6e9";
const GIST_GP_HISTORY_ID = "4773653072f4851e91958a333e503de9";
const GIST_PPM_HISTORY_ID = "20527051079d88ec4d414c310cdfdf26";
const GIST_PANEL_CACHE_ID = "0862a53d1422c14e50a057fbd682b910";

/****************************************************
 *              🤖 INICIAR BOT
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
  updatePanel();
  setInterval(updatePanel, 5 * 60 * 1000); // Actualiza cada 5 min
});

/****************************************************
 *              📡 FUNCIONES GIST
 ****************************************************/

async function getGist(id) {
  const res = await axios.get(`https://api.github.com/gists/${id}`, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
  });

  const file = Object.keys(res.data.files)[0];
  return JSON.parse(res.data.files[file].content);
}

async function updateGist(id, content) {
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
}

/****************************************************
 *      🔎 BUSCAR ÚLTIMO MENSAJE DE USUARIO
 ****************************************************/

async function getUserHeartbeatData(username) {
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
  const timeMatch = content.match(/tiempo[:\s]+(.+)/i);
  const openingMatch = content.match(/opening\s+(\w+)/i);

  return {
    ppm: ppmMatch ? parseFloat(ppmMatch[1]) : 0,
    onlineInstances: onlineMatch ? onlineMatch[1].split(",").filter(i => i !== "main").length : 0,
    offlineInstances: offlineMatch ? offlineMatch[1].split(",").filter(i => i !== "main").length : 0,
    packs: packsMatch ? parseInt(packsMatch[1]) : 0,
    time: timeMatch ? timeMatch[1] : "N/A",
    opening: openingMatch ? openingMatch[1] : ""
  };
}

/****************************************************
 *          📊 ACTUALIZAR PANEL COMPLETO
 ****************************************************/

async function updatePanel() {

  console.log("🔄 Actualizando panel...");

  const registros = await getGist(GIST_REGISTROS_ID);
  const onlineIDs = await getGist(GIST_ONLINE_IDS_ID);
  const gpHistory = await getGist(GIST_GP_HISTORY_ID);
  let ppmHistory = await getGist(GIST_PPM_HISTORY_ID);

  const users = [];
  let totalPPM = 0;
  let totalInstances = 0;
  let totalPacks = 0;

  /****************************************************
   *      👤 PROCESAR USUARIOS ONLINE/OFFLINE
   ****************************************************/

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
      time: heartbeatData?.time || "Offline",
      opening: heartbeatData?.opening || ""
    });
  }

  /****************************************************
   *      📈 MEDIA PPM 12 HORAS
   ****************************************************/

  const now = Date.now();

  ppmHistory.push({ time: now, ppm: totalPPM });

  ppmHistory = ppmHistory.filter(p =>
    now - p.time <= 12 * 60 * 60 * 1000
  );

  const avgPPM = (
    ppmHistory.reduce((a, b) => a + b.ppm, 0) /
    ppmHistory.length
  ).toFixed(2);

  await updateGist(GIST_PPM_HISTORY_ID, ppmHistory);

  /****************************************************
   *              📊 CONSTRUIR EMBED
   ****************************************************/

  const embed = new EmbedBuilder()
    .setTitle("🔥 REROLL STATISTICS PANEL 🔥")
    .setColor(0x00ffcc)
    .setTimestamp();

  // === USUARIOS ONLINE ===
  const onlineList = users
    .filter(u => u.isOnline)
    .map(u =>
      `🟢 **${u.username}** | ${u.ppm} PPM | ${u.onlineInstances}/${u.totalUserInstances} inst | ${u.packs} packs | ${u.opening}`
    ).join("\n") || "Ninguno";

  embed.addFields({
    name: "🟢 Online Users",
    value: onlineList
  });

  // === OFFLINE ===
  const offlineList = users
    .filter(u => !u.isOnline)
    .map(u => `🔴 ${u.username}`)
    .join("\n") || "Ninguno";

  embed.addFields({
    name: "🔴 Offline Users",
    value: offlineList
  });

  // === GLOBAL ===
  embed.addFields({
    name: "🌎 GLOBAL STATS",
    value:
      `🔥 **PPM ACTUAL:** ${totalPPM.toFixed(2)}\n` +
      `📊 Media 12h: ${avgPPM}\n` +
      `📦 Packs abiertos: ${totalPacks}\n` +
      `⚙ Instancias totales: ${totalInstances}\n` +
      `👥 Registrados: ${registros.length}\n` +
      `🟢 Online: ${users.filter(u => u.isOnline).length}`
  });

  // === GP SECTION ===
  embed.addFields({
    name: "💎 GP STATS",
    value:
      `✨ GP Hoy: ${gpHistory.today}\n` +
      `🟢 GP Vivos Hoy: ${gpHistory.aliveToday}\n` +
      `📈 Media últimos días: ${gpHistory.last5Avg}`
  });

  /****************************************************
   *          📨 ENVIAR O EDITAR MENSAJE
   ****************************************************/

  const channel = await client.channels.fetch(STATS_CHANNEL_ID);
  const messages = await channel.messages.fetch({ limit: 10 });
  const existing = messages.find(m => m.author.id === client.user.id);

  if (existing) {
    await existing.edit({ embeds: [embed] });
  } else {
    await channel.send({ embeds: [embed] });
  }

  console.log("✅ Panel actualizado correctamente");
}

client.login(TOKEN);
