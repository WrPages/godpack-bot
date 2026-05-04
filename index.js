
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  MessageFlags
} = require("discord.js")


const { Redis } = require("@upstash/redis")

const gpHandler = require("./gpHandler");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

// ================= CONFIG =================

const TOKEN = process.env.TOKEN

const PANEL_CHANNEL_ID = "1494760619985862676"
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

function onlineKey(group) {
  return `online:${group}`
}

function normalizeRedisIds(ids) {
  if (!Array.isArray(ids)) return []

  return ids
    .map(id => String(id).trim())
    .filter(id => /^\d{16}$/.test(id))
}
function usersKey(group) {
  return `users:${group}`
}

function vipKey(group) {
  return `vip:${group}`
}

function schedulesKey() {
  return "daily_schedules"
}

function panelDataKey() {
  return "panel_data"
}

function activeRolesKey() {
  return "active_roles"
}

function safeJsonParse(value, fallback = {}) {
  try {
    if (!value) return fallback
    if (typeof value === "object") return value
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

// ================= GROUP CONFIG =================

const GROUP_CONFIG = {
  Trainer: {
    label: "Trainer"
  },
  Gym_Leader: {
    label: "Gym Leader"
  },
  Elite_Four: {
    label: "Elite Four"
  }
}




// ================= HELPERS =================

function isChampion(interaction) {
  return interaction.member.roles.cache.some(r => r.name === "Champion");
}

function getGroupLabel(group) {
  const labels = {
    Trainer: "Trainer",
    Gym_Leader: "Gym Leader",
    Elite_Four: "Elite Four"
  };
  return labels[group] || group;
}

function buildGroupOptions() {
  return [
    { label: "Trainer", value: "Trainer" },
    { label: "Gym Leader", value: "Gym_Leader" },
    { label: "Elite Four", value: "Elite_Four" }
  ];
}
function normalizeGroupRoleName(roleName) {
  const map = {
    "Trainer": "Trainer",
    "Gym_Leader": "Gym_Leader",
    "Gym Leader": "Gym_Leader",
    "Elite_Four": "Elite_Four",
    "Elite Four": "Elite_Four"
  };

  return map[roleName] || null;
}

function getMemberGroups(member) {
  return member.roles.cache
    .map(role => normalizeGroupRoleName(role.name))
    .filter(Boolean)
    .filter((group, index, arr) => arr.indexOf(group) === index);
}
function isValidId(id) {
  return /^\d{16}$/.test(String(id).trim())
}

async function getActiveRoles() {
  try {
    const data = await redis.hgetall(activeRolesKey())

    if (!data || typeof data !== "object") {
      return {}
    }

    return data
  } catch (err) {
    console.error("Error loading active roles from Redis:", err)
    return {}
  }
}

async function saveActiveRoles(data) {
  try {
    if (!data || typeof data !== "object") return

    await redis.del(activeRolesKey())

    if (Object.keys(data).length > 0) {
      await redis.hset(activeRolesKey(), data)
    }
  } catch (err) {
    console.error("Error saving active roles to Redis:", err)
  }
}


async function loadSchedules() {
  try {
    const data = await redis.get(schedulesKey())
    return safeJsonParse(data, {})
  } catch (err) {
    console.error("Error loading schedules from Redis:", err)
    return {}
  }
}

async function saveSchedules(data) {
  try {
    await redis.set(schedulesKey(), JSON.stringify(data || {}))
  } catch (err) {
    console.error("Error saving schedules to Redis:", err)
  }
}

async function getUsers(group) {
  try {
    if (!GROUP_CONFIG[group]) {
      console.error("getUsers invalid group:", group)
      return {}
    }

    const data = await redis.hgetall(usersKey(group))

    if (!data || typeof data !== "object") {
      return {}
    }

    const users = {}

    for (const uid in data) {
      users[uid] = safeJsonParse(data[uid], {})
    }

    return users
  } catch (err) {
    console.error(`Error loading users from Redis for ${group}:`, err)
    return {}
  }
}

async function saveUsers(users, group) {
  try {
    if (!GROUP_CONFIG[group]) {
      console.error("saveUsers invalid group:", group)
      return false
    }

    const key = usersKey(group)

    await redis.del(key)

    const payload = {}

    for (const uid in users) {
      payload[uid] = JSON.stringify(users[uid])
    }

    if (Object.keys(payload).length > 0) {
      await redis.hset(key, payload)
    }

    return true
  } catch (err) {
    console.error(`Error saving users to Redis for ${group}:`, err)
    return false
  }
}

async function setOnlineStatus(action, id, group) {
  try {
    id = String(id || "").trim()

    if (!["online", "offline"].includes(action)) {
      console.error("Invalid action:", action)
      return false
    }

    if (!isValidId(id)) {
      console.error("Invalid ID:", id)
      return false
    }

    if (!GROUP_CONFIG[group]) {
      console.error("Invalid group:", group)
      return false
    }

    const key = onlineKey(group)

    if (action === "online") {
      await redis.sadd(key, id)
    }

    if (action === "offline") {
      await redis.srem(key, id)
    }

    return true
  } catch (err) {
    console.error(`setOnlineStatus ${action} error:`, err)
    return false
  }
}

async function getOnlineIDs(group) {
  if (!GROUP_CONFIG[group]) return []

  try {
    const ids = await redis.smembers(onlineKey(group))
    return normalizeRedisIds(ids)
  } catch (err) {
    console.error(`getOnlineIDs Redis error for ${group}:`, err)
    return []
  }
}

async function addVipID(id, group) {
  try {
    id = String(id || "").trim()

    if (!isValidId(id)) {
      console.error("Invalid VIP ID:", id)
      return false
    }

    if (!GROUP_CONFIG[group]) {
      console.error("Invalid VIP group:", group)
      return false
    }

    await redis.sadd(vipKey(group), id)

    console.log(`✅ VIP added to Redis ${group}:`, id)
    return true
  } catch (err) {
    console.error("Error saving VIP to Redis:", err)
    return false
  }
}

// ===== GROUP =====
async function getUserGroup(interaction) {
  const activeRoles = await getActiveRoles();

  const memberGroups = getMemberGroups(interaction.member);

  if (!memberGroups.length) return null;

  const savedRole = activeRoles[interaction.user.id];

  if (savedRole && memberGroups.includes(savedRole)) {
    return savedRole;
  }

  return memberGroups[0];
}
/// panel
async function loadPanelData() {
  try {
    const data = await redis.get(panelDataKey())
    return safeJsonParse(data, {})
  } catch (err) {
    console.error("Error loading panel data from Redis:", err)
    return {}
  }
}

async function savePanelData(data) {
  try {
    await redis.set(panelDataKey(), JSON.stringify(data || {}))
  } catch (err) {
    console.error("Error saving panel data to Redis:", err)
  }
}


// ================= SCHEDULER =================

function startScheduler(){
  setInterval(async () => {
    try {
      const schedules = await loadSchedules()
      const now = new Date()

      const hour = now.getUTCHours()
      const min = now.getUTCMinutes()
      const todayUTC = now.toISOString().slice(0, 10)

      let changed = false

      for (const uid in schedules) {
        const s = schedules[uid]

        if (!s.group || !s.main_id) continue

        if (
          hour === s.online_hour &&
          min === s.online_minute &&
          s.last_online !== todayUTC
        ) {
          const ok = await setOnlineStatus("online", s.main_id, s.group)

          if (ok) {
            s.last_online = todayUTC
            changed = true
            console.log("🟢 Scheduled online:", s.main_id, s.group)
          }
        }

        if (
          hour === s.offline_hour &&
          min === s.offline_minute &&
          s.last_offline !== todayUTC
        ) {
          const ok = await setOnlineStatus("offline", s.main_id, s.group)

          if (ok) {
            s.last_offline = todayUTC
            changed = true
            console.log("🔴 Scheduled offline:", s.main_id, s.group)
          }
        }
      }

      if (changed) await saveSchedules(schedules)

    } catch (err) {
      console.error("Scheduler error:", err)
    }
  }, 60000)
}

// ================= PANEL =================

async function sendPanel(channel){

  const panelData = await loadPanelData()

  const embed = new EmbedBuilder()
    .setTitle("🎮 PANEL CONTROL")
   // .setDescription("Usa botones para controlar todo")

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("register").setLabel("Register").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("add_sec").setLabel("Add Sec").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("change").setLabel("Change").setStyle(ButtonStyle.Secondary)
  )

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("online").setLabel("Online").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("offline").setLabel("Offline").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("online_sec").setLabel("Online Sec").setStyle(ButtonStyle.Success)
  )

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("list").setLabel("List").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("online_list").setLabel("Online List").setStyle(ButtonStyle.Secondary)
  )

  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("schedule").setLabel("Schedule").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("change_role").setLabel("Change Role").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("set_offline").setLabel("Force Offline").setStyle(ButtonStyle.Danger)
  )

  const row5 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("gp").setLabel("Add VIP").setStyle(ButtonStyle.Success)
  )

  const panelPayload = {
    embeds:[embed],
    components:[row1,row2,row3,row4,row5]
  }

  try {

    // 🔁 SI YA EXISTE → EDITAR
    if(panelData.messageId){
      const msg = await channel.messages.fetch(panelData.messageId)
      await msg.edit(panelPayload)
      console.log("♻️ Panel actualizado")
      return
    }

  } catch(err){
    console.log("Panel anterior no encontrado, creando nuevo...")
  }

  // 🆕 SI NO EXISTE → CREAR NUEVO
  const newMsg = await channel.send(panelPayload)

  panelData.messageId = newMsg.id
  await savePanelData(panelData)

  console.log("✅ Panel creado y guardado")
}

