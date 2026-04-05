require("dotenv").config()
const { REST, Routes, SlashCommandBuilder } = require("discord.js")

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
    ),

  new SlashCommandBuilder()
    .setName("schedule_events")
    .setDescription("Daily online/offline scheduler (UTC)")
    .addStringOption(opt =>
      opt.setName("mode")
        .setDescription("Start or Stop")
        .setRequired(true)
        .addChoices(
          { name: "Start Daily Schedule", value: "start" },
          { name: "Stop All Schedules", value: "stop" }
        )
    )
    .addIntegerOption(opt =>
      opt.setName("online_hour").setDescription("Online Hour (UTC 0-23)")
    )
    .addIntegerOption(opt =>
      opt.setName("online_minute").setDescription("Online Minute (0-59)")
    )
    .addIntegerOption(opt =>
      opt.setName("offline_hour").setDescription("Offline Hour (UTC 0-23)")
    )
    .addIntegerOption(opt =>
      opt.setName("offline_minute").setDescription("Offline Minute (0-59)")
    ),

  new SlashCommandBuilder()
    .setName("set_offline")
    .setDescription("Force a user offline")

].map(cmd => cmd.toJSON())

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN)

;(async () => {
  try {
    console.log("🚀 Registrando comandos...")

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    )

    console.log("✅ Comandos registrados correctamente")
  } catch (error) {
    console.error("❌ Error registrando comandos:", error)
  }
})()
