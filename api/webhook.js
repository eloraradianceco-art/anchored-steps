const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

// One Stripe webhook for every Elora Radiance sale. Anchored Steps Year 1, Year 2 and
// Armed & Anchored share one database and one sign-in, so this endpoint unlocks the
// right app for each purchase. Sales of other products are ignored here.

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Which app each Stripe payment link unlocks.
const LINK_APP = {
  plink_1TekXdBr8nMXOo8tIeA9z5Gh: "as1", // Year 1 lifetime ($39), current link
  plink_1TKlBkBr8nMXOo8ttPMa9yuR: "as1", // Year 1, earlier one-time link
  plink_1TLS4FBr8nMXOo8tDyze6tOc: "as1", // Year 1 subscription link
  plink_1TLBVbBr8nMXOo8tbuChBM0a: "as1", // Year 1, retired
  plink_1TKlJABr8nMXOo8t7frz1jG6: "as1", // Year 1 weekly, retired
  plink_1TekLGBr8nMXOo8twn1VcZkz: "as2", // Year 2 lifetime ($39)
  plink_1TemdMBr8nMXOo8tEK01T1gs: "aa",  // Armed & Anchored, current link
  plink_1TYoaFBr8nMXOo8tyad1GVaT: "aa",  // Armed & Anchored, earlier link
};
// Fallback for checkouts without a known link: where the buyer is sent afterwards.
const HOST_APP = {
  "anchored-steps.vercel.app": "as1",
  "anchored-steps-y2.vercel.app": "as2",
  "armedandanchored.vercel.app": "aa",
};

const APP_INFO = {
  as1: { name: "Anchored Steps", tagline: "52 Weeks of Faith in Action", url: "https://anchored-steps.vercel.app", prefix: "AS-" },
  as2: { name: "Anchored Steps · Year 2", tagline: "52 More Weeks of Faith in Action", url: "https://anchored-steps-y2.vercel.app", prefix: "Y2-" },
};

function appForSession(session) {
  if (session.metadata && APP_INFO[session.metadata.app]) return session.metadata.app;
  if (session.metadata && session.metadata.app === "aa") return "aa";
  if (session.payment_link && LINK_APP[session.payment_link]) return LINK_APP[session.payment_link];
  try {
    const host = new URL(session.success_url).host;
    if (HOST_APP[host]) return HOST_APP[host];
  } catch (e) { /* no success url */ }
  return null;
}