// ================= READY =================

client.once("clientReady", async () => {
  try {
    console.log("🔥 Bot listo")

    const ch = await client.channels.fetch(PANEL_CHANNEL_ID)
    await sendPanel(ch)

    startScheduler()
    await gpHandler(client)
  } catch (err) {
    console.error("Ready error:", err)
  }
})

//const { MessageFlags } = require("discord.js");

const OWN_BUTTONS = new Set([
  "register",
  "add_sec",
  "change",
  "online",
  "offline",
  "online_sec",
  "list",
  "online_list",
  "schedule",
  "change_role",
  "set_offline",
  "gp"
]);

const OWN_MODALS = new Set([
  "reg_modal",
  "sec_modal",
  "change_modal",
  "schedule_modal",
  "gp_modal"
]);

const OWN_SELECTS = new Set([
  "role_select",
  "offline_group_select",
  "forced_offline_user_select",
  "gp_group_select"
]);

function isOwnInteraction(interaction) {
  if (interaction.isButton()) {
    return OWN_BUTTONS.has(interaction.customId)
  }

  if (interaction.isModalSubmit()) {
    return OWN_MODALS.has(interaction.customId)
  }

  if (interaction.isStringSelectMenu()) {
    return OWN_SELECTS.has(interaction.customId) || interaction.customId.startsWith("gp_group_select:")
  }

  return false
}

