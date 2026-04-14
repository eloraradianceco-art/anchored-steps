const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "AS-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function sendEmail(to, code, plan) {
  const planLabel = plan === "annual" ? "Annual" : "Weekly";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Anchored Steps <noreply@eloraradiance.com>",
      to: [to],
      subject: "Your Anchored Steps Access Code",
      html: `
        <div style="background:#0b1825;padding:40px 20px;font-family:Georgia,serif;max-width:520px;margin:0 auto;border-radius:16px;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="font-size:36px;">&#9875;</div>
            <h1 style="color:#ede3cd;font-size:22px;margin:8px 0 4px;font-family:Georgia,serif;">Anchored Steps</h1>
            <p style="color:#7e92a2;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;margin:0;">52 Weeks of Faith in Action</p>
          </div>
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(180,140,60,0.28);border-radius:12px;padding:28px;margin-bottom:24px;">
            <p style="color:#d8cfc0;font-size:16px;line-height:1.7;margin:0 0 20px;">Thank you for subscribing to Anchored Steps (${planLabel} Plan). Your unique access code is below:</p>
            <div style="background:rgba(180,140,60,0.1);border:1px solid rgba(180,140,60,0.4);border-radius:10px;padding:18px;text-align:center;margin-bottom:20px;">
              <div style="color:#7e92a2;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:8px;font-family:Georgia,serif;">Your Access Code</div>
              <div style="color:#c9a84c;font-size:28px;font-weight:bold;letter-spacing:0.15em;font-family:Georgia,serif;">${code}</div>
            </div>
            <p style="color:#7e92a2;font-size:13px;line-height:1.6;margin:0 0 20px;">Keep this code safe — you will need it to create your account. Each code can only be used once.</p>
            <div style="text-align:center;">
              <a href="https://anchored-steps.vercel.app" style="display:inline-block;background:linear-gradient(135deg,rgba(180,140,60,0.4),rgba(180,140,60,0.2));border:1px solid rgba(180,140,60,0.5);color:#c9a84c;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:14px;letter-spacing:0.08em;font-family:Georgia,serif;">Open Your Journal &#8594;</a>
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

  // Handle cancellations
  if (event.type === "customer.subscription.deleted" ||
      event.type === "customer.subscription.updated") {
    const sub = event.data.object;
    if (sub.status === "canceled" || sub.cancel_at_period_end) {
      const customerId = sub.customer;
      // Get customer email
      const customer = await stripe.customers.retrieve(customerId);
      const email = customer.email;
      if (email) {
        // Mark subscription as canceled in Supabase
        await supabase
          .from("profiles")
          .update({ subscription_status: "canceled" })
          .eq("email", email);
        console.log(`Canceled subscription for ${email}`);
      }
    }
    // Re-activate if subscription resumes
    if (event.type === "customer.subscription.updated" && sub.status === "active") {
      const customer = await stripe.customers.retrieve(sub.customer);
      if (customer.email) {
        await supabase
          .from("profiles")
          .update({ subscription_status: "active" })
          .eq("email", customer.email);
      }
    }
    return res.status(200).json({ received: true });
  }

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "invoice.payment_succeeded"
  ) {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const customerEmail =
    session.customer_email || session.customer_details?.email;

  if (!customerEmail) {
    console.error("No customer email found");
    return res.status(200).json({ received: true });
  }

  // Determine plan from amount
  const amount = session.amount_total || session.amount_paid;
  const plan = amount <= 200 ? "weekly" : "annual";

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
    if (!data) break;
    attempts++;
  }

  // Save to Supabase (customer_email triggers the email via database trigger)
  const { error: insertError } = await supabase
    .from("access_codes")
    .insert({ code, plan, used: false, customer_email: customerEmail });

  if (insertError) {
    console.error("Failed to insert code:", insertError);
    return res.status(500).json({ error: "Failed to create access code" });
  }

  // Send email via Resend
  try {
    await sendEmail(customerEmail, code, plan);
    console.log(`Code ${code} sent to ${customerEmail}`);
  } catch (emailErr) {
    console.error("Email failed:", emailErr);
  }

  return res.status(200).json({ received: true });
};
