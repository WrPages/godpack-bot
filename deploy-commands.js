const { REST, Routes, SlashCommandBuilder } = require("discord.js")
require("dotenv").config()

const commands = [

  new SlashCommandBuilder()
    .setName("register")
    .setDescription("Register your main game ID")
    .addStringOption(option =>
      option
        .setName("id")
        .setDescription("Your 16 digit main ID")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("add_sec")
    .setDescription("Register your secondary game ID")
    .addStringOption(option =>
      option
        .setName("id")
        .setDescription("Your 16 digit secondary ID")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("change")
    .setDescription("Change your main game ID")
    .addStringOption(option =>
      option
        .setName("id")
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
      option
        .setName("id")
        .setDescription("16 digit VIP ID")
        .setRequired(true)
    )

].map(command => command.toJSON())

const rest = new REST({ version: "10" }).setToken(process.env.MTQ4MzY4NzM0MzU2NjIyNTUxOQ.G8CAlO.nh1B7i2oMeaWUj8o3HY2_JLsVtHu51_9RRyDNc
)

;(async () => {
  try {

    console.log("🔄 Registering slash commands...")

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID,"1483687343566225519"),
      { body: commands }
    )

    console.log("✅ Slash commands registered successfully!")

  } catch (error) {
    console.error("❌ Error registering commands:", error)
  }
})()