// ================= INTERACTIONS =================
client.on("interactionCreate", async interaction => {
  try {
    if (!isOwnInteraction(interaction)) return

    if (interaction.deferred || interaction.replied) {
      console.warn(
        "Interaction already acknowledged before index handler:",
        interaction.customId,
        interaction.user.id
      )
      return
    }

    // ================= BOTONES =================
    if (interaction.isButton()) {
      const group = await getUserGroup(interaction)
      if (!group) {
        return interaction.reply({
          content: "❌ No group",
          flags: MessageFlags.Ephemeral
        })
      }

      const isModalButton = ["register", "add_sec", "change", "schedule", "gp"].includes(interaction.customId)

      if (!isModalButton) {
        if (interaction.deferred || interaction.replied) {
          console.warn("Duplicate ack prevented in index:", interaction.customId, interaction.user.id)
          return
        }

        console.log("Index handling button:", interaction.customId, "user:", interaction.user.id)
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })
      }

      const config = GROUP_CONFIG[group]

      if (interaction.customId === "register") {
        const modal = new ModalBuilder()
          .setCustomId("reg_modal")
          .setTitle("Register ID")

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("id")
              .setLabel("16 digit ID")
              .setStyle(TextInputStyle.Short)
          )
        )

        return interaction.showModal(modal)
      }

      if (interaction.customId === "add_sec") {
        const modal = new ModalBuilder()
          .setCustomId("sec_modal")
          .setTitle("Add Secondary ID")

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("id")
              .setLabel("16 digit ID")
              .setStyle(TextInputStyle.Short)
          )
        )

        return interaction.showModal(modal)
      }

      if (interaction.customId === "change") {
        const modal = new ModalBuilder()
          .setCustomId("change_modal")
          .setTitle("Change Main ID")

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("id")
              .setLabel("New 16 digit ID")
              .setStyle(TextInputStyle.Short)
          )
        )

        return interaction.showModal(modal)
      }

      if (interaction.customId === "online") {
        const users = await getUsers(group)
        const userData = users[interaction.user.id]

        if (!userData?.main_id) return interaction.editReply("❌ Register first")

const ok = await setOnlineStatus("online", userData.main_id, group)

if (!ok) {
  return interaction.editReply("❌ Could not set online")
}

return interaction.editReply("🟢 ONLINE. It now appears in Online List.")
      }

      if (interaction.customId === "online_sec") {
        const users = await getUsers(group)
        const userData = users[interaction.user.id]

        if (!userData?.sec_id) return interaction.editReply("❌ No secondary ID")

const ok = await setOnlineStatus("online", userData.sec_id, group)

if (!ok) {
  return interaction.editReply("❌ Could not set secondary online")
}

return interaction.editReply("🟢 SEC ONLINE. It now appears in Online List.")
      }

