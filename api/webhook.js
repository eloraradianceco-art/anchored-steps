import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Generate a unique access code
function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "AS-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).json({ error: "Webhook signature failed" });
  }

  // Only handle successful payments
  if (event.type !== "checkout.session.completed" &&
      event.type !== "invoice.payment_succeeded") {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const customerEmail = session.customer_email ||
    session.customer_details?.email;

  if (!customerEmail) {
    console.error("No customer email found");
    return res.status(200).json({ received: true });
  }

  // Determine plan from price/amount
  const amount = session.amount_total || session.amount_paid;
  const plan = amount <= 200 ? "weekly" : "annual"; // $1.50 = 150 cents, $39 = 3900 cents

  // Generate unique code
  let code;
  let attempts = 0;
  while (attempts < 10) {
    code = generateCode();
    const { data } = await supabase
      .from("access_codes")
      .select("code")
      .eq("code", code)
      .single();
    if (!data) break; // Code is unique
    attempts++;
  }

  // Save code to Supabase
  const { error: insertError } = await supabase
    .from("access_codes")
    .insert({
      code,
      plan,
      used: false,
    });

  if (insertError) {
    console.error("Failed to insert code:", insertError);
    return res.status(500).json({ error: "Failed to create access code" });
  }

  console.log(`Created code ${code} for ${customerEmail} (${plan})`);
  return res.status(200).json({ received: true, code });
}

// Helper to get raw body for Stripe signature verification
async function buffer(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}
