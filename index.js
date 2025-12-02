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

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Register slash commands
  const commands = [
    new SlashCommandBuilder().setName("help").setDescription("Show all commands"),
    new SlashCommandBuilder()
      .setName("prefix")
      .setDescription("Change bot prefix (owner only)")
      .addStringOption(option => option.setName("new").setDescription("New prefix").setRequired(true)),
    new SlashCommandBuilder()
      .setName("aura")
      .setDescription("MXaura commands")
      .addSubcommand(sub => sub.setName("gamble").setDescription("Gamble aura").addIntegerOption(o => o.setName("amount").setRequired(true)))
      .addSubcommand(sub => sub.setName("battle").setDescription("Battle someone").addIntegerOption(o => o.setName("amount").setRequired(true)).addUserOption(o => o.setName("user").setRequired(true)))
      .addSubcommand(sub => sub.setName("accept").setDescription("Accept battle"))
      .addSubcommand(sub => sub.setName("leaderboard").setDescription("Show top aura"))
      .addSubcommand(sub => sub.setName("give").setDescription("Give aura").addIntegerOption(o => o.setName("amount").setRequired(true)).addUserOption(o => o.setName("user").setRequired(true)))
      .addSubcommand(sub => sub.setName("take").setDescription("Take aura").addIntegerOption(o => o.setName("amount").setRequired(true)).addUserOption(o => o.setName("user").setRequired(true)))
      .addSubcommand(sub => sub.setName("reset").setDescription("Reset aura (owner only)").addUserOption(o => o.setName("user").setRequired(true)))
      .addSubcommand(sub => sub.setName("set").setDescription("Set aura (owner only)").addIntegerOption(o => o.setName("amount").setRequired(true)).addUserOption(o => o.setName("user"))),
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

client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;

  const userData = getUserAura(interaction.user.id);

  // ------------------------------
  // /help
  // ------------------------------
  if (interaction.commandName === "help") {
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
    return interaction.reply({ embeds: [embed] });
  }

  // ------------------------------
  // /prefix
  // ------------------------------
  if (interaction.commandName === "prefix") {
    if (interaction.user.id !== "768471167769116712") return interaction.reply("🚫 You don’t have permission to use this command!");
    const newPrefix = interaction.options.getString("new");
    prefix = newPrefix;
    return interaction.reply(`✅ Prefix changed to **${newPrefix}**`);
  }

  // ------------------------------
  // /aura
  // ------------------------------
  if (interaction.commandName === "aura") {
    const sub = interaction.options.getSubcommand();

    // Gamble
    if (sub === "gamble") {
      const amount = interaction.options.getInteger("amount");
      if (userData.aura < amount) return interaction.reply("❌ You don’t have enough aura!");
      const win = Math.random() < 0.5;
      if (win) userData.aura += amount;
      else userData.aura -= amount;
      saveAura();
      return interaction.reply(win ? `🎲 You won! +${amount} aura.` : `💀 You lost! -${amount} aura.`);
    }

    // Battle
    if (sub === "battle") {
      const amount = interaction.options.getInteger("amount");
      const target = interaction.options.getUser("user");
      if (target.bot || target.id === interaction.user.id) return interaction.reply("😅 You can’t battle yourself or bots!");
      const targetData = getUserAura(target.id);
      if (userData.aura < amount || targetData.aura < amount) return interaction.reply("❌ Not enough aura to battle!");
      aura[target.id].pendingBattle = { challenger: interaction.user.id, amount };
      await interaction.reply(`⚔️ ${target}, ${interaction.user.username} challenges you for **${amount} aura!** Type /aura accept to fight.`);
    }

    // Accept
    if (sub === "accept") {
      const pending = aura[interaction.user.id]?.pendingBattle;
      if (!pending) return interaction.reply("❌ No one has challenged you!");
      const challenger = await client.users.fetch(pending.challenger);
      const challengerData = getUserAura(challenger.id);
      const targetData = getUserAura(interaction.user.id);
      const amount = pending.amount;
      delete targetData.pendingBattle;
      const challengerRoll = Math.floor(Math.random() * 100);
      const targetRoll = Math.floor(Math.random() * 100);
      let result = `🎲 ${challenger.username} rolled ${challengerRoll}\n🎲 ${interaction.user.username} rolled ${targetRoll}\n`;
      if (targetRoll > challengerRoll) {
        targetData.aura += amount;
        challengerData.aura -= amount;
        result += `🏆 ${interaction.user.username} wins **${amount} aura!**`;
      } else if (challengerRoll > targetRoll) {
        targetData.aura -= amount;
        challengerData.aura += amount;
        result += `🏆 ${challenger.username} wins **${amount} aura!**`;
      } else result += "🤝 It's a tie!";
      saveAura();
      return interaction.reply(result);
    }

    // Leaderboard
    if (sub === "leaderboard") {
      const sorted = Object.entries(aura).sort((a, b) => b[1].aura - a[1].aura).slice(0, 10);
      const lb = await Promise.all(sorted.map(async ([id, data], i) => {
        const u = await client.users.fetch(id).catch(() => null);
        return `${i + 1}. ${u ? u.username : "Unknown"} — ${data.aura}`;
      }));
      const embed = new EmbedBuilder().setTitle("🏆 MXaura Leaderboard").setDescription(lb.join("\n")).setColor("#9b59b6");
      return interaction.reply({ embeds: [embed] });
    }

    // Give
    if (sub === "give") {
      const amount = interaction.options.getInteger("amount");
      const target = interaction.options.getUser("user");
      if (interaction.user.id !== "768471167769116712" && interaction.user.id !== "1299049965863178424")
        return interaction.reply("🚫 You don’t have permission to use this command!");
      const targetData = getUserAura(target.id);
      targetData.aura += amount;
      saveAura();
      return interaction.reply(`✅ Gave **${amount} aura** to ${target.username}! 🌟`);
    }

    // Take
    if (sub === "take") {
      const amount = interaction.options.getInteger("amount");
      const target = interaction.options.getUser("user");
      if (interaction.user.id !== "768471167769116712" && interaction.user.id !== "1299049965863178424")
        return interaction.reply("🚫 You don’t have permission to use this command!");
      const targetData = getUserAura(target.id);
      targetData.aura -= amount;
      saveAura();
      return interaction.reply(`✅ Took **${amount} aura** from ${target.username}! 🌟`);
    }

    // Reset
    if (sub === "reset") {
      if (interaction.user.id !== "768471167769116712") return interaction.reply("🚫 You don’t have permission to use this command!");
      const target = interaction.options.getUser("user");
      const targetData = getUserAura(target.id);
      targetData.aura = 0;
      saveAura();
      return interaction.reply(`♻️ Reset aura of ${target.username} to 0!`);
    }

    // Set
    if (sub === "set") {
      if (interaction.user.id !== "768471167769116712") return interaction.reply("🚫 You don’t have permission to use this command!");
      const amount = interaction.options.getInteger("amount");
      const target = interaction.options.getUser("user") || interaction.user;
      const targetData = getUserAura(target.id);
      targetData.aura = amount;
      saveAura();
      return interaction.reply(`🔧 Set aura of ${target.username} to ${amount}!`);
    }
  }
});

client.login(process.env.TOKEN);
