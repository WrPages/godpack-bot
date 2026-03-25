const { REST, Routes, SlashCommandBuilder } = require("discord.js");
require("dotenv").config();

/*
Asegúrate de tener en tu .env:

TOKEN=TU_NUEVO_TOKEN
CLIENT_ID=TU_APPLICATION_ID
GUILD_ID=TU_SERVER_ID
*/

const commands = [

  new SlashCommandBuilder()
    .setName("register")
    .setDescription("Register your main game ID")
    .addStringOption(option =>
      option.setName("id")
        .setDescription("Your 16 digit main ID")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("add_sec")
    .setDescription("Register your secondary game ID")
    .addStringOption(option =>
      option.setName("id")
        .setDescription("Your 16 digit secondary ID")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("change")
    .setDescription("Change your main game ID")
    .addStringOption(option =>
      option.setName("id")
        .setDescription("New 16 digit ID")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("online")
    .setDescription("Set your main account online"),

  new SlashCommandBuilder()
    .setName("online_sec")
    .setDescription("Set your secondary account online"),

  new SlashCommandBuilder()
    .setName("offline")
    .setDescription("Set your accounts offline"),

  new SlashCommandBuilder()
    .setName("list")
    .setDescription("List registered users"),

  new SlashCommandBuilder()
    .setName("online_list")
    .setDescription("List online users in your group"),

  new SlashCommandBuilder()
    .setName("gp")
    .setDescription("Add VIP ID")
    .addStringOption(option =>
      option.setName("id")
        .setDescription("16 digit VIP ID")
        .setRequired(true)
    )

].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("🔄 Registering slash commands...");

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log("✅ Slash commands registered successfully!");

  } catch (error) {
    console.error("❌ Error registering commands:");
    console.error(error);
  }
})();