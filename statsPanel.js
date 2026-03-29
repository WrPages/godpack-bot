const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const axios = require("axios");

/********************************************************************/
/************************ CONFIG ************************************/
/********************************************************************/

const BOT_TOKEN = process.env.TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!BOT_TOKEN) {
    console.error("❌ TOKEN no definido");
    process.exit(1);
}

if (!GITHUB_TOKEN) {
    console.error("❌ GITHUB_TOKEN no definido");
    process.exit(1);
}

const PANEL_CHANNEL_ID = "1484015417411244082";
const HEARTBEAT_CHANNEL_ID = "1483616146996465735";

const GIST_REGISTERED_USERS = "bb18eda2ea748723d8fe0131dd740b70";
const GIST_ONLINE_USERS = "d9db3a72fed74c496fd6cc830f9ca6e9";

const UPDATE_INTERVAL = 60 * 1000;
const GP_PROBABILITY = 0.0005;

/********************************************************************/
/************************ CLIENT ************************************/
/********************************************************************/

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

/********************************************************************/
/*********************** CACHE **************************************/
/********************************************************************/

let cachedPanelMessage = null;
let ppmHistory = [];

/********************************************************************/
/*********************** SAFE GIST **********************************/
/********************************************************************/

async function getGistSafe(gistId) {
    try {
        const res = await axios.get(`https://api.github.com/gists/${gistId}`, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
        });

        const file = Object.values(res.data.files)[0];
        return JSON.parse(file.content || "{}");

    } catch (err) {
        console.error("Gist error:", err.response?.status || err.message);
        return {};
    }
}

/********************************************************************/
/*********************** HEARTBEAT **********************************/
/********************************************************************/

async function fetchHeartbeatMessagesSafe() {
    try {
        const channel = await client.channels.fetch(HEARTBEAT_CHANNEL_ID);
        if (!channel) return [];

        const messages = await channel.messages.fetch({ limit: 100 });
        return [...messages.values()];

    } catch (err) {
        console.error("Heartbeat error:", err.message);
        return [];
    }
}

/********************************************************************/
/*********************** ULTRA PANEL ********************************/
/********************************************************************/

async function updatePanel() {
    try {

        const registered = await getGistSafe(GIST_REGISTERED_USERS);
        const onlineIds = await getGistSafe(GIST_ONLINE_USERS);
        const heartbeatMessages = await fetchHeartbeatMessagesSafe();

        let totalPPM = 0;
        let totalInstances = 0;

        for (const userId in registered) {

            const user = registered[userId];
            if (!user?.name) continue;

            const message = heartbeatMessages.find(m =>
                m.content.includes(user.name)
            );

            if (!message) continue;

            const ppmMatch = message.content.match(/Avg:\s([\d.]+)/);
            const ppm = ppmMatch ? parseFloat(ppmMatch[1]) : 0;

            totalPPM += ppm;

            if (onlineIds.includes?.(userId)) {
                totalInstances++;
            }
        }

        const packsPerHour = totalPPM * 60;
        const packsPerDay = packsPerHour * 24;

        const expectedGPPerHour = packsPerHour * GP_PROBABILITY;
        const expectedGPPerDay = packsPerDay * GP_PROBABILITY;

        // 📊 Probabilidad acumulada real
        const prob1h = 1 - Math.pow((1 - GP_PROBABILITY), packsPerHour);
        const prob6h = 1 - Math.pow((1 - GP_PROBABILITY), packsPerHour * 6);
        const prob24h = 1 - Math.pow((1 - GP_PROBABILITY), packsPerDay);

        const hoursPerGP = packsPerHour > 0
            ? 1 / (packsPerHour * GP_PROBABILITY)
            : 0;

        /************* HISTORIAL 12H EN MEMORIA *************/

        const now = Date.now();
        ppmHistory.push({ time: now, ppm: totalPPM });

        const twelveHoursAgo = now - (12 * 60 * 60 * 1000);
        ppmHistory = ppmHistory.filter(e => e.time >= twelveHoursAgo);

        const avgPPM12h =
            ppmHistory.reduce((sum, e) => sum + e.ppm, 0) /
            (ppmHistory.length || 1);

        const trend =
            totalPPM > avgPPM12h ? "📈 Trending Up" :
            totalPPM < avgPPM12h ? "📉 Trending Down" :
            "➖ Stable";

        /************* EMBED *************/

        const embed = new EmbedBuilder()
            .setTitle("⚔️ REROLL COMMAND CENTER — ULTRA PRO")
            .setColor(
                totalPPM > avgPPM12h ? 0x00ff88 :
                totalPPM < avgPPM12h ? 0xff4444 :
                0x111111
            )
            .setDescription(
                `🔥 **${totalPPM.toFixed(2)} PPM**\n` +
                `${trend}\n` +
                `12h Avg: ${avgPPM12h.toFixed(2)}`
            )
            .addFields(
                {
                    name: "🧠 SYSTEM LOAD",
                    value:
                        `Active Instances: ${totalInstances}\n` +
                        `Packs/hour: ${packsPerHour.toFixed(0)}\n` +
                        `Packs/day: ${packsPerDay.toFixed(0)}`
                },
                {
                    name: "🎯 GP EXPECTATION (0.05%)",
                    value:
                        `Expected GP/hour: ${expectedGPPerHour.toFixed(2)}\n` +
                        `Expected GP/day: ${expectedGPPerDay.toFixed(2)}`
                },
                {
                    name: "📊 REAL PROBABILITY MODEL",
                    value:
                        `1h chance: ${(prob1h * 100).toFixed(2)}%\n` +
                        `6h chance: ${(prob6h * 100).toFixed(2)}%\n` +
                        `24h chance: ${(prob24h * 100).toFixed(2)}%`
                },
                {
                    name: "⏳ TIME ESTIMATION",
                    value:
                        hoursPerGP > 0
                            ? `Avg time per GP: ${hoursPerGP.toFixed(2)} hours`
                            : "No activity"
                }
            )
            .setFooter({ text: "Ultra Pro Analytics Engine v3" })
            .setTimestamp();

        const channel = await client.channels.fetch(PANEL_CHANNEL_ID);
        if (!channel) return;

        if (!cachedPanelMessage) {
            cachedPanelMessage = await channel.send({ embeds: [embed] });
        } else {
            await cachedPanelMessage.edit({ embeds: [embed] });
        }

    } catch (err) {
        console.error("Ultra panel error:", err.message);
    }
}

/********************************************************************/
/************************ START *************************************/
/********************************************************************/

client.once("ready", () => {
    console.log("✅ Ultra Pro Panel System Online");

    updatePanel();
    setInterval(updatePanel, UPDATE_INTERVAL);
});

client.login(BOT_TOKEN);

/********************************************************************/
/**************** GLOBAL CRASH PROTECTION ***************************/
/********************************************************************/

process.on("unhandledRejection", err => {
    console.error("Unhandled rejection:", err);
});

process.on("uncaughtException", err => {
    console.error("Uncaught exception:", err);
});