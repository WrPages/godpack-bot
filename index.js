const { Client, GatewayIntentBits } = require("discord.js")

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
})

client.on("ready", () => {
  console.log("🔥 BOT FUNCIONA")
})

client.on("interactionCreate", async interaction => {
  console.log("📩 INTERACTION DETECTADA")

  if (!interaction.isChatInputCommand()) return

  if (interaction.commandName === "online") {
    return interaction.reply("FUNCIONA")
  }
})

client.login(process.env.TOKEN)