function generateCode(prefix) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = prefix;
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function sendEmail(to, code, plan, app) {
  const info = APP_INFO[app];
  const planLabel = plan === "weekly" ? "Weekly Plan" : "Lifetime Access";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Anchored Steps <noreply@eloraradiance.com>",
      to: [to],
      subject: `Your ${info.name} Access Code`,
      html: `
        <div style="background:#0b1825;padding:40px 20px;font-family:Georgia,serif;max-width:520px;margin:0 auto;border-radius:16px;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="font-size:36px;">&#9875;</div>
            <h1 style="color:#ede3cd;font-size:22px;margin:8px 0 4px;font-family:Georgia,serif;">${info.name}</h1>
            <p style="color:#7e92a2;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;margin:0;">${info.tagline}</p>
          </div>
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(180,140,60,0.28);border-radius:12px;padding:28px;margin-bottom:24px;">
            <p style="color:#d8cfc0;font-size:16px;line-height:1.7;margin:0 0 20px;">Thank you for your purchase of ${info.name} (${planLabel}). Your unique access code is below:</p>
            <div style="background:rgba(180,140,60,0.1);border:1px solid rgba(180,140,60,0.4);border-radius:10px;padding:18px;text-align:center;margin-bottom:20px;">
              <div style="color:#7e92a2;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:8px;font-family:Georgia,serif;">Your Access Code</div>
              <div style="color:#c9a84c;font-size:28px;font-weight:bold;letter-spacing:0.15em;font-family:Georgia,serif;">${code}</div>
            </div>
            <p style="color:#7e92a2;font-size:13px;line-height:1.6;margin:0 0 20px;">Tap Create account and enter this code. Already have an account from another Elora Radiance app? Sign in with it and enter the code when asked. Each code can only be used once.</p>
            <div style="text-align:center;">
              <a href="${info.url}" style="display:inline-block;background:linear-gradient(135deg,rgba(180,140,60,0.4),rgba(180,140,60,0.2));border:1px solid rgba(180,140,60,0.5);color:#ede3cd;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;letter-spacing:0.08em;">Open Your Journal &#8594;</a>
            </div>
          </div>
          <div style="text-align:center;">
            <p style="color:#3e5060;font-size:12px;line-height:1.6;font-style:italic;margin:0;">"Walk steadily. Stay anchored. Trust God with every step."</p>
            <p style="color:#3e5060;font-size:11px;margin:8px 0 0;">Elora Radiance Co. &mdash; eloraradiance.com</p>
          </div>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    console.error("Resend error:", err);
    throw new Error("Failed to send email");
  }

  return response.json();
}

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Armed & Anchored has no codes: the purchase unlocks the buyer's account directly.
// If they don't have an account yet, the app applies the purchase when they sign in.
async function unlockArmedAndAnchored(purchaseId, session, email) {
  let uid = null;
  const ref = session.client_reference_id;
  if (ref && /^[0-9a-f-]{36}$/i.test(ref)) {
    const { data } = await supabase.auth.admin.getUserById(ref);
    if (data && data.user) uid = data.user.id;
  }
  if (!uid && email) {
    const { data } = await supabase.from("aa_profiles").select("id").eq("email", email).maybeSingle();
    if (data) uid = data.id;
  }
  if (!uid) return false;
  const now = new Date().toISOString();
  const row = { id: uid, paid: true, paid_at: now, stripe_session_id: session.id };
  if (email) row.email = email;
  const { error } = await supabase.from("aa_profiles").upsert(row, { onConflict: "id" });
  if (error) { console.error("A&A unlock failed:", error); return false; }
  await supabase.from("purchases").update({ user_id: uid, claimed_at: now }).eq("id", purchaseId);
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).json({ error: "Webhook signature failed" });
  }

  // Year 1 subscriptions: cancellations and resumes
  if (event.type === "customer.subscription.deleted" ||
      event.type === "customer.subscription.updated") {
    const sub = event.data.object;
    if (sub.status === "canceled" || sub.cancel_at_period_end) {
      const customer = await stripe.customers.retrieve(sub.customer);
      const email = customer.email;
      if (email) {
        await supabase
          .from("profiles")
          .update({ subscription_status: "canceled" })
          .eq("email", email.toLowerCase());
        console.log(`Canceled subscription for ${email}`);
      }
    }
    if (event.type === "customer.subscription.updated" && sub.status === "active" && !sub.cancel_at_period_end) {
      const customer = await stripe.customers.retrieve(sub.customer);
      if (customer.email) {
        await supabase
          .from("profiles")
          .update({ subscription_status: "active" })
          .eq("email", customer.email.toLowerCase());
      }
    }
    return res.status(200).json({ received: true });
  }

  // Access is granted once per checkout. Renewal invoices don't create new codes.
  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  if (session.payment_status && session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return res.status(200).json({ received: true, skipped: "not paid" });
  }

  const app = appForSession(session);
  if (!app) {
    console.log(`Checkout ${session.id} is not for Anchored Steps or Armed & Anchored; ignored.`);
    return res.status(200).json({ received: true, ignored: true });
  }

  const rawEmail = session.customer_email || session.customer_details?.email;
  const customerEmail = rawEmail ? rawEmail.trim().toLowerCase() : null;
  const amount = session.amount_total ?? session.amount_paid ?? null;

  // Record the purchase. Stripe can resend an event, so a repeat is skipped here.
  const { data: purchase, error: purchaseErr } = await supabase
    .from("purchases")
    .insert({ app, email: customerEmail, stripe_session_id: session.id, amount })
    .select("id")
    .single();
  if (purchaseErr) {
    if (purchaseErr.code === "23505") return res.status(200).json({ received: true, duplicate: true });
    console.error("Failed to record purchase:", purchaseErr);
    return res.status(500).json({ error: "Failed to record purchase" });
  }

  if (app === "aa") {
    const unlocked = await unlockArmedAndAnchored(purchase.id, session, customerEmail);
    console.log(`Armed & Anchored purchase ${session.id}: ${unlocked ? "unlocked" : "waiting for sign-in"}`);
    return res.status(200).json({ received: true });
  }

  if (!customerEmail) {
    console.error("No customer email found");
    return res.status(200).json({ received: true });
  }

  // Year 1 or Year 2: create a one-time access code and email it.
  const plan = amount != null && amount <= 200 ? "weekly" : "annual";
  let code;
  for (let attempts = 0; attempts < 10; attempts++) {
    code = generateCode(APP_INFO[app].prefix);
    const { data } = await supabase.from("access_codes").select("code").eq("code", code).maybeSingle();
    if (!data) break;
  }

  // Saving the code also sends the welcome email from the database.
  const { error: insertError } = await supabase
    .from("access_codes")
    .insert({ code, plan, app, used: false, customer_email: customerEmail });

  if (insertError) {
    console.error("Failed to insert code:", insertError);
    await supabase.from("purchases").delete().eq("id", purchase.id);
    return res.status(500).json({ error: "Failed to create access code" });
  }

  try {
    await sendEmail(customerEmail, code, plan, app);
    console.log(`${app} code ${code} sent to ${customerEmail}`);
  } catch (emailErr) {
    console.error("Email failed:", emailErr);
  }

  return res.status(200).json({ received: true });
};
