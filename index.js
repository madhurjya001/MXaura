const express = require("express");
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require("discord.js");
const fs = require("fs");
require("dotenv").config();

const app = express();
app.get("/", (req, res) => res.send("🌌 MXaura bot is online!"));
app.listen(3000, () => console.log("🌐 MXaura web server running!"));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

let prefix = "*";
const DATA_FILE = "auraData.json";
let aura = {};

// Load aura data if exists
if (fs.existsSync(DATA_FILE)) {
  aura = JSON.parse(fs.readFileSync(DATA_FILE));
}

// Save aura data
function saveAura() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(aura, null, 2));
}

// Get or create user's aura (random 50–150)
function getUserAura(id) {
  if (!aura[id]) {
    aura[id] = { aura: Math.floor(Math.random() * 101) + 50 };
  }
  return aura[id];
}

// ✅ Reset aura at 12AM India time
function resetDailyAura() {
  console.log("🔄 Resetting aura data for new day (IST)!");
  for (let user in aura) {
    aura[user].aura = Math.floor(Math.random() * 101) + 50;
    delete aura[user].pendingBattle;
  }
  saveAura();
}

// Convert current UTC time to IST (UTC +5:30)
function getISTDate() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 5.5 * 60 * 60 * 1000);
}

// Check every minute if it’s 12AM IST
setInterval(() => {
  const now = getISTDate();
  if (now.getHours() === 0 && now.getMinutes() === 0) resetDailyAura();
}, 60000);

