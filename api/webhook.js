const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

// One Stripe webhook for every Elora Radiance sale. Anchored Steps Year 1, Year 2 and
// Armed & Anchored share one database and one sign-in, so this endpoint records each
// purchase for the right app. There are no access codes and no emails: the app unlocks
// when the buyer signs in with the email they paid with (or comes back from checkout).
// The Anchored Library ($79) is one purchase row (app "bundle") that opens all three apps.
// Both years ($59.99) is one purchase row (app "both") that opens Year 1 and Year 2.
// The Living Planner Pro subscription lives in its own database: checkouts, renewals and
// cancellations are passed to it (plannerSync), and that is the only way Pro turns on or off.
// Anchored All-Access is one yearly subscription recorded in both databases: memberships here
// (opens Year 1, Year 2 and Armed & Anchored while active) and the planner database (Planner Pro).
// Sales of other products are ignored here.

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Which app each Stripe payment link unlocks.
const LINK_APP = {
  plink_1UfpxsBr8nMXOo8t6fyzRtHX: "as1", // Year 1 lifetime ($39.99), current link since 2026-11-25
  plink_1TekXdBr8nMXOo8tIeA9z5Gh: "as1", // Year 1 lifetime ($39), retired 2026-11-25
  plink_1TKlBkBr8nMXOo8ttPMa9yuR: "as1", // Year 1, earlier one-time link
  plink_1TLS4FBr8nMXOo8tDyze6tOc: "as1", // Year 1 subscription link
  plink_1TLBVbBr8nMXOo8tbuChBM0a: "as1", // Year 1, retired
  plink_1TKlJABr8nMXOo8t7frz1jG6: "as1", // Year 1 weekly, retired
  plink_1UfpxtBr8nMXOo8ty4uLNZMS: "as2", // Year 2 lifetime ($39.99), current link since 2026-11-25
  plink_1TekLGBr8nMXOo8twn1VcZkz: "as2", // Year 2 lifetime ($39), retired 2026-11-25
  plink_1UfpxvBr8nMXOo8tYNuqNN05: "aa",  // Armed & Anchored lifetime ($39.99), current link since 2026-11-25
  plink_1TemdMBr8nMXOo8tEK01T1gs: "aa",  // Armed & Anchored ($39), retired 2026-11-25
  plink_1TYoaFBr8nMXOo8tyad1GVaT: "aa",  // Armed & Anchored, earlier link
  plink_1UcXpsBr8nMXOo8tR6UwEncI: "bundle", // Anchored Library ($79): Year 1 + Year 2 + Armed & Anchored
  plink_1UfpxxBr8nMXOo8tAeo9VukE: "both",   // Both years ($59.99): Year 1 + Year 2
};
// Fallback for checkouts without a known link: where the buyer is sent afterwards.
const HOST_APP = {
  "steps.eloraradiance.com": "as1",
  "steps2.eloraradiance.com": "as2",
  "armed.eloraradiance.com": "aa",
  "anchored-steps.vercel.app": "as1",
  "anchored-steps-year2.vercel.app": "as2",
  "anchored-steps-y2.vercel.app": "as2",
  "armedandanchored.vercel.app": "aa",
};

const APPS = ["as1", "as2", "aa", "bundle", "both"];

function appForSession(session) {
  if (session.metadata && APPS.includes(session.metadata.app)) return session.metadata.app;
  if (session.payment_link && LINK_APP[session.payment_link]) return LINK_APP[session.payment_link];
  try {
    const url = new URL(session.success_url);
    if (HOST_APP[url.host]) return HOST_APP[url.host];
    if (url.host === "eloraradiance.com" && url.pathname.startsWith("/library-welcome")) return "bundle";
  } catch (e) { /* no success url */ }
  return null;
}