if (interaction.customId === "offline") {
  const users = await getUsers(group)
  const userData = users[interaction.user.id]

  if (!userData) return interaction.editReply("❌ Not registered")

  let okMain = true
  let okSec = true

  if (userData.main_id) {
    okMain = await setOnlineStatus("offline", userData.main_id, group)
  }

  if (userData.sec_id) {
    okSec = await setOnlineStatus("offline", userData.sec_id, group)
  }

  if (!okMain || !okSec) {
    return interaction.editReply("❌ Some IDs could not be set offline")
  }

  return interaction.editReply("🔴 OFFLINE")
}

      if (interaction.customId === "list") {
        const users = await getUsers(group)

        if (Object.keys(users).length === 0) {
          return interaction.editReply("📭 No users")
        }

        let msg = "📋 Users:\n\n"

        for (const uid in users) {
          const u = users[uid]
          msg += `👤 ${u.name} → ${u.main_id}\n`
        }

        return interaction.editReply(msg)
      }

if (interaction.customId === "online_list") {
  const users = await getUsers(group)
  const ids = await getOnlineIDs(group)

  if (!ids.length) return interaction.editReply("⚫ No online")

  let msg = "🟢 Online:\n\n"
  let found = false

  for (const uid in users) {
    const u = users[uid]

    const mainId = String(u.main_id || "").trim()
    const secId = String(u.sec_id || "").trim()

    const mainOnline = mainId && ids.includes(mainId)
    const secOnline = secId && ids.includes(secId)

    if (mainOnline || secOnline) {
      const shownIds = []

      if (mainOnline) shownIds.push(`Main: ${mainId}`)
      if (secOnline) shownIds.push(`Sec: ${secId}`)

      msg += `👤 ${u.name} → ${shownIds.join(" | ")}\n`
      found = true
    }
  }

  if (!found) msg += "⚫ No registered users online\n"

  return interaction.editReply(msg)
}

      if (interaction.customId === "schedule") {
        const modal = new ModalBuilder()
          .setCustomId("schedule_modal")
          .setTitle("Schedule UTC")

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("on")
              .setLabel("Online HH:MM")
              .setStyle(TextInputStyle.Short)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("off")
              .setLabel("Offline HH:MM")
              .setStyle(TextInputStyle.Short)
          )
        )

        return interaction.showModal(modal)
      }

