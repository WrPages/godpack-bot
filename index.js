client.on("ready", async () => {
  console.log("🔥 BOT FUNCIONA")

  const { REST, Routes, SlashCommandBuilder } = require("discord.js")

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
