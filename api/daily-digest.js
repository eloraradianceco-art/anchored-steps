// Daily activity digest for all 4 Elora Radiance apps.
// Triggered by Vercel Cron (see vercel.json), sends summary to eloraradiance.co@gmail.com via Resend.

const DIGEST_TO = "eloraradiance.co@gmail.com";
const DIGEST_FROM = "Elora Radiance Digest <reports@eloraradiance.com>";

const APPS = [
  { name: "Anchored Steps Year 1", url: process.env.VITE_SUPABASE_URL,    key: process.env.SUPABASE_SERVICE_ROLE_KEY },
  { name: "Anchored Steps Year 2", url: process.env.SUPABASE_AS2_URL,     key: process.env.SUPABASE_AS2_SERVICE_KEY },
  { name: "Armed & Anchored",       url: process.env.SUPABASE_AA_URL,      key: process.env.SUPABASE_AA_SERVICE_KEY },
  { name: "The Red Letters",        url: process.env.SUPABASE_RL_URL,      key: process.env.SUPABASE_RL_SERVICE_KEY },
];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function fetchAppUsers(app) {
  if (!app.url || !app.key) {
    return { app: app.name, error: "Missing env vars", users: [] };
  }
  try {
    const r = await fetch(`${app.url}/auth/v1/admin/users?per_page=500`, {
      headers: {
        "Authorization": `Bearer ${app.key}`,
        "apikey": app.key,
      },
    });
    if (!r.ok) {
      const text = await r.text();
      return { app: app.name, error: `${r.status}: ${text.slice(0,180)}`, users: [] };
    }
    const data = await r.json();
    return { app: app.name, users: data.users || [] };
  } catch (e) {
    return { app: app.name, error: String(e.message || e), users: [] };
  }
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
}