if (interaction.customId === "change_role") {
  const memberGroups = getMemberGroups(interaction.member);

  if (memberGroups.length < 2) {
    return interaction.editReply("❌ You need at least 2 group roles to switch.");
  }

  const currentRole = await getUserGroup(interaction);

  const roles = memberGroups.map(group => ({
    label: getGroupLabel(group),
    value: group
  }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId("role_select")
    .setPlaceholder("Select your active role")
    .addOptions(roles);

  return interaction.editReply({
    content: `Current active role: **${getGroupLabel(currentRole)}**\nSelect your new active role:`,
    components: [new ActionRowBuilder().addComponents(menu)]
  });
}

      if (interaction.customId === "set_offline") {
        if (!isChampion(interaction)) {
          return interaction.editReply("❌ Only Champion can use this button")
        }

        const menu = new StringSelectMenuBuilder()
          .setCustomId("offline_group_select")
          .setPlaceholder("Select group")
          .addOptions(buildGroupOptions())

        return interaction.editReply({
          content: "Select the group where you want to force offline",
          components: [new ActionRowBuilder().addComponents(menu)]
        })
      }

      if (interaction.customId === "gp") {
        if (!isChampion(interaction)) {
          return interaction.reply({
            content: "❌ Only Champion can use this button",
            flags: MessageFlags.Ephemeral
          })
        }

        const modal = new ModalBuilder()
          .setCustomId("gp_modal")
          .setTitle("Add VIP")

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("id")
              .setLabel("VIP ID")
              .setStyle(TextInputStyle.Short)
          )
        )

        return interaction.showModal(modal)
      }
    }

    // ================= MODALES =================
    if (interaction.isModalSubmit()) {
      const group = await getUserGroup(interaction)
      if (!group) {
        return interaction.reply({
          content: "❌ No group",
          flags: MessageFlags.Ephemeral
        })
      }

      const config = GROUP_CONFIG[group]
      const users = await getUsers(group)

      if (interaction.customId === "reg_modal") {
        const id = interaction.fields.getTextInputValue("id").trim()

        if (!isValidId(id)) {
          return interaction.reply({
            content: "❌ ID must be exactly 16 digits",
            flags: MessageFlags.Ephemeral
          })
        }

const oldData = users[interaction.user.id]

users[interaction.user.id] = {
  main_id: id,
  sec_id: oldData?.sec_id || null,
  name: interaction.member.displayName
}

        await saveUsers(users, group)
        return interaction.reply({
          content: "✅ Registered",
          flags: MessageFlags.Ephemeral
        })
      }

      if (interaction.customId === "sec_modal") {
        const id = interaction.fields.getTextInputValue("id").trim()

        if (!isValidId(id)) {
          return interaction.reply({
            content: "❌ ID must be exactly 16 digits",
            flags: MessageFlags.Ephemeral
          })
        }

        if (!users[interaction.user.id]) {
          return interaction.reply({
            content: "❌ Register first",
            flags: MessageFlags.Ephemeral
          })
        }

        users[interaction.user.id].sec_id = id

        await saveUsers(users, group)
        return interaction.reply({
          content: "✅ Secondary added",
          flags: MessageFlags.Ephemeral
        })
      }

      if (interaction.customId === "change_modal") {
        const id = interaction.fields.getTextInputValue("id").trim()

        if (!isValidId(id)) {
          return interaction.reply({
            content: "❌ ID must be exactly 16 digits",
            flags: MessageFlags.Ephemeral
          })
        }

        if (!users[interaction.user.id]) {
          return interaction.reply({
            content: "❌ Register first",
            flags: MessageFlags.Ephemeral
          })
        }

const oldMainId = users[interaction.user.id].main_id

if (oldMainId && oldMainId !== id) {
  await setOnlineStatus("offline", oldMainId, group)
}

users[interaction.user.id].main_id = id

        await saveUsers(users, group)
        return interaction.reply({
          content: "🔄 Updated",
          flags: MessageFlags.Ephemeral
        })
      }

      if (interaction.customId === "schedule_modal") {
        const onRaw = interaction.fields.getTextInputValue("on").trim()
        const offRaw = interaction.fields.getTextInputValue("off").trim()

        if (!/^\d{1,2}:\d{2}$/.test(onRaw) || !/^\d{1,2}:\d{2}$/.test(offRaw)) {
          return interaction.reply({
            content: "❌ Use HH:MM format",
            flags: MessageFlags.Ephemeral
          })
        }

        const [onHour, onMinute] = onRaw.split(":").map(Number)
        const [offHour, offMinute] = offRaw.split(":").map(Number)

        if (
          onHour < 0 || onHour > 23 ||
          offHour < 0 || offHour > 23 ||
          onMinute < 0 || onMinute > 59 ||
          offMinute < 0 || offMinute > 59
        ) {
          return interaction.reply({
            content: "❌ Invalid UTC time",
            flags: MessageFlags.Ephemeral
          })
        }

        if (!users[interaction.user.id]?.main_id) {
          return interaction.reply({
            content: "❌ Register first",
            flags: MessageFlags.Ephemeral
          })
        }

        const schedules = await loadSchedules()

        schedules[interaction.user.id] = {
          group,
          main_id: users[interaction.user.id].main_id,
          online_hour: onHour,
          online_minute: onMinute,
          offline_hour: offHour,
          offline_minute: offMinute
        }

        await saveSchedules(schedules)

        return interaction.reply({
          content: "✅ Schedule saved",
          flags: MessageFlags.Ephemeral
        })
      }

     if (interaction.customId === "gp_modal") {
  if (!isChampion(interaction)) {
    return interaction.reply({
      content: "❌ Only Champion can use this function",
      flags: MessageFlags.Ephemeral
    })
  }

  const id = interaction.fields.getTextInputValue("id").trim()

  if (!isValidId(id)) {
    return interaction.reply({
      content: "❌ ID must be exactly 16 digits",
      flags: MessageFlags.Ephemeral
    })
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`gp_group_select:${id}`)
    .setPlaceholder("Select group")
    .addOptions(buildGroupOptions())

  return interaction.reply({
    content: `Select the group where you want to add VIP ID ${id}`,
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral
  })
}
    }

    // ================= SELECT MENUS =================
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith("gp_group_select:")) {
        if (!isChampion(interaction)) {
          return interaction.update({
            content: "❌ Only Champion can use this function",
            components: []
          })
        }

        const id = interaction.customId.split(":")[1]
        const group = interaction.values[0]

        await addVipID(id, group)

        return interaction.update({
          content: `✅ VIP ID added to ${getGroupLabel(group)}`,
          components: []
        })
      }

      if (interaction.customId === "offline_group_select") {
        if (!isChampion(interaction)) {
          return interaction.update({
            content: "❌ Only Champion can use this function",
            components: []
          })
        }

        const group = interaction.values[0]
        const config = GROUP_CONFIG[group]

        const ids = await getOnlineIDs(group)
        const users = await getUsers(group)

        if (!ids.length) {
          return interaction.update({
            content: `⚫ No users online in ${getGroupLabel(group)}`,
            components: []
          })
        }

        const onlineOptions = []

        for (const uid in users) {
          const u = users[uid]
          const matchedId = ids.find(id => id === u.main_id || id === u.sec_id)

          if (matchedId) {
            onlineOptions.push({
              label: u.name || `User ${uid}`,
              value: `${group}|${matchedId}`,
              description: matchedId === u.main_id ? "Main ID online" : "Secondary ID online"
            })
          }
        }

        if (!onlineOptions.length) {
          const fallbackOptions = ids.slice(0, 25).map(id => ({
            label: id,
            value: `${group}|${id}`
          }))

          const fallbackMenu = new StringSelectMenuBuilder()
            .setCustomId("forced_offline_user_select")
            .setPlaceholder("Select online user")
            .addOptions(fallbackOptions)

          return interaction.update({
            content: `Online users found in ${getGroupLabel(group)} (fallback by ID)`,
            components: [new ActionRowBuilder().addComponents(fallbackMenu)]
          })
        }

        const menu = new StringSelectMenuBuilder()
          .setCustomId("forced_offline_user_select")
          .setPlaceholder("Select online user")
          .addOptions(onlineOptions.slice(0, 25))

        return interaction.update({
          content: `Select the online user to force offline in ${getGroupLabel(group)}`,
          components: [new ActionRowBuilder().addComponents(menu)]
        })
      }

