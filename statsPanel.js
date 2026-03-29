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
const GIST_GP_STATS = "4773653072f4851e91958a333e503de9";
const GIST_PPM_HISTORY = "20527051079d88ec4d414c310cdfdf26";

const UPDATE_INTERVAL = 60 * 1000;

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
/*********************** PANEL **************************************/
/********************************************************************/

async function updatePanel() {
    try {
        const registered = await getGistSafe(GIST_REGISTERED_USERS);
        const onlineIds = await getGistSafe(GIST_ONLINE_USERS);
        const gpStats = await getGistSafe(GIST_GP_STATS);

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
        const GP_PROBABILITY = 0.0005;
        const expectedGPPerHour = packsPerHour * GP_PROBABILITY;

        const embed = new EmbedBuilder()
            .setTitle("⚔️ REROLL COMMAND CENTER")
            .setColor(0x111111)
            .setDescription(
                `🔥 **${totalPPM.toFixed(2)} PPM**\n` +
                `Instances: ${totalInstances}\n` +
                `Expected GP/hour: ${expectedGPPerHour.toFixed(2)}`
            )
            .setTimestamp();

        const channel = await client.channels.fetch(PANEL_CHANNEL_ID);
        if (!channel) return;

        await channel.send({ embeds: [embed] });

    } catch (err) {
        console.error("Panel crash prevented:", err.message);
    }
}

/********************************************************************/
/************************ START *************************************/
/********************************************************************/

client.once("ready", () => {
    console.log("✅ Panel system ready");

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