function buildHtml(summaries) {
  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });

  const totalNew = summaries.reduce((s, a) => s + a.newSignups.length, 0);
  const totalActive = summaries.reduce((s, a) => s + a.activeSignins.length, 0);
  const totalUsers = summaries.reduce((s, a) => s + a.totalUsers, 0);

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#0F1A24;font-family:Georgia,serif;">
  <div style="max-width:640px;margin:0 auto;background:#F5F1E8;border-radius:16px;padding:32px;border:1px solid rgba(176,138,78,0.2);">
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-family:'Cinzel',Georgia,serif;font-size:10px;letter-spacing:0.18em;color:#B08A4E;text-transform:uppercase;margin-bottom:8px;">Elora Radiance Co.</div>
      <h1 style="font-family:'Cinzel',Georgia,serif;font-size:24px;color:#2C1810;margin:0;letter-spacing:0.04em;font-weight:600;">Daily Activity Digest</h1>
      <div style="font-size:13px;color:#7A6248;margin-top:6px;font-style:italic;">${dateLabel}</div>
    </div>

    <div style="background:#FFFEF9;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid rgba(176,138,78,0.18);">
      <table style="width:100%;border-collapse:collapse;"><tr>
        <td style="text-align:center;padding:0 12px;border-right:1px solid rgba(0,0,0,0.06);">
          <div style="font-size:30px;font-weight:700;color:#B08A4E;font-family:'Cinzel',Georgia,serif;line-height:1;">${totalNew}</div>
          <div style="font-size:10px;color:#7A6248;letter-spacing:0.14em;text-transform:uppercase;margin-top:6px;font-family:'Cinzel',Georgia,serif;">New Signups</div>
        </td>
        <td style="text-align:center;padding:0 12px;border-right:1px solid rgba(0,0,0,0.06);">
          <div style="font-size:30px;font-weight:700;color:#B08A4E;font-family:'Cinzel',Georgia,serif;line-height:1;">${totalActive}</div>
          <div style="font-size:10px;color:#7A6248;letter-spacing:0.14em;text-transform:uppercase;margin-top:6px;font-family:'Cinzel',Georgia,serif;">Active Today</div>
        </td>
        <td style="text-align:center;padding:0 12px;">
          <div style="font-size:30px;font-weight:700;color:#B08A4E;font-family:'Cinzel',Georgia,serif;line-height:1;">${totalUsers}</div>
          <div style="font-size:10px;color:#7A6248;letter-spacing:0.14em;text-transform:uppercase;margin-top:6px;font-family:'Cinzel',Georgia,serif;">Total Users</div>
        </td>
      </tr></table>
    </div>`;

  for (const s of summaries) {
    html += `<div style="margin-bottom:16px;padding:18px 20px;background:#FFFEF9;border-left:3px solid #B08A4E;border-radius:6px;">
      <div style="font-family:'Cinzel',Georgia,serif;font-size:14px;color:#2C1810;font-weight:600;margin-bottom:10px;letter-spacing:0.04em;">${s.app}</div>`;

    if (s.error) {
      html += `<div style="font-size:12px;color:#C94040;font-style:italic;">Could not load: ${s.error}</div>`;
    } else if (s.newSignups.length === 0 && s.activeSignins.length === 0) {
      html += `<div style="font-size:13px;color:#9A8268;font-style:italic;">No activity in the last 24 hours.</div>`;
    } else {
      if (s.newSignups.length > 0) {
        html += `<div style="margin-bottom:10px;"><div style="font-size:12px;color:#2C1810;font-weight:600;margin-bottom:4px;">★ ${s.newSignups.length} new signup${s.newSignups.length>1?"s":""}</div>`;
        for (const u of s.newSignups.slice(0, 10)) {
          html += `<div style="font-size:12px;color:#5A4535;margin-left:14px;line-height:1.7;">• ${u.email} <span style="color:#9A8268;">— ${fmtDate(u.created_at)}</span></div>`;
        }
        if (s.newSignups.length > 10) {
          html += `<div style="font-size:11px;color:#9A8268;margin-left:14px;font-style:italic;">…and ${s.newSignups.length-10} more</div>`;
        }
        html += `</div>`;
      }
      const returningSignins = s.activeSignins.filter(u => !s.newSignups.find(n => n.id === u.id));
      if (returningSignins.length > 0) {
        html += `<div><div style="font-size:12px;color:#2C1810;font-weight:600;margin-bottom:4px;">↻ ${returningSignins.length} returning sign-in${returningSignins.length>1?"s":""}</div>`;
        for (const u of returningSignins.slice(0, 10)) {
          html += `<div style="font-size:12px;color:#5A4535;margin-left:14px;line-height:1.7;">• ${u.email} <span style="color:#9A8268;">— ${fmtDate(u.last_sign_in_at)}</span></div>`;
        }
        if (returningSignins.length > 10) {
          html += `<div style="font-size:11px;color:#9A8268;margin-left:14px;font-style:italic;">…and ${returningSignins.length-10} more</div>`;
        }
        html += `</div>`;
      }
    }
    html += `<div style="margin-top:10px;font-size:11px;color:#9A8268;border-top:1px solid rgba(176,138,78,0.12);padding-top:8px;">${s.totalUsers} total user${s.totalUsers===1?"":"s"}</div>`;
    html += `</div>`;
  }

  html += `<div style="text-align:center;margin-top:24px;padding-top:18px;border-top:1px solid rgba(176,138,78,0.15);font-size:11px;color:#9A8268;font-style:italic;line-height:1.7;">
    Activity window: last 24 hours · Sent automatically by Vercel Cron<br/>
    Adjust schedule or filters at <code style="font-family:monospace;font-size:10px;">/api/daily-digest.js</code>
  </div></div></body></html>`;

  return html;
}

module.exports = async (req, res) => {
  // Auth: require Vercel cron header. Vercel automatically sets Authorization: Bearer CRON_SECRET
  // when cron triggers, IF CRON_SECRET env var is set in the project.
  // Also allow ?token=CRON_SECRET as a fallback for manual testing.
  const auth = req.headers.authorization || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  const tokenParam = (req.query && req.query.token) || "";

  if (process.env.CRON_SECRET && auth !== expected && tokenParam !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const cutoffMs = Date.now() - ONE_DAY_MS;

    const results = await Promise.all(APPS.map(fetchAppUsers));

    const summaries = results.map(r => {
      const users = r.users || [];
      const newSignups = users.filter(u => u.created_at && new Date(u.created_at).getTime() > cutoffMs);
      const activeSignins = users.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() > cutoffMs);
      return {
        app: r.app,
        error: r.error,
        users,
        newSignups,
        activeSignins,
        totalUsers: users.length,
      };
    });

    const html = buildHtml(summaries);
    const totals = summaries.reduce((acc, s) => ({
      newSignups: acc.newSignups + s.newSignups.length,
      activeSignins: acc.activeSignins + s.activeSignins.length,
      totalUsers: acc.totalUsers + s.totalUsers,
    }), { newSignups: 0, activeSignins: 0, totalUsers: 0 });

    const subjectDate = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
    const subject = `Elora Radiance daily digest — ${subjectDate} (${totals.newSignups} new, ${totals.activeSignins} active)`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: DIGEST_FROM,
        to: [DIGEST_TO],
        subject,
        html,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("Resend error:", errText);
      return res.status(500).json({
        error: "Email send failed",
        detail: errText,
        summaries: summaries.map(s => ({ app: s.app, error: s.error, newSignups: s.newSignups.length, activeSignins: s.activeSignins.length, totalUsers: s.totalUsers })),
      });
    }

    return res.status(200).json({
      sent: true,
      to: DIGEST_TO,
      totals,
      summaries: summaries.map(s => ({ app: s.app, error: s.error, newSignups: s.newSignups.length, activeSignins: s.activeSignins.length, totalUsers: s.totalUsers })),
    });
  } catch (e) {
    console.error("Digest crashed:", e);
    return res.status(500).json({ error: "Digest crashed", detail: String(e.message || e) });
  }
};