// ── The Living Planner ───────────────────────────────────────────────────
// Value = free-trial days. There are no trials (removed 2026-11-14), so every link charges at checkout.
const PLANNER_LINKS = {
  plink_1UdD5iBr8nMXOo8tlAKMGtUL: 0, // Pro yearly $49.99, the only plan sold since 2026-11-18
  plink_1TWRU3Br8nMXOo8t0HFRldlV: 0, // Pro monthly $7.99, retired 2026-11-18
  plink_1TWRbmBr8nMXOo8tQiPvzLsI: 0, // Pro yearly $59.99, retired 2026-11-18
};
const PLANNER_PRODUCTS = new Set(["prod_USPtK8Gz0UkLuE", "prod_UVSUALsRwiiehH"]); // Pro monthly (retired), Pro yearly
const PLANNER_HOSTS = new Set(["planner.eloraradiance.com", "the-living-planner.vercel.app"]);
const PLANNER_URL = "https://pxvgolgwrlqzjykvzzzy.supabase.co";
// Public (anon) key: it can only call stripe_sync_subscription, which also requires the secret below.
const PLANNER_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4dmdvbGd3cmxxemp5a3Z6enp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMjQxODIsImV4cCI6MjA5MjcwMDE4Mn0.MtT8fz4P_V1yZG-T1t1pO-FZeQk4Ua8J404Mvi65ZYI";

let plannerSecret = null;
async function getPlannerSecret() {
  if (plannerSecret) return plannerSecret;
  if (process.env.PLANNER_SYNC_SECRET) return (plannerSecret = process.env.PLANNER_SYNC_SECRET);
  // Kept server-only in the shared database's app_secrets (no browser access).
  const { data, error } = await supabase.from("app_secrets").select("value").eq("name", "planner_sync_secret").maybeSingle();
  if (error || !data) throw new Error("planner_sync_secret is missing");
  return (plannerSecret = data.value);
}

