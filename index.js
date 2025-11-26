const express = require("express");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const fs = require("fs");
require("dotenv").config();

const app = express();
app.get("/", (req, res) => res.send("🌌 MXaura bot is online!"));
app.listen(3000, () => console.log("🌐 MXaura web server running!"));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const prefix = "*";
const DATA_FILE = "auraData.json";

// YOUR PERMISSIONS
const OWNER_ID = "768471167769116712";
const FRIEND_ID = "1299049965863178424";

let aura = {};
if (fs.existsSync(DATA_FILE)) aura = JSON.parse(fs.readFileSync(DATA_FILE));

function saveAura() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(aura, null, 2));
}

function getUserAura(id) {
  if (!aura[id]) aura[id] = { aura: Math.floor(Math.random() * 101) + 50 };
  return aura[id];
}

// ====== DAILY RESET (INDIA) ======
function resetDailyAura() {
  console.log("🔄 Resetting aura at 12AM IST");
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
client.on("ready", () => console.log(`✅ Logged in as ${client.user.tag}`));

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
      if (!amount || amount <= 0) return msg.reply("⚠️ Invalid amount.");
      if (userData.aura < amount) return msg.reply("❌ Not enough aura.");

      const win = Math.random() < 0.5;
      win ? userData.aura += amount : userData.aura -= amount;

      saveAura();
      return msg.reply(win ? `🎲 Won +${amount}` : `💀 Lost -${amount}`);
    }

    // -------- BATTLE --------
    if (args[0] === "battle") {
      const amount = parseInt(args[1]);
      const target = msg.mentions.users.first();
      if (!amount || !target) return msg.reply("⚔️ *aura battle <amount> @user");
      if (target.bot || target.id === user.id) return msg.reply("❌ Can't battle.");

      const targetData = getUserAura(target.id);
      if (userData.aura < amount || targetData.aura < amount) return msg.reply("❌ Aura low.");

      aura[target.id].pendingBattle = { challenger: user.id, amount };
      saveAura();
      return msg.channel.send(`⚔️ ${target}, type *aura accept`);
    }

    // -------- ACCEPT --------
    if (args[0] === "accept") {
      const pending = aura[user.id]?.pendingBattle;
      if (!pending) return msg.reply("❌ No challenge.");

      const challenger = await client.users.fetch(pending.challenger);
      const cData = getUserAura(challenger.id);
      const tData = getUserAura(user.id);

      delete tData.pendingBattle;

      const cr = Math.floor(Math.random() * 100);
      const tr = Math.floor(Math.random() * 100);

      let result = `${challenger.username}: ${cr}\n${user.username}: ${tr}\n`;

      if (tr > cr) {
        tData.aura += pending.amount;
        cData.aura -= pending.amount;
        result += `🏆 ${user.username} wins`;
      } else if (cr > tr) {
        cData.aura += pending.amount;
        tData.aura -= pending.amount;
        result += `🏆 ${challenger.username} wins`;
      } else result += "🤝 Tie";

      saveAura();
      return msg.channel.send(result);
    }

    // -------- LEADERBOARD --------
    if (args[0] === "leaderboard") {
      const sorted = Object.entries(aura).sort((a,b)=>b[1].aura-a[1].aura).slice(0,10);
      const list = await Promise.all(sorted.map(async ([id,data],i)=>{
        const u = await client.users.fetch(id).catch(()=>null);
        return `${i+1}. ${u?.username || "Unknown"} — ${data.aura}`;
      }));

      const embed = new EmbedBuilder()
        .setTitle("🏆 Aura Leaderboard")
        .setDescription(list.join("\n"))
        .setColor("#9b59b6");

      return msg.channel.send({ embeds: [embed] });
    }

    // ===== ADMIN SYSTEM =====

    // -------- GIVE --------
    if (args[0] === "give") {
      const amount = parseInt(args[1]);
      const target = msg.mentions.users.first();

      if (!amount || !target) return msg.reply("*aura give <amount> @user");

      // OWNER FULL ACCESS
      if (user.id === OWNER_ID) {
        getUserAura(target.id).aura += amount;
        saveAura();
        return msg.reply(`✅ Gave ${amount} to ${target.username}`);
      }

      // FRIEND LIMITED
      if (user.id === FRIEND_ID) {
        if (amount > 500 || amount < 1) return msg.reply("❌ Max limit is 500.");
        getUserAura(target.id).aura += amount;
        saveAura();
        return msg.reply(`✅ Gave ${amount} to ${target.username}`);
      }

      return msg.reply("🚫 No permission.");
    }

    // -------- TAKE --------
    if (args[0] === "take") {
      const amount = parseInt(args[1]);
      const target = msg.mentions.users.first();
      if (!amount || !target) return msg.reply("*aura take <amount> @user");

      if (user.id === OWNER_ID) {
        getUserAura(target.id).aura -= amount;
        saveAura();
        return msg.reply(`✅ Took ${amount} from ${target.username}`);
      }

      if (user.id === FRIEND_ID) {
        if (amount > 500 || amount < 1) return msg.reply("❌ Max 500.");
        getUserAura(target.id).aura -= amount;
        saveAura();
        return msg.reply(`✅ Took ${amount} from ${target.username}`);
      }

      return msg.reply("🚫 No permission.");
    }

    // -------- RESET --------
    if (args[0] === "reset") {
      if (user.id !== OWNER_ID) return msg.reply("🚫 Only owner.");
      const target = msg.mentions.users.first();
      if (!target) return msg.reply("*aura reset @user");

      getUserAura(target.id).aura = 0;
      saveAura();
      return msg.reply(`🔄 Reset ${target.username}'s aura`);
    }

    // -------- SET --------
    if (args[0] === "set") {
      if (user.id !== OWNER_ID) return msg.reply("🚫 Only owner.");
      const amount = parseInt(args[1]);
      const target = msg.mentions.users.first();

      if (!amount || !target) return msg.reply("*aura set <amount> @user");

      getUserAura(target.id).aura = amount;
      saveAura();
      return msg.reply(`✅ Set ${target.username} to ${amount}`);
    }

    // -------- VIEW --------
    return msg.reply(`🌌 Aura: **${userData.aura}**`);
  }

  // HELP (NO ADMIN COMMANDS)
  if (command === "help") {
    const embed = new EmbedBuilder()
      .setTitle("MXaura Commands")
      .setDescription(`
*aura  
*aura gamble <amount>  
*aura battle <amount> @user  
*aura accept  
*aura leaderboard  

Daily reset at 12AM IST.
      `)
      .setColor("#a29bfe");

    msg.channel.send({ embeds: [embed] });
  }
});

client.login(process.env.TOKEN);
