const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js")

// ✅ CREAR CLIENTE PRIMERO
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
})

// ================= READY =================

client.on("ready", async () => {
  console.log("🔥 BOT FUNCIONA")

  const commands = [
    new SlashCommandBuilder()
      .setName("online")
      .setDescription("test"),
    new SlashCommandBuilder()
      .setName("offline")
      .setDescription("test")
  ].map(c => c.toJSON())

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN)

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands }
  )

  console.log("✅ COMANDOS SUBIDOS")
})

// ================= INTERACTION =================

client.on("interactionCreate", async interaction => {
  console.log("📩 INTERACTION DETECTADA")

  if (!interaction.isChatInputCommand()) return

  if (interaction.commandName === "online") {
    return interaction.reply("🟢 FUNCIONA")
  }

  if (interaction.commandName === "offline") {
    return interaction.reply("🔴 FUNCIONA")
  }
})

// ================= LOGIN =================

client.login(process.env.TOKEN)
