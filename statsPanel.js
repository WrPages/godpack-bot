/********************************************************************/
/********************* ⚙️ VARIABLES CONFIGURABLES *******************/
/********************************************************************/

const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder 
} = require("discord.js");

const axios = require("axios");

// ====== DISCORD ======
const BOT_TOKEN = process.env.TOKEN;
const PANEL_CHANNEL_ID = "1484015417411244082";
const HEARTBEAT_CHANNEL_ID = "1483616146996465735;

// ====== GITHUB ======
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const GIST_REGISTERED_USERS = "bb18eda2ea748723d8fe0131dd740b70";
const GIST_ONLINE_USERS = "d9db3a72fed74c496fd6cc830f9ca6e9";
const GIST_GP_STATS = "4773653072f4851e91958a333e503de9";
const GIST_PPM_HISTORY = "20527051079d88ec4d414c310cdfdf26";
const GIST_PANEL_CACHE = "0862a53d1422c14e50a057fbd682b910";

// ====== CONFIG ======
const UPDATE_INTERVAL = 60 * 1000; // 1 minuto
const PPM_HISTORY_INTERVAL = 30 * 60 * 1000; // 30 minutos


/********************************************************************/
/********************* 🚀 CLIENTE DISCORD ***************************/
/********************************************************************/

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});


/********************************************************************/
/********************* 📦 FUNCIONES GIST ****************************/
/********************************************************************/

async function getGist(gistId) {
    const res = await axios.get(`https://api.github.com/gists/${gistId}`, {
        headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
    });

    const file = Object.values(res.data.files)[0];
    return JSON.parse(file.content);
}

async function updateGist(gistId, content) {
    const fileName = "data.json";

    await axios.patch(
        `https://api.github.com/gists/${gistId}`,
        {
            files: {
                [fileName]: {
                    content: JSON.stringify(content, null, 2)
                }
            }
        },
        {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
        }
    );
}


/********************************************************************/
/********************* 📊 OBTENER DATOS *****************************/
/********************************************************************/

async function fetchHeartbeatMessages() {
    const channel = await client.channels.fetch(HEARTBEAT_CHANNEL_ID);
    let messages = [];
    let lastId;

    while (messages.length < 200) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const fetched = await channel.messages.fetch(options);
        if (!fetched.size) break;

        messages.push(...fetched.values());
        lastId = fetched.last().id;
    }

    return messages;
}


/********************************************************************/
/********************* 👤 PROCESAR USUARIOS *************************/
/********************************************************************/

function parseUserStatsFromMessage(messageContent) {

    const ppmMatch = messageContent.match(/Avg:\s([\d.]+)\spacks\/min/);
    const packsMatch = messageContent.match(/Packs:\s(\d+)/);
    const timeMatch = messageContent.match(/Time:\s(\d+)m/);
    const openingMatch = messageContent.match(/Opening:\s(.+)/);

    const onlineMatch = messageContent.match(/Online:\s(.+)/);
    const offlineMatch = messageContent.match(/Offline:\s(.+)/);

    const countInstances = (str) => {
        if (!str) return 0;
        return str
            .split(",")
            .map(x => x.trim())
            .filter(x => x !== "Main" && x !== "none")
            .length;
    };

    const totalInstances =
        countInstances(onlineMatch?.[1] || "") +
        countInstances(offlineMatch?.[1] || "");

    const onlineInstances = countInstances(onlineMatch?.[1] || "");

    return {
        ppm: ppmMatch ? parseFloat(ppmMatch[1]) : 0,
        packs: packsMatch ? parseInt(packsMatch[1]) : 0,
        time: timeMatch ? parseInt(timeMatch[1]) : 0,
        opening: openingMatch ? openingMatch[1].trim() : "",
        totalInstances,
        onlineInstances
    };
}


/********************************************************************/
/********************* 🌍 CALCULOS GLOBALES *************************/
/********************************************************************/

function calculateGlobalStats(usersStats) {

    let totalPPM = 0;
    let totalPacks = 0;
    let totalInstances = 0;

    usersStats.forEach(u => {
        totalPPM += u.ppm;
        totalPacks += u.packs;
        totalInstances += u.onlineInstances;
    });

    const packsPerHour = totalPPM * 60;
    const packsPerDay = totalPPM * 60 * 24;

    const GP_PROBABILITY = 0.0005;

    const expectedGPPerHour = packsPerHour * GP_PROBABILITY;
    const expectedGPPerDay = packsPerDay * GP_PROBABILITY;

    const avgPacksPerGP = 1 / GP_PROBABILITY;

    return {
        totalPPM,
        totalPacks,
        totalInstances,
        packsPerHour,
        packsPerDay,
        expectedGPPerHour,
        expectedGPPerDay,
        avgPacksPerGP
    };
}


/********************************************************************/
/********************* 📈 HISTORIAL PPM 12H *************************/
/********************************************************************/

async function updatePPMHistory(currentPPM) {

    const data = await getGist(GIST_PPM_HISTORY);

    const now = Date.now();

    data.history.push({
        timestamp: now,
        ppm: currentPPM
    });

    // Mantener solo últimas 12h
    const twelveHoursAgo = now - (12 * 60 * 60 * 1000);

    data.history = data.history.filter(
        entry => entry.timestamp >= twelveHoursAgo
    );

    await updateGist(GIST_PPM_HISTORY, data);

    const avg =
        data.history.reduce((sum, e) => sum + e.ppm, 0) /
        data.history.length;

    return avg;
}