if (interaction.customId === "forced_offline_user_select") {
  if (!isChampion(interaction)) {
    return interaction.update({
      content: "❌ Only Champion can use this function",
      components: []
    })
  }

  const raw = interaction.values[0]
  const [group, id] = raw.split("|")

  const ok = await setOnlineStatus("offline", id, group)

  if (!ok) {
    return interaction.update({
      content: "❌ Could not force this user offline",
      components: []
    })
  }

  return interaction.update({
    content: `🔴 User forced offline in ${getGroupLabel(group)}`,
    components: []
  })
}

if (interaction.customId === "role_select") {
  const selectedRole = interaction.values[0]

  const userGroups = getMemberGroups(interaction.member)

  if (!userGroups.includes(selectedRole)) {
    return interaction.update({
      content: "❌ Invalid role selection",
      components: []
    })
  }

  await redis.hset(activeRolesKey(), {
    [interaction.user.id]: selectedRole
  })

  return interaction.update({
    content: `✅ Active role changed to **${getGroupLabel(selectedRole)}**`,
    components: []
  })
}
    }
  } catch (err) {
    console.error("INDEX interaction error:", err)

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Internal error",
        flags: MessageFlags.Ephemeral
      }).catch(() => {})
    } else {
      await interaction.followUp({
        content: "❌ Internal error",
        flags: MessageFlags.Ephemeral
      }).catch(() => {})
    }
  }
})


  client.on("error", err => {
  console.error("Discord client error:", err);
});

process.on("unhandledRejection", err => {
  console.error("Unhandled rejection:", err);
});

process.on("uncaughtException", err => {
  console.error("Uncaught exception:", err);
});

// ================= START =================

client.login(TOKEN)
