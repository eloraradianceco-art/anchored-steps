// Daily reminders (web push) for Year 1, Year 2, Armed & Anchored and The Red Letters.
//
// Two ways in:
//   1. Every 15 minutes Supabase (pg_cron + pg_net) POSTs here with the x-cron-secret header.
//      We claim the reminders that are due in each person's own time zone and send them.
//   2. A signed-in person taps "Send a test" in Settings: the app POSTs { app, endpoint } with
//      their access token, and we send a test to that device only.
//
// Push keys and the cron secret live in public.app_secrets (server-only, no browser access).

const { createClient } = require("@supabase/supabase-js");
const webpush = require("web-push");

// The database address is public; the service key must come from the Vercel settings.
const HUB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://cvtukqamaqrhjtdvmslb.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const APPS = {
  aa:  { title: "Armed & Anchored",           url: "https://armedandanchored.vercel.app",      icon: "/icon.png" },
  as1: { title: "Anchored Steps",             url: "https://anchored-steps.vercel.app",        icon: "/icon.png" },
  as2: { title: "Anchored Steps · Year 2",    url: "https://anchored-steps-year2.vercel.app",  icon: "/icon2.png" },
  rl:  { title: "The Red Letters",            url: "https://redletters.vercel.app",            icon: "/icon.png" },
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

const ALLOWED_ORIGINS = new Set(Object.values(APPS).map(a => a.url));

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  }
}

function dayOfYear(d = new Date()) {
  return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
}

function messageFor(app, offset = 0) {
  const list = MESSAGES[app] || MESSAGES.as1;
  return list[(dayOfYear() + offset) % list.length];
}

function formatTime(t) {
  const [h, m] = String(t || "07:00").split(":").map(Number);
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

async function sendAll(supa, rows, buildPayload) {
  let sent = 0, failed = 0;
  const gone = [];
  await Promise.all(rows.map(async (row) => {
    const app = APPS[row.app] || APPS.as1;
    const payload = JSON.stringify({ ...buildPayload(row), url: app.url + "/", icon: app.icon });
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        payload,
        { TTL: 3600, urgency: "normal" }
      );
      sent++;
    } catch (err) {
      failed++;
      if (err && (err.statusCode === 404 || err.statusCode === 410)) gone.push(row.endpoint);
      else console.warn("push failed", row.app, err && err.statusCode, err && err.body);
    }
  }));
  let removed = 0;
  if (gone.length) {
    const { data } = await supa.rpc("drop_push_subscriptions", { p_endpoints: gone });
    removed = data || 0;
  }
  return { sent, failed, removed };
}

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!SERVICE_KEY) {
    // Names only, never values: tells us which Vercel setting is missing.
    const present = Object.keys(process.env).filter(k => /SUPABASE|STRIPE|RESEND|CRON/.test(k)).sort();
    return res.status(500).json({ error: "Server not configured", missing: "SUPABASE_SERVICE_ROLE_KEY", present });
  }

  const supa = createClient(HUB_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: secrets, error: secretErr } = await supa.from("app_secrets").select("name, value");
  if (secretErr) return res.status(500).json({ error: "Could not load settings" });
  const s = Object.fromEntries((secrets || []).map(r => [r.name, r.value]));
  webpush.setVapidDetails("mailto:eloraradiance.co@gmail.com", s.vapid_public, s.vapid_private);

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

  // 1. Scheduled run from Supabase
  const cronHeader = req.headers["x-cron-secret"];
  if (cronHeader && s.cron_secret && cronHeader === s.cron_secret) {
    const { data: due, error } = await supa.rpc("claim_due_push_reminders");
    if (error) return res.status(500).json({ error: error.message });
    const result = await sendAll(supa, due || [], (row) => ({
      title: APPS[row.app] ? APPS[row.app].title : "Elora Radiance",
      body: messageFor(row.app),
      tag: "daily-reminder",
    }));
    return res.status(200).json({ due: (due || []).length, ...result });
  }

  // 2. "Send a test" from a signed-in person
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const { data: userData, error: userErr } = await supa.auth.getUser(token);
  if (userErr || !userData || !userData.user) return res.status(401).json({ error: "Unauthorized" });
  if (!APPS[body.app]) return res.status(400).json({ error: "Unknown app" });

  let q = supa.from("push_subscriptions")
    .select("endpoint, p256dh, auth, app, remind_time")
    .eq("user_id", userData.user.id).eq("app", body.app);
  if (body.endpoint) q = q.eq("endpoint", body.endpoint);
  const { data: rows, error: rowsErr } = await q;
  if (rowsErr) return res.status(500).json({ error: rowsErr.message });
  if (!rows || !rows.length) return res.status(404).json({ error: "No reminder set on this device" });

  const result = await sendAll(supa, rows, (row) => ({
    title: APPS[row.app].title,
    body: `Reminders are on. You'll hear from us every day at ${formatTime(row.remind_time)}.`,
    tag: "reminder-test",
  }));
  return res.status(200).json(result);
};
