// Daily reminders (web push) relay for Year 1, Year 2, Armed & Anchored and The Red Letters.
//
// The shared Supabase database decides who is due (every 15 minutes, in each person's own
// time zone) and POSTs the batch here with the app's push keys; "Send a test" in Settings
// does the same for one device. This function only encrypts and delivers the messages and
// reports which devices are gone, so it needs no Vercel settings.
//
// Only our database can use it: a request is accepted only when its private push key
// matches the public key every Elora Radiance app ships with.

const crypto = require("crypto");
const webpush = require("web-push");

const VAPID_PUBLIC_KEY = "BFqWoG-75HGUXY-JHYdrh2cinBepOmHGprWojb12kuu5QL3Zq-xKAUsy8zHbLxL84Jsa6x4vhHuSfU_Pio-_vZw";
const CONTACT = "mailto:support@eloraradiance.com";
const MAX_ITEMS = 500;

const APPS = {
  aa:  { title: "Armed & Anchored",        url: "https://armed.eloraradiance.com",     icon: "/icon.png" },
  as1: { title: "Anchored Steps",          url: "https://steps.eloraradiance.com",       icon: "/icon.png" },
  as2: { title: "Anchored Steps · Year 2", url: "https://steps2.eloraradiance.com", icon: "/icon2.png" },
  rl:  { title: "The Red Letters",         url: "https://redletters.eloraradiance.com",           icon: "/icon.png" },
};

const MESSAGES = {
  aa: [
    "Today's drill is ready. Five minutes to sharpen your sword.",
    "Put on the full armor of God today. Your drill is waiting. (Ephesians 6:11)",
    "Be strong in the Lord and in the strength of His might. Today's drill is ready. (Ephesians 6:10)",
    "Take every thought captive today. Start with five minutes. (2 Corinthians 10:5)",
    "Your sword is the Word. Pick it up today.",
    "Stand firm. Today's weapon is ready for you.",
    "The battle is real, and so is your Captain. Five minutes in the Word.",
  ],
  as1: [
    "Today's step is ready. A few minutes with God changes the day.",
    "Your word is a lamp to my feet. Today's step is ready. (Psalm 119:105)",
    "Walk steadily today. Your step is waiting.",
    "Come as you are. Today's step is ready.",
    "Faith grows by small, steady steps. Take today's.",
    "Stay anchored. Five minutes with Scripture today.",
    "Presence over perfection. Today's step is waiting.",
  ],
  as2: [
    "Today's step is ready. Go a little deeper.",
    "Let the word of Christ dwell in you richly. Today's step is ready. (Colossians 3:16)",
    "Don't miss what He's saying today. Your step is ready.",
    "Press on. Today's step is waiting. (Philippians 3:12)",
    "A few quiet minutes in the Word. Today's step is ready.",
    "Stay anchored. Today's study is ready for you.",
    "Keep going. The person who stayed is who Year 2 was written for.",
  ],
  rl: [
    "Spend a few minutes with the words of Jesus today.",
    "“Come to me, all who labor and are heavy laden.” Read on today. (Matthew 11:28)",
    "“The words that I have spoken to you are spirit and life.” Open the Red Letters. (John 6:63)",
    "What did Jesus say about today's worry? Find out in the Red Letters.",
    "“Abide in me.” Spend a few minutes in His words today. (John 15:4)",
    "Hear His voice today. A passage is waiting.",
    "“My sheep hear my voice.” Listen today. (John 10:27)",
  ],
};

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function keyPairMatches(privateKey) {
  try {
    const ecdh = crypto.createECDH("prime256v1");
    ecdh.setPrivateKey(Buffer.from(String(privateKey).replace(/-/g, "+").replace(/_/g, "/"), "base64"));
    return b64url(ecdh.getPublicKey()) === VAPID_PUBLIC_KEY;
  } catch (e) {
    return false;
  }
}

function dayOfYear(d = new Date()) {
  return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
}

function formatTime(t) {
  const [h, m] = String(t || "07:00").split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function payloadFor(kind, item) {
  const app = APPS[item.app] || APPS.as1;
  const list = MESSAGES[item.app] || MESSAGES.as1;
  const body = kind === "test"
    ? `Reminders are on. You'll hear from us every day at ${formatTime(item.remind_time)}.`
    : list[dayOfYear() % list.length];
  // "/" opens the app at whatever address the device subscribed from (its own service worker origin),
  // so phones that still have the old vercel.app Home Screen app open that one.
  return JSON.stringify({ title: app.title, body, url: "/", icon: app.icon, tag: kind === "test" ? "reminder-test" : "daily-reminder" });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const { kind = "daily", items = [], vapid = {} } = body;

  if (vapid.public !== VAPID_PUBLIC_KEY || !keyPairMatches(vapid.private)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!Array.isArray(items) || items.length > MAX_ITEMS) return res.status(400).json({ error: "Bad batch" });

  webpush.setVapidDetails(CONTACT, VAPID_PUBLIC_KEY, vapid.private);

  let sent = 0, failed = 0;
  const gone = [];
  await Promise.all(items.map(async (item) => {
    if (!item || !/^https:\/\//.test(item.endpoint || "")) { failed++; return; }
    try {
      await webpush.sendNotification(
        { endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } },
        payloadFor(kind, item),
        { TTL: 3600, urgency: "normal" }
      );
      sent++;
    } catch (err) {
      failed++;
      if (err && (err.statusCode === 404 || err.statusCode === 410)) gone.push(item.endpoint);
      else console.warn("push failed", item.app, err && err.statusCode, err && String(err.body || "").slice(0, 200));
    }
  }));

  return res.status(200).json({ kind, sent, failed, gone });
};