async function plannerSync(payload) {
  const secret = await getPlannerSecret();
  const r = await fetch(`${PLANNER_URL}/rest/v1/rpc/stripe_sync_subscription`, {
    method: "POST",
    headers: {
      apikey: PLANNER_ANON_KEY,
      Authorization: `Bearer ${PLANNER_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_secret: secret, p: payload }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Planner sync failed (${r.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

const iso = (sec) => (sec ? new Date(sec * 1000).toISOString() : null);
const idOf = (v) => (v && typeof v === "object" ? v.id : v) || null;

function isPlannerCheckout(session) {
  if (session.payment_link && PLANNER_LINKS[session.payment_link] !== undefined) return true;
  if (session.metadata && session.metadata.app === "tlp") return true;
  try { return session.mode === "subscription" && PLANNER_HOSTS.has(new URL(session.success_url).host); } catch (e) { return false; }
}

function isPlannerSubscription(sub) {
  const items = (sub.items && sub.items.data) || [];
  return items.some((i) => PLANNER_PRODUCTS.has(idOf(i.price && i.price.product) || idOf(i.plan && i.plan.product)));
}

// What both databases store about a subscription event.
async function subscriptionPayload(sub, event) {
  const item = (sub.items && sub.items.data && sub.items.data[0]) || {};
  const price = item.price || item.plan || {};
  let email = null;
  try {
    const customer = await stripe.customers.retrieve(idOf(sub.customer));
    email = customer && !customer.deleted ? customer.email : null;
  } catch (e) { /* the email only helps link a subscription that has no account yet */ }
  return {
    source: "subscription",
    subscription_id: sub.id,
    customer_id: idOf(sub.customer),
    email,
    status: sub.status,
    price_id: price.id || null,
    interval: (price.recurring && price.recurring.interval) || price.interval || null,
    trial_end: iso(sub.trial_end),
    current_period_end: iso(sub.current_period_end || item.current_period_end),
    cancel_at_period_end: !!(sub.cancel_at_period_end || sub.cancel_at),
    event_created: iso(event.created),
  };
}

async function syncPlannerSubscription(sub, event) {
  return plannerSync(await subscriptionPayload(sub, event));
}

function checkoutPayload(session, event, trialDays = 0) {
  const email = session.customer_details?.email || session.customer_email || null;
  return {
    source: "checkout",
    subscription_id: idOf(session.subscription),
    customer_id: idOf(session.customer),
    checkout_session_id: session.id,
    client_reference_id: session.client_reference_id || null,
    email,
    status: trialDays ? "trialing" : "active",
    trial_end: trialDays ? iso(session.created + trialDays * 86400) : null,
    event_created: iso(event.created),
  };
}

async function syncPlannerCheckout(session, event) {
  if (!session.subscription) return null;
  return plannerSync(checkoutPayload(session, event, PLANNER_LINKS[session.payment_link] || 0));
}

// ── Anchored All-Access ($89.99 a year; not on sale until its payment link exists) ─────────
// The payment link must carry metadata app = "all_access". Both databases link the membership to
// the account that started checkout if it is one of theirs, otherwise to the account with the
// email paid with (now, or when that person next signs in).
const ALL_ACCESS_PRODUCTS = new Set(["prod_VeXfguJFoh7Xpy"]);

function isAllAccessCheckout(session) {
  return session.mode === "subscription" && !!session.metadata && session.metadata.app === "all_access";
}

function isAllAccessSubscription(sub) {
  const items = (sub.items && sub.items.data) || [];
  return items.some((i) => ALL_ACCESS_PRODUCTS.has(idOf(i.price && i.price.product) || idOf(i.plan && i.plan.product)));
}

// Both writes are safe to repeat, so a failure in either returns 500 and Stripe sends the event again.
async function syncAllAccess(payload) {
  const { data, error } = await supabase.rpc("membership_sync", { p: payload });
  if (error) throw new Error(`Membership sync failed: ${error.message}`);
  const planner = await plannerSync(payload);
  return { anchored: data, planner };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // Subscription changes: trial ending, renewals, failed payments, cancellations.
  if (event.type === "customer.subscription.deleted" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.created") {
    const sub = event.data.object;
    if (isAllAccessSubscription(sub)) {
      try {
        const result = await syncAllAccess(await subscriptionPayload(sub, event));
        console.log(`All-Access subscription ${sub.id} is ${sub.status}:`, JSON.stringify(result));
        return res.status(200).json({ received: true });
      } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: "Membership sync failed" }); // Stripe retries
      }
    }
    if (isPlannerSubscription(sub)) {
      try {
        const result = await syncPlannerSubscription(sub, event);
        console.log(`Living Planner subscription ${sub.id} is ${sub.status}:`, JSON.stringify(result));
        return res.status(200).json({ received: true });
      } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: "Planner sync failed" }); // Stripe retries
      }
    }
    if (event.type === "customer.subscription.created") return res.status(200).json({ received: true });
    // Year 1 subscriptions (legacy): cancellations and resumes
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

  // Access is granted once per checkout; renewal invoices are ignored.
  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  if (session.payment_status && session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return res.status(200).json({ received: true, skipped: "not paid" });
  }

  if (isAllAccessCheckout(session)) {
    if (!session.subscription) return res.status(200).json({ received: true, skipped: "no subscription" });
    try {
      const result = await syncAllAccess(checkoutPayload(session, event));
      console.log(`All-Access checkout ${session.id}:`, JSON.stringify(result));
      return res.status(200).json({ received: true });
    } catch (err) {
      console.error(err.message);
      return res.status(500).json({ error: "Membership sync failed" });
    }
  }

  if (isPlannerCheckout(session)) {
    try {
      const result = await syncPlannerCheckout(session, event);
      console.log(`Living Planner checkout ${session.id}:`, JSON.stringify(result));
      return res.status(200).json({ received: true });
    } catch (err) {
      console.error(err.message);
      return res.status(500).json({ error: "Planner sync failed" });
    }
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
  // A signed-in buyer's account id comes through as client_reference_id.
  const ref = session.client_reference_id;
  const row = { app, email: customerEmail, stripe_session_id: session.id, amount };
  if (ref && UUID.test(ref)) {
    const { data } = await supabase.auth.admin.getUserById(ref);
    if (data && data.user) row.user_id = data.user.id;
  }
  const { data: purchase, error: purchaseErr } = await supabase
    .from("purchases")
    .insert(row)
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

  // Anchored Library: one purchase opens Year 1, Year 2 and Armed & Anchored. Applied now when the
  // buyer's account is known (signed in at checkout, or an account with the email they paid with);
  // otherwise the first of the three apps they sign in to applies it (claim_purchase / aa_load_profile).
  if (app === "bundle") {
    const { data: unlocked, error } = await supabase.rpc("unlock_bundle_purchase", { p_purchase: purchase.id });
    if (error) console.error("Library unlock failed (it will apply at sign-in):", error);
    console.log(`Anchored Library purchase ${session.id}: ${unlocked ? "unlocked all three apps" : "waiting for sign-in"}`);
    return res.status(200).json({ received: true });
  }

  // Year 1, Year 2 or both years: the app applies the purchase when the buyer signs in (claim_purchase).
  console.log(`${app} purchase ${session.id} recorded${row.user_id ? " for a signed-in account" : ""}`);
  return res.status(200).json({ received: true });
};