/********************************************************************/
/********************* 🧠 CONSTRUIR PANEL ***************************/
/********************************************************************/

function buildPanelEmbed(
    onlineUsers,
    offlineUsers,
    globalStats,
    avgPPM12h,
    gpStats
) {

    const trend =
        globalStats.totalPPM > avgPPM12h
            ? "📈 Trending Up"
            : globalStats.totalPPM < avgPPM12h
            ? "📉 Trending Down"
            : "➖ Stable";

    const embed = new EmbedBuilder()
        .setTitle("⚔️ REROLL COMMAND CENTER")
        .setColor(0x111111)
        .setDescription(
            `# 🔥 **${globalStats.totalPPM.toFixed(2)} PPM**\n` +
            `### ${trend}\n` +
            `12h Avg: ${avgPPM12h.toFixed(2)} PPM`
        )
        .setFooter({ text: "Ultra Pro Analytics Engine v2" })
        .setTimestamp();

    /**************** ONLINE USERS ****************/

    embed.addFields({
        name: "🟢 ACTIVE REROLLERS",
        value: onlineUsers.length
            ? onlineUsers.join("\n")
            : "None",
        inline: false
    });

    embed.addFields({
        name: "🔴 OFFLINE REROLLERS",
        value: offlineUsers.length
            ? offlineUsers.join("\n")
            : "None",
        inline: false
    });

    /**************** GLOBAL PERFORMANCE ****************/

    embed.addFields({
        name: "📊 GLOBAL PERFORMANCE",
        value:
            `Instances: ${globalStats.totalInstances}\n` +
            `Packs/hour: ${globalStats.packsPerHour.toFixed(0)}\n` +
            `Packs/day: ${globalStats.packsPerDay.toFixed(0)}\n` +
            `Total Packs: ${globalStats.totalPacks}`,
        inline: false
    });

    /**************** GP ESTIMATOR ****************/

    embed.addFields({
        name: "🎯 GP PROBABILITY MODEL (0.05%)",
        value:
            `Expected GP/hour: **${globalStats.expectedGPPerHour.toFixed(2)}**\n` +
            `Expected GP/day: **${globalStats.expectedGPPerDay.toFixed(2)}**\n` +
            `Avg Packs per GP: **${globalStats.avgPacksPerGP}**`,
        inline: false
    });

    /**************** REAL GP DATA ****************/

    const gpEfficiency =
        globalStats.expectedGPPerDay > 0
            ? (gpStats.daily.gp / globalStats.expectedGPPerDay) * 100
            : 0;

    embed.addFields({
        name: "🏆 TODAY GP STATS",
        value:
            `GP Today: ${gpStats.daily.gp}\n` +
            `Alive Today: ${gpStats.daily.alive}\n` +
            `Efficiency vs Expected: ${gpEfficiency.toFixed(1)}%`,
        inline: false
    });

    return embed;
}


/********************************************************************/
/********************* 🚀 ACTUALIZAR PANEL **************************/
/********************************************************************/

async function updatePanel() {

    const registered = await getGist(GIST_REGISTERED_USERS);
    const onlineIds = await getGist(GIST_ONLINE_USERS);
    const gpStats = await getGist(GIST_GP_STATS);

    const heartbeatMessages = await fetchHeartbeatMessages();

    const onlineUsersDisplay = [];
    const offlineUsersDisplay = [];
    const processedUsers = [];

    for (const userId in registered) {

        const user = registered[userId];
        const isOnline = onlineIds.includes(userId);

        const message = heartbeatMessages.find(m =>
            m.content.includes(user.name)
        );

        if (!message) continue;

        const stats = parseUserStatsFromMessage(message.content);

        const userLine =
            `**${user.name}** | ${stats.ppm} ppm | ` +
            `${stats.onlineInstances}/${stats.totalInstances} inst | ` +
            `${stats.packs} packs | ${stats.time}m`;

        if (isOnline) {
            onlineUsersDisplay.push(userLine);
            processedUsers.push(stats);
        } else {
            offlineUsersDisplay.push(userLine);
        }
    }

    const globalStats = calculateGlobalStats(processedUsers);
    const avgPPM12h = await updatePPMHistory(globalStats.totalPPM);

    const embed = buildPanelEmbed(
        onlineUsersDisplay,
        offlineUsersDisplay,
        globalStats,
        avgPPM12h,
        gpStats
    );

    const channel = await client.channels.fetch(PANEL_CHANNEL_ID);
    await channel.send({ embeds: [embed] });

    await updateGist(GIST_PANEL_CACHE, {
        lastUpdate: Date.now(),
        globalStats
    });
}


/********************************************************************/
/********************* ⏱ AUTO LOOP *********************************/
/********************************************************************/

client.once("ready", () => {
    console.log("Panel system ready");

    updatePanel();
    setInterval(updatePanel, UPDATE_INTERVAL);
});

client.login(BOT_TOKEN);