const express = require("express");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const fs = require("fs");
require("dotenv").config();

const app = express();
app.get("/", (req, res) => res.send("🌌 MXaura bot is online!"));

// ✅ PORT FIX FOR RENDER
app.listen(process.env.PORT || 3000, () => console.log("🌐 MXaura web server running!"));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const prefix = "*";
const DATA_FILE = "auraData.json";

// YOUR PERMISSIONS
const OWNER_ID = "768471167769116712";
const FRIEND_ID = "1299049965863178424";

let aura = {};

// ✅ SAFE JSON LOAD (CRASH PROTECTION)
if (fs.existsSync(DATA_FILE)) {
  try {
    aura = JSON.parse(fs.readFileSync(DATA_FILE));
  } catch {
    console.log("⚠ auraData.json corrupted, resetting...");
    aura = {};
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
  }
}

function saveAura() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(aura, null, 2));
}

function getUserAura(id) {
  if (!aura[id]) aura[id] = { aura: Math.floor(Math.random() * 101) + 50 };
  return aura[id];
}

// ====== DAILY RESET (INDIA) ======

function resetDailyAura() {
  console.log("🔄 Resetting aura data for new day (IST)!");
  for (let user in aura) {
    aura[user].aura = Math.floor(Math.random() * 101) + 50;
    delete aura[user].pendingBattle;
  }
  saveAura();
}

function getISTDate() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 5.5 * 60 * 60 * 1000);
}

setInterval(() => {
  const now = getISTDate();
  if (now.getHours() === 0 && now.getMinutes() === 0) resetDailyAura();
}, 60000);

// ====== BOT READY ======

client.on("ready", () => console.log(✅ Logged in as ${client.user.tag}));

// ✅ ANTI-CRASH HANDLERS
process.on("unhandledRejection", err => console.log("❗ Error:", err));
process.on("uncaughtException", err => console.log("❗ Crash:", err));

// ====== COMMAND HANDLER ======

