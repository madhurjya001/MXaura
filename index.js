const express = require("express");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const fs = require("fs");
require("dotenv").config(); // load TOKEN from .env

const app = express();
app.get("/", (req, res) => res.send("🌌 MXaura bot is online!"));
app.listen(3000, () => console.log("🌐 MXaura web server running!"));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const prefix = "*";
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
    aura[user].aura = Math.floor(Math.random() * 101) + 50; // random 50–150
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

client.on("ready", () => console.log(`✅ Logged in as ${client.user.tag}`));

client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith(prefix) || msg.author.bot) return;
  const args = msg.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const user = msg.author;
  const userData = getUserAura(user.id);

  // 🌌 Aura Commands
  if (command === "aura") {
    // Gamble command
    if (args[0] === "gamble") {
      const amount = parseInt(args[1]);
      if (isNaN(amount) || amount <= 0) return msg.reply("⚠️ Enter a valid aura amount!");
      if (userData.aura < amount) return msg.reply("❌ You don’t have enough aura!");

      const win = Math.random() < 0.5;
      if (win) userData.aura += amount;
      else userData.aura -= amount;

      saveAura();
      return msg.reply(win ? `🎲 You won! +${amount} aura.` : `💀 You lost! -${amount} aura.`);
    }

    // Battle command
    if (args[0] === "battle") {
      const amount = parseInt(args[1]);
      const target = msg.mentions.users.first();
      if (!amount || !target) return msg.reply("⚔️ Usage: *aura battle <amount> @user");
      if (target.bot || target.id === user.id) return msg.reply("😅 You can’t battle yourself or bots!");

      const targetData = getUserAura(target.id);
      if (userData.aura < amount || targetData.aura < amount) return msg.reply("❌ Not enough aura to battle!");

      msg.channel.send(`⚔️ ${target}, ${user.username} challenges you for **${amount} aura!** Type *aura accept to fight.`);
      aura[target.id].pendingBattle = { challenger: user.id, amount };
      saveAura();
      return;
    }

    // Accept battle
    if (args[0] === "accept") {
      const pending = aura[user.id]?.pendingBattle;
      if (!pending) return msg.reply("❌ No one has challenged you!");

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
      return msg.channel.send(result);
    }

    // Leaderboard
    if (args[0] === "leaderboard") {
      const sorted = Object.entries(aura).sort((a, b) => b[1].aura - a[1].aura).slice(0, 10);
      const lb = await Promise.all(sorted.map(async ([id, data], i) => {
        const u = await client.users.fetch(id).catch(() => null);
        return `${i + 1}. ${u ? u.username : "Unknown"} — ${data.aura}`;
      }));
      const embed = new EmbedBuilder()
        .setTitle("🏆 MXaura Leaderboard")
        .setDescription(lb.join("\n"))
        .setColor("#9b59b6");
      return msg.channel.send({ embeds: [embed] });
    }

    // 💎 Give command (Only you can use this)
    if (args[0] === "give") {
      if (msg.author.id !== "768471167769116712") return msg.reply("🚫 You don’t have permission to use this command!");
      const amount = parseInt(args[1]);
      const target = msg.mentions.users.first();
      if (!amount || !target) return msg.reply("✨ Usage: *aura give <amount> @user");

      const targetData = getUserAura(target.id);
      targetData.aura += amount;
      saveAura();

      return msg.reply(`✅ Gave **${amount} aura** to ${target.username}! 🌟`);
    }

    // Default aura view
    return msg.reply(`🌌 Your aura: **${userData.aura}**`);
  }

  // Help command
  if (command === "help") {
    const embed = new EmbedBuilder()
      .setTitle("📜 MXaura Commands")
      .setDescription(`
*aura — show aura  
*aura gamble <amount> — gamble aura  
*aura battle <amount> @user — challenge someone  
*aura accept — accept battle  
*aura leaderboard — show top aura  
*aura give <amount> @user — (only special access)  
💫 Aura resets daily at midnight (India time).`)
      .setColor("#a29bfe");
    msg.channel.send({ embeds: [embed] });
  }
});

client.login(process.env.TOKEN);
