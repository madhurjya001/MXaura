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
// PREFIX COMMAND HANDLER (*aura ...)
// ------------------------------
client.on("messageCreate", async message => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();
  const userData = getUserAura(message.author.id);

  if (cmd === "aura") {
    const sub = args.shift()?.toLowerCase();

    if (!sub) return message.reply(`✨ Your aura is **${userData.aura}**`);

    // gamble
    if (sub === "gamble") {
      const amount = parseInt(args[0]);
      if (!amount || amount <= 0) return message.reply("❌ Enter valid amount!");
      if (userData.aura < amount) return message.reply("❌ You don’t have enough aura!");
      const win = Math.random() < 0.5;
      if (win) userData.aura += amount;
      else userData.aura -= amount;
      saveAura();
      return message.reply(win ? `🎲 You won! +${amount} aura.` : `💀 You lost! -${amount} aura.`);
    }

    // battle
    if (sub === "battle") {
      const amount = parseInt(args[0]);
      const target = message.mentions.users.first();
      if (!amount || !target) return message.reply("❌ Usage: *aura battle <amount> @user");
      if (target.bot || target.id === message.author.id) return message.reply("😅 You can’t battle yourself or bots!");
      const targetData = getUserAura(target.id);
      if (userData.aura < amount || targetData.aura < amount) return message.reply("❌ Not enough aura to battle!");
      aura[target.id].pendingBattle = { challenger: message.author.id, amount };
      return message.reply(`⚔️ ${target}, ${message.author.username} challenges you for **${amount} aura!** Type *aura accept to fight.`);
    }

    // accept
    if (sub === "accept") {
      const pending = aura[message.author.id]?.pendingBattle;
      if (!pending) return message.reply("❌ No one has challenged you!");
      const challenger = await client.users.fetch(pending.challenger);
      const challengerData = getUserAura(challenger.id);
      const targetData = getUserAura(message.author.id);
      const amount = pending.amount;
      delete targetData.pendingBattle;
      const challengerRoll = Math.floor(Math.random() * 100);
      const targetRoll = Math.floor(Math.random() * 100);
      let result = `🎲 ${challenger.username} rolled ${challengerRoll}\n🎲 ${message.author.username} rolled ${targetRoll}\n`;
      if (targetRoll > challengerRoll) {
        targetData.aura += amount;
        challengerData.aura -= amount;
        result += `🏆 ${message.author.username} wins **${amount} aura!**`;
      } else if (challengerRoll > targetRoll) {
        targetData.aura -= amount;
        challengerData.aura += amount;
        result += `🏆 ${challenger.username} wins **${amount} aura!**`;
      } else result += "🤝 It's a tie!";
      saveAura();
      return message.reply(result);
    }

    // leaderboard
    if (sub === "leaderboard") {
      const sorted = Object.entries(aura).sort((a, b) => b[1].aura - a[1].aura).slice(0, 10);
      const lb = await Promise.all(sorted.map(async ([id, data], i) => {
        const u = await client.users.fetch(id).catch(() => null);
        return `${i + 1}. ${u ? u.username : "Unknown"} — ${data.aura}`;
      }));
      const embed = new EmbedBuilder().setTitle("🏆 MXaura Leaderboard").setDescription(lb.join("\n")).setColor("#9b59b6");
      return message.reply({ embeds: [embed] });
    }

    // give
    if (sub === "give") {
      const amount = parseInt(args[0]);
      const target = message.mentions.users.first();
      if (!target) return message.reply("❌ Mention a user!");
      if (message.author.id === "1299049965863178424") {
        if (amount < -500 || amount > 500) return message.reply("⚠️ You can only give between -500 and 500 aura!");
      } else if (message.author.id !== "768471167769116712") {
        return message.reply("🚫 You don’t have permission to use this command!");
      }
      const targetData = getUserAura(target.id);
      targetData.aura += amount;
      saveAura();
      return message.reply(`✅ Gave **${amount} aura** to ${target.username}! 🌟`);
    }

    // take
    if (sub === "take") {
      const amount = parseInt(args[0]);
      const target = message.mentions.users.first();
      if (!target) return message.reply("❌ Mention a user!");
      if (message.author.id === "1299049965863178424") {
        if (amount < -500 || amount > 500) return message.reply("⚠️ You can only take between -500 and 500 aura!");
      } else if (message.author.id !== "768471167769116712") {
        return message.reply("🚫 You don’t have permission to use this command!");
      }
      const targetData = getUserAura(target.id);
      targetData.aura -= amount;
      saveAura();
      return message.reply(`✅ Took **${amount} aura** from ${target.username}! 🌟`);
    }

    // reset
    if (sub === "reset") {
      if (message.author.id !== "768471167769116712") return message.reply("🚫 You don’t have permission to use this command!");
      const target = message.mentions.users.first();
      const targetData = getUserAura(target.id);
      targetData.aura = 0;
      saveAura();
      return message.reply(`♻️ Reset aura of ${target.username} to 0!`);
    }

    // set
    if (sub === "set") {
      if (message.author.id !== "768471167769116712") return message.reply("🚫 You don’t have permission to use this command!");
      const amount = parseInt(args[0]);
      const target = message.mentions.users.first() || message.author;
      const targetData = getUserAura(target.id);
      targetData.aura = amount;
      saveAura();
      return message.reply(`🔧 Set aura of ${target.username} to ${amount}!`);
    }
  }
});

// ------------------------------
// Handle slash commands
// ------------------------------
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;
  const userData = getUserAura(interaction.user.id);

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

  if (interaction.commandName === "prefix") {
    if (interaction.user.id !== "768471167769116712") return interaction.reply("🚫 You don’t have permission to use this command!");
    const newPrefix = interaction.options.getString("new");
    prefix = newPrefix;
    return interaction.reply(`✅ Prefix changed to **${newPrefix}**`);
  }

  if (interaction.commandName === "aura") {
    const fakeMsg = {
      content: prefix + "aura " + interaction.options.getSubcommand() + " " + interaction.options.data[0]?.options?.map(x => x.value || "").join(" "),
      author: interaction.user,
      mentions: interaction.options.getUser("user") ? { users: new Map([[interaction.options.getUser("user").id, interaction.options.getUser("user")]]) } : { users: new Map() },
      reply: (msg) => interaction.reply(msg)
    };
    client.emit("messageCreate", fakeMsg);
  }
});

client.login(process.env.TOKEN);
