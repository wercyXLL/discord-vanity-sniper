import WebSocket from "ws";
import fetch from "node-fetch";
import fs from "fs/promises";

const config = JSON.parse(await fs.readFile("./config.json", "utf8"));

const { token, mfa, guildId, vanity, logChannel } = config;

const API = "https://discord.com/api/v10";
const GATEWAY = "wss://gateway.discord.gg/?v=10&encoding=json";

let currentVanity = null;
let hb;

async function sendLog(msg) {
  await fetch(`${API}/channels/${logChannel}/messages`, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ content: `\`\`\`ini\n${msg}\n\`\`\`` })
  });
}

async function getVanity() {
  const res = await fetch(`${API}/guilds/${guildId}/vanity-url`, {
    headers: { Authorization: token }
  });

  const data = await res.json();
  return data.code || null;
}

async function claimVanity(code) {
  await fetch(`${API}/guilds/${guildId}/vanity-url`, {
    method: "PATCH",
    headers: {
      Authorization: token,
      "X-Discord-MFA-Authorization": mfa,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ code })
  });
}

const ws = new WebSocket(GATEWAY);

ws.on("open", () => {
  console.log("Gateway bağlandı.");

  ws.send(JSON.stringify({
    op: 2,
    d: {
      token,
      intents: 1 << 0 | 1 << 9,
      properties: {
        os: "linux",
        browser: "chrome",
        device: "wercy1337"
      }
    }
  }));
});

ws.on("message", async (raw) => {
  const { t, op, d } = JSON.parse(raw);

  if (op === 10) {

    hb = setInterval(() => {
      ws.send(JSON.stringify({ op: 1, d: null }));
    }, d.heartbeat_interval);
  }

  if (t === "GUILD_UPDATE") {
    if (d.guild_id === guildId) {
      const newVanity = d.vanity_url_code || null;

      if (currentVanity && currentVanity !== newVanity) {
        await sendLog(`GUILD_UPDATE → Vanity düştü: ${currentVanity}`);
        claimVanity(currentVanity);
      }

      currentVanity = newVanity;
    }
  }

  if (t === "READY") {
    currentVanity = await getVanity();
    console.log("Başlangıç vanity:", currentVanity);
    sendLog(`Bot aktif — Takip edilen: ${vanity}`);
  }
});

setInterval(async () => {
  const now = await getVanity();

  if (now !== currentVanity) {
    await sendLog(`FETCH → Vanity değişti: ${currentVanity} → ${now}`);
    claimVanity(vanity);
  }

  currentVanity = now;
}, 5); // 5 ms kon trol
process.title = "wercy wishes you a pleasant flight";

console.log("Snipe başladı iyi sanslar amcaoglu");