client.on("messageCreate", async msg => {
  if (!msg.content.startsWith(prefix) || msg.author.bot) return;

  const args = msg.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const user = msg.author;
  const userData = getUserAura(user.id);

  if (command === "aura") {

    // -------- GAMBLE --------

    if (args[0] === "gamble") {
      const amount = parseInt(args[1]);
      if (!amount || amount <= 0) return msg.reply("⚠️ Enter a valid amount!");
      if (userData.aura < amount) return msg.reply("💀 Not enough aura!");

      const win = Math.random() < 0.5;
      win ? userData.aura += amount : userData.aura -= amount;

      saveAura();
      return msg.reply(win ? 🎲 You won! +${amount} aura. : 💀 You lost! -${amount} aura.);
    }

    // -------- BATTLE --------

    if (args[0] === "battle") {
      const amount = parseInt(args[1]);
      const target = msg.mentions.users.first();
      if (!amount || !target) return msg.reply("⚔️ Usage: *aura battle <amount> @user");
      if (target.bot || target.id === user.id) return msg.reply("😅 You can’t battle yourself or bots!");

      const targetData = getUserAura(target.id);
      if (userData.aura < amount || targetData.aura < amount) return msg.reply("❌ Not enough aura to battle!");

      aura[target.id].pendingBattle = { challenger: user.id, amount };
      saveAura();
      return msg.channel.send(⚔️ ${target}, ${user.username} challenges you for **${amount} aura!** Type *aura accept);
    }

    // -------- ACCEPT --------

    if (args[0] === "accept") {
      const pending = aura[user.id]?.pendingBattle;
      if (!pending) return msg.reply("❌ No one challenged you!");

      const challenger = await client.users.fetch(pending.challenger);
      const cData = getUserAura(challenger.id);
      const tData = getUserAura(user.id);

      delete tData.pendingBattle;

      const cr = Math.floor(Math.random() * 100);
      const tr = Math.floor(Math.random() * 100);

      let result = 🎲 ${challenger.username} rolled ${cr}\n🎲 ${user.username} rolled ${tr}\n;

      if (tr > cr) {
        tData.aura += pending.amount;
        cData.aura -= pending.amount;
        result += 🏆 ${user.username} wins ${pending.amount} aura!;
      } else if (cr > tr) {
        cData.aura += pending.amount;
        tData.aura -= pending.amount;
        result += 🏆 ${challenger.username} wins ${pending.amount} aura!;
      } else result += "🤝 It's a tie!";

      saveAura();
      return msg.channel.send(result);
    }

    // -------- LEADERBOARD --------

    if (args[0] === "leaderboard") {
      const sorted = Object.entries(aura).sort((a,b)=>b[1].aura-a[1].aura).slice(0,10);
      const list = await Promise.all(sorted.map(async ([id,data],i)=>{
        const u = await client.users.fetch(id).catch(()=>null);
        return ${i+1}. ${u?.username || "Unknown"} — ${data.aura};
      }));

      const embed = new EmbedBuilder()
        .setTitle("🏆 MXaura Leaderboard")
        .setDescription(list.join("\n"))
        .setColor("#9b59b6");

      return msg.channel.send({ embeds: [embed] });
    }

    // ===== ADMIN SYSTEM =====

    // -------- GIVE --------

    if (args[0] === "give") {
      const amount = parseInt(args[1]);
      const target = msg.mentions.users.first();
      if (!amount || !target) return msg.reply("✨ Usage: *aura give <amount> @user");

      if (user.id === OWNER_ID) {
        getUserAura(target.id).aura += amount;
        saveAura();
        return msg.reply(✅ Gave ${amount} aura to ${target.username}!);
      }

      if (user.id === FRIEND_ID) {
        if (amount > 500 || amount < 1) return msg.reply("❌ Max limit is 500.");
        getUserAura(target.id).aura += amount;
        saveAura();
        return msg.reply(✅ Gave ${amount} aura to ${target.username}!);
      }

      return msg.reply("❌ You can’t use this command!");
    }

    // -------- TAKE --------

    if (args[0] === "take") {
      const amount = parseInt(args[1]);
      const target = msg.mentions.users.first();
      if (!amount || !target) return msg.reply("✨ Usage: *aura take <amount> @user");

      if (user.id === OWNER_ID) {
        getUserAura(target.id).aura -= amount;
        saveAura();
        return msg.reply(✅ Took ${amount} aura from ${target.username}!);
      }

      if (user.id === FRIEND_ID) {
        if (amount > 500 || amount < 1) return msg.reply("❌ Max limit is 500.");
        getUserAura(target.id).aura -= amount;
        saveAura();
        return msg.reply(✅ Took ${amount} aura from ${target.username}!);
      }

      return msg.reply("❌ You can’t use this command!");
    }

    // -------- RESET --------

    if (args[0] === "reset") {
      if (user.id !== OWNER_ID) return msg.reply("❌ You can’t use this command!");
      const target = msg.mentions.users.first();
      if (!target) return msg.reply("✨ Usage: *aura reset @user");

      getUserAura(target.id).aura = 0;
      saveAura();
      return msg.reply(🔄 Reset ${target.username}'s aura);
    }

    // -------- SET --------

    if (args[0] === "set") {
      if (user.id !== OWNER_ID) return msg.reply("❌ You can’t use this command!");
      const amount = parseInt(args[1]);
      const target = msg.mentions.users.first();
      if (!amount || !target) return msg.reply("✨ Usage: *aura set <amount> @user");

      getUserAura(target.id).aura = amount;
      saveAura();
      return msg.reply(✅ Set ${target.username} to ${amount} aura);
    }

    // -------- VIEW --------
    return msg.reply(🌌 Your aura: **${userData.aura}**);
  }

  // HELP
  if (command === "help") {
    const embed = new EmbedBuilder()
      .setTitle("📜 MXaura Commands")
      .setDescription(`
*aura — show aura  
*aura gamble <amount>  
*aura battle <amount> @user  
*aura accept  
*aura leaderboard  

💫 Aura resets daily at 12AM (India time).
`)
      .setColor("#a29bfe");

    msg.channel.send({ embeds: [embed] });
  }
});

client.login(process.env.TOKEN);