// ------------------------------
// Ready + Slash command registration
// ------------------------------
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder().setName("help").setDescription("Show all commands"),
    new SlashCommandBuilder()
      .setName("prefix")
      .setDescription("Change bot prefix (owner only)")
      .addStringOption(option => option.setName("new").setDescription("New prefix").setRequired(true)),
    new SlashCommandBuilder()
      .setName("aura")
      .setDescription("MXaura commands")

      // view subcommand so /aura view and slash menu is clear
      .addSubcommand(sub => sub.setName("view").setDescription("Show your aura"))

      .addSubcommand(sub =>
        sub.setName("gamble")
          .setDescription("Gamble aura")
          .addIntegerOption(o => o.setName("amount").setDescription("Amount of aura to gamble").setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName("battle")
          .setDescription("Battle someone")
          .addIntegerOption(o => o.setName("amount").setDescription("Amount of aura to bet").setRequired(true))
          .addUserOption(o => o.setName("user").setDescription("User to battle").setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName("accept")
          .setDescription("Accept a pending battle")
      )
      .addSubcommand(sub =>
        sub.setName("leaderboard")
          .setDescription("Show top aura users")
      )
      .addSubcommand(sub =>
        sub.setName("give")
          .setDescription("Give aura to someone")
          .addIntegerOption(o => o.setName("amount").setDescription("Amount of aura to give (-500 to 500 for your friend)").setRequired(true))
          .addUserOption(o => o.setName("user").setDescription("User to give aura to").setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName("take")
          .setDescription("Take aura from someone")
          .addIntegerOption(o => o.setName("amount").setDescription("Amount of aura to take (-500 to 500 for your friend)").setRequired(true))
          .addUserOption(o => o.setName("user").setDescription("User to take aura from").setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName("reset")
          .setDescription("Reset aura of a user (owner only)")
          .addUserOption(o => o.setName("user").setDescription("User to reset").setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName("set")
          .setDescription("Set aura of a user (owner only)")
          .addIntegerOption(o => o.setName("amount").setDescription("Amount to set").setRequired(true))
          .addUserOption(o => o.setName("user").setDescription("User to set aura for"))
      ),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {
    console.log("🚀 Registering slash commands...");
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("✅ Slash commands registered!");
  } catch (err) {
    console.error(err);
  }
});

// ------------------------------
// Shared command handler (used by both prefix and slash)
// ------------------------------
async function handleCommand(context) {
  // context:
  // { type: "slash"|"msg", source: interaction or message, user, reply(fn), cmd, args, targetUser (optional) }
  const { type, source, user, reply, cmd, args, targetUser } = context;
  const userData = getUserAura(user.id);

  // HELP
  if (cmd === "help") {
    const embed = new EmbedBuilder()
      .setTitle("📜 MXaura Commands")
      .setDescription(`
*aura — show aura  
*aura gamble <amount> — gamble aura  
*aura battle <amount> @user — challenge someone  
*aura accept — accept battle  
*aura leaderboard — show top aura  
💫 Aura resets daily at midnight (India time).`)
      .setColor("#a29bfe");
    return reply({ embeds: [embed] });
  }

  // PREFIX (owner only)
  if (cmd === "prefix") {
    if (user.id !== "768471167769116712") return reply("🚫 You don’t have permission to use this command!");
    const newPrefix = args[0];
    if (!newPrefix) return reply("⚠️ Provide a new prefix!");
    prefix = String(newPrefix);
    return reply(`✅ Prefix changed to **${newPrefix}**`);
  }

  // AURA (cmd === "aura")
  if (cmd === "aura") {
    const sub = args[0]; // may be undefined -> view
    // VIEW (no sub or 'view')
    if (!sub || sub === "view") {
      return reply(`🌟 Your current aura is **${userData.aura}**`);
    }

    // GAMBLE
    if (sub === "gamble") {
      const amount = Number(args[1]);
      if (!amount || isNaN(amount) || amount <= 0) return reply("⚠️ Enter a valid aura amount!");
      if (userData.aura < amount) return reply("❌ You don’t have enough aura!");
      const win = Math.random() < 0.5;
      if (win) userData.aura += amount;
      else userData.aura -= amount;
      saveAura();
      return reply(win ? `🎲 You won! +${amount} aura.` : `💀 You lost! -${amount} aura.`);
    }

    // BATTLE
    if (sub === "battle") {
      // targetUser may be provided (slash) or provided via args/mentions for message
      const amount = Number(args[1]);
      const target = targetUser || (source.mentions && source.mentions.users ? source.mentions.users.first?.() : undefined) || null;
      if (!amount || isNaN(amount) || !target) return reply("⚔️ Usage: *aura battle <amount> @user");
      if (target.bot || target.id === user.id) return reply("😅 You can’t battle yourself or bots!");
      const targetData = getUserAura(target.id);
      if (userData.aura < amount || targetData.aura < amount) return reply("❌ Not enough aura to battle!");
      aura[target.id].pendingBattle = { challenger: user.id, amount };
      saveAura();
      return reply(`⚔️ ${target}, ${user.username} challenges you for **${amount} aura!** Type *aura accept to fight.`);
    }

    // ACCEPT
    if (sub === "accept") {
      const pending = aura[user.id]?.pendingBattle;
      if (!pending) return reply("❌ No one has challenged you!");
      const challenger = await client.users.fetch(pending.challenger);
      const challengerData = getUserAura(challenger.id);
      const targetData = getUserAura(user.id);
      const amount = pending.amount;
      delete targetData.pendingBattle;
      const challengerRoll = Math.floor(Math.random() * 100);
      const targetRoll = Math.floor(Math.random() * 100);
      let result = `🎲 ${challenger.username} rolled ${challengerRoll}\n🎲 ${user.username} rolled ${targetRoll}\n`;
      if (targetRoll > challengerRoll) {
        targetData.aura += amount;
        challengerData.aura -= amount;
        result += `🏆 ${user.username} wins **${amount} aura!**`;
      } else if (challengerRoll > targetRoll) {
        targetData.aura -= amount;
        challengerData.aura += amount;
        result += `🏆 ${challenger.username} wins **${amount} aura!**`;
      } else result += "🤝 It's a tie!";
      saveAura();
      return reply(result);
    }

    // LEADERBOARD
    if (sub === "leaderboard") {
      const sorted = Object.entries(aura).sort((a, b) => b[1].aura - a[1].aura).slice(0, 10);
      const lb = await Promise.all(sorted.map(async ([id, data], i) => {
        const u = await client.users.fetch(id).catch(() => null);
        return `${i + 1}. ${u ? u.username : "Unknown"} — ${data.aura}`;
      }));
      const embed = new EmbedBuilder().setTitle("🏆 MXaura Leaderboard").setDescription(lb.join("\n")).setColor("#9b59b6");
      return reply({ embeds: [embed] });
    }

    // GIVE
    if (sub === "give") {
      const amount = Number(args[1]);
      const target = targetUser || (source.mentions && source.mentions.users ? source.mentions.users.first?.() : undefined) || null;
      if (!target) return reply("❌ Mention a user!");
      if (user.id === "1299049965863178424") {
        if (amount < -500 || amount > 500) return reply("⚠️ You can only give between -500 and 500 aura!");
      } else if (user.id !== "768471167769116712") {
        return reply("🚫 You don’t have permission to use this command!");
      }
      const targetData = getUserAura(target.id);
      targetData.aura += amount;
      saveAura();
      return reply(`✅ Gave **${amount} aura** to ${target.username}! 🌟`);
    }

    // TAKE
    if (sub === "take") {
      const amount = Number(args[1]);
      const target = targetUser || (source.mentions && source.mentions.users ? source.mentions.users.first?.() : undefined) || null;
      if (!target) return reply("❌ Mention a user!");
      if (user.id === "1299049965863178424") {
        if (amount < -500 || amount > 500) return reply("⚠️ You can only take between -500 and 500 aura!");
      } else if (user.id !== "768471167769116712") {
        return reply("🚫 You don’t have permission to use this command!");
      }
      const targetData = getUserAura(target.id);
      targetData.aura -= amount;
      saveAura();
      return reply(`✅ Took **${amount} aura** from ${target.username}! 🌟`);
    }

    // RESET
    if (sub === "reset") {
      if (user.id !== "768471167769116712") return reply("🚫 You don’t have permission to use this command!");
      const target = targetUser || (source.mentions && source.mentions.users ? source.mentions.users.first?.() : undefined) || null;
      if (!target) return reply("❌ Mention a user!");
      const targetData = getUserAura(target.id);
      targetData.aura = 0;
      saveAura();
      return reply(`♻️ Reset aura of ${target.username} to 0!`);
    }

    // SET
    if (sub === "set") {
      if (user.id !== "768471167769116712") return reply("🚫 You don’t have permission to use this command!");
      const amount = Number(args[1]);
      const target = targetUser || (source.mentions && source.mentions.users ? source.mentions.users.first?.() : undefined) || user;
      const targetData = getUserAura(target.id);
      targetData.aura = amount;
      saveAura();
      return reply(`🔧 Set aura of ${target.username} to ${amount}!`);
    }

    // Unknown sub
    return reply("❌ Unknown aura subcommand.");
  }

  // Unknown command
  return reply("❌ Unknown command.");
}

// ------------------------------
// Message (prefix) handler
// ------------------------------
client.on("messageCreate", async message => {
  if (message.author.bot) return;

  // ensure prefix variable works dynamically
  if (!message.content.startsWith(prefix)) return;

  const body = message.content.slice(prefix.length).trim();
  if (!body) return;

  const parts = body.split(/ +/);
  const cmd = parts.shift().toLowerCase();
  const args = parts;

  // helper reply that mirrors same behavior as interaction reply
  const replyFn = (payload) => {
    // message.reply expects content or object
    return message.reply(payload);
  };

  // for mentions, provide a function-like object for handler to fetch mentions
  const context = {
    type: "msg",
    source: message,
    user: message.author,
    reply: replyFn,
    cmd,
    args,
    targetUser: null
  };

  // If args include a mention, set targetUser for convenience
  const mentionUser = message.mentions.users.first();
  if (mentionUser) context.targetUser = mentionUser;

  // run shared handler
  try {
    await handleCommand(context);
  } catch (e) {
    console.error("Error handling prefix command:", e);
    message.reply("❌ An error occurred.");
  }
});

// ------------------------------
// Interaction (slash) handler
// ------------------------------
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;

  const replyFn = (payload) => {
    // ensure we return appropriately (ephemeral not used)
    if (interaction.replied || interaction.deferred) return interaction.followUp(payload).catch(()=>{});
    return interaction.reply(payload).catch(()=>{});
  };

  // Build args array: first element is subcommand (or undefined -> view)
  let args = [];
  let targetUser = null;
  // try get subcommand; wrap in try because getSubcommand throws if none
  let subName = null;
  try {
    subName = interaction.options.getSubcommand();
  } catch (e) {
    subName = null;
  }

  if (subName) {
    args.push(subName);
    // collect known options in order for our handler (amount then user)
    const amount = interaction.options.getInteger("amount");
    const userOption = interaction.options.getUser("user");
    if (amount !== null && amount !== undefined) args.push(String(amount));
    if (userOption) { args.push(`<@${userOption.id}>`); targetUser = userOption; }
  }

  const context = {
    type: "slash",
    source: interaction,
    user: interaction.user,
    reply: replyFn,
    cmd: interaction.commandName,
    args,
    targetUser
  };

  try {
    await handleCommand(context);
  } catch (e) {
    console.error("Error handling slash command:", e);
    replyFn("❌ An error occurred.");
  }
});

client.login(process.env.TOKEN);
