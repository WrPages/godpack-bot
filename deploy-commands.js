const { REST, Routes, SlashCommandBuilder } = require("discord.js")

const TOKEN = "TU_TOKEN"
const CLIENT_ID = "TU_CLIENT_ID"
const GUILD_ID = "TU_GUILD_ID"

const commands = [
  new SlashCommandBuilder()
    .setName("online")
    .setDescription("Set online"),

  new SlashCommandBuilder()
    .setName("offline")
    .setDescription("Set offline")
].map(c => c.toJSON())

const rest = new REST({ version: "10" }).setToken(TOKEN)

async function deploy() {
  try {
    console.log("🚀 Registrando comandos...")

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    )

    console.log("✅ Comandos registrados MANUALMENTE")
  } catch (err) {
    console.error(err)
  }
}

deploy()
