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
      opt.setName("online_hour")
        .setDescription("Online Hour (UTC 0-23)")
    )
    .addIntegerOption(opt =>
      opt.setName("online_minute")
        .setDescription("Online Minute (0-59)")
    )
    .addIntegerOption(opt =>
      opt.setName("offline_hour")
        .setDescription("Offline Hour (UTC 0-23)")
    )
    .addIntegerOption(opt =>
      opt.setName("offline_minute")
        .setDescription("Offline Minute (0-59)")
    ),

  new SlashCommandBuilder()
    .setName("set_offline")
    .setDescription("Force a user offline")

].map(cmd => cmd.toJSON())

// ================= DEBUG COMMANDS =================
console.log("🔍 Validando comandos...")

commands.forEach(cmd => {
  if (!cmd.name) console.log("❌ Comando sin nombre")
  if (!cmd.description) console.log("❌ Comando sin descripción:", cmd.name)

  if (cmd.options) {
    cmd.options.forEach(opt => {
      if (!opt.description) {
        console.log(`❌ Opción sin descripción en comando ${cmd.name}:`, opt.name)
      }
    })
  }
})

console.log(`📦 Total comandos: ${commands.length}`)

// ================= REST =================
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN)

// ================= DEPLOY =================
;(async () => {
  try {
    console.log("🚀 Registrando comandos...")

    // 🔎 DEBUG ENV
    console.log("TOKEN:", process.env.TOKEN ? "OK" : "❌ MISSING")
    console.log("CLIENT_ID:", process.env.CLIENT_ID)
    console.log("GUILD_ID:", process.env.GUILD_ID)

    if (!process.env.TOKEN) throw new Error("TOKEN no definido")
    if (!process.env.CLIENT_ID) throw new Error("CLIENT_ID no definido")
    if (!process.env.GUILD_ID) throw new Error("GUILD_ID no definido")

    console.log("🧹 Borrando comandos antiguos...")

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: [] }
    )

    console.log("✅ Comandos antiguos eliminados")
    console.log("📡 Enviando request a Discord...")

    // ⏱️ TIMEOUT PROTECTOR
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("⏰ Timeout Discord API")), 15000)
    )

    const request = rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    )

    const res = await Promise.race([request, timeout])

    console.log("✅ RESPUESTA DE DISCORD:", res?.length || "OK")
    console.log("✅ Comandos registrados correctamente")

    process.exit(0)

  } catch (error) {
    console.error("❌ ERROR COMPLETO:", error)
    process.exit(1)
  }
})()
