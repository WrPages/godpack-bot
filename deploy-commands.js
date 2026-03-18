const { REST, Routes, SlashCommandBuilder } = require('discord.js')

const TOKEN = process.env.TOKEN
const CLIENT_ID = process.env.CLIENT_ID // application id

const commands = [
  new SlashCommandBuilder()
    .setName('registrar')
    .setDescription('Registrar tu ID')
    .addStringOption(option =>
      option.setName('id').setDescription('Tu ID').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('cambiar')
    .setDescription('Cambiar tu ID')
    .addStringOption(option =>
      option.setName('id').setDescription('Nuevo ID').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('online')
    .setDescription('Ponerte online'),

  new SlashCommandBuilder()
    .setName('offline')
    .setDescription('Ponerte offline')
]

const rest = new REST({ version: '10' }).setToken(TOKEN)

async function deploy() {
  try {
    console.log('Registrando comandos...')

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    )

    console.log('Comandos registrados 🔥')
  } catch (error) {
    console.error(error)
  }
}

deploy()
