const { REST, Routes, SlashCommandBuilder } = require('discord.js')

const TOKEN = process.env.TOKEN
const CLIENT_ID = process.env.CLIENT_ID // application id

const commands = [
  
new SlashCommandBuilder()
  .setName('gp')
  .setDescription('Add VIP GP ID')
  .addStringOption(option =>
    option.setName('id')
      .setDescription('GP ID')
      .setRequired(true)
  ),
  
  new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register your ID')
    .addStringOption(option =>
      option.setName('id')
        .setDescription('Your ID')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('change')
    .setDescription('Change your ID')
    .addStringOption(option =>
      option.setName('id')
        .setDescription('New ID')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('online')
    .setDescription('Set yourself as online'),

  new SlashCommandBuilder()
    .setName('offline')
    .setDescription('Set yourself as offline'),

  new SlashCommandBuilder()
    .setName('list')
    .setDescription('Show all registered users'),

  new SlashCommandBuilder()
    .setName('online_list')
    .setDescription('Show users currently online')
]

const rest = new REST({ version: '10' }).setToken(TOKEN)

async function deploy() {
  try {
    console.log('Registering commands...')

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    )

    console.log('Commands registered successfully 🔥')
  } catch (error) {
    console.error(error)
  }
}

deploy()
