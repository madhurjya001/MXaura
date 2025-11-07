const express = require("express");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const fs = require("fs");

const app = express();
app.get("/", (req, res) => res.send("🌌 MXaura bot is online!"));
app.listen(3000, () => console.log("🌐 MXaura web server running!"));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const prefix = "*";
const DATA_FILE = "auraData.json";
let aura = {};

if (fs.existsSync(DATA_FILE)) {
  aura = JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveAura() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(aura, null, 2));
}

function resetDailyAura() {
  console.log("🔄 Resetting aura data for new day!");
  for (let user in aura) aura[user].aura = 100;
  saveAura();
}

setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) resetDailyAura();
}, 60000);

function getUserAura(id) {
  if (!aura[id]) aura[id] = { aura: 100 };
  return aura[id];
}

client.on("ready", () => console.log(`✅ Logged in as ${client.user.tag}`));

client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith(prefix) || msg.author.bot) return;
  const args = msg.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const user = msg.author;
  const userData = getUserAura(user.id);

  if (command === "aura") {
    if (args[0] === "gamble") {
      const amount = parseInt(args[1]);
      if (isNaN(amount) || amount <= 0) return msg.reply("⚠️ Enter a valid aura amount!");
      if (userData.aura < amount) return msg.reply("❌ You don’t have enough aura!");

      const win = Math.random() < 0.5;
      if (win) userData.aura += amount;
      else userData.aura -= amount;

      saveAura();
      msg.reply(win ? `🎲 You won! +${amount} aura.` : `💀 You lost! -${amount} aura.`);
    } 
    else if (args[0] === "battle") {
      const amount = parseInt(args[1]);
      const target = msg.mentions.users.first();
      if (!amount || !target) return msg.reply("⚔️ Usage: *aura battle <amount> @user");
      if (target.bot || target.id === user.id) return msg.reply("😅 You can’t battle yourself or bots!");

      const targetData = getUserAura(target.id);
      if (userData.aura < amount || targetData.aura < amount) return msg.reply("❌ Not enough aura to battle!");

      msg.channel.send(`⚔️ ${target}, ${user.username} challenges you for **${amount} aura!** Type *aura accept to fight.`);
      aura[target.id].pendingBattle = { challenger: user.id, amount };
      saveAura();
    } 
    else if (args[0] === "accept") {
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
      msg.channel.send(result);
    } 
    else if (args[0] === "leaderboard") {
      const sorted = Object.entries(aura).sort((a, b) => b[1].aura - a[1].aura).slice(0, 10);
      const lb = await Promise.all(sorted.map(async ([id, data], i) => {
        const u = await client.users.fetch(id).catch(() => null);
        return `${i + 1}. ${u ? u.username : "Unknown"} — ${data.aura}`;
      }));
      const embed = new EmbedBuilder()
        .setTitle("🏆 MXaura Leaderboard")
        .setDescription(lb.join("\n"))
        .setColor("#9b59b6");
      msg.channel.send({ embeds: [embed] });
    } 
    else msg.reply(`🌌 Your aura: **${userData.aura}**`);
  }

  if (command === "help") {
    const embed = new EmbedBuilder()
      .setTitle("📜 MXaura Commands")
      .setDescription(`
*aura — show aura
*aura gamble <amount> — gamble aura
*aura battle <amount> @user — challenge someone
*aura accept — accept battle
*aura leaderboard — show top aura
*aura help — show help
💫 Aura resets daily at midnight.`)
      .setColor("#a29bfe");
    msg.channel.send({ embeds: [embed] });
  }
});

client.login(process.env.TOKEN);
