const { REST, Routes, SlashCommandBuilder } = require('discord.js')

const TOKEN = process.env.TOKEN
const CLIENT_ID = process.env.CLIENT_ID
const GUILD_ID = process.env.GUILD_ID

const rest = new REST({ version: "10" }).setToken(TOKEN)

// ===== COMANDO DE PRUEBA =====
const commands = [
  new SlashCommandBuilder()
    .setName("test")
    .setDescription("Comando de prueba")
    .toJSON()
]

async function deploy() {
  console.log("🚀 Iniciando deploy de comandos...")

  try {
    const res = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    )

    console.log("✅ Comando registrado correctamente")
    console.log(res)

  } catch (error) {
    console.error("❌ Error registrando:", error)
  }
}

deploy()
