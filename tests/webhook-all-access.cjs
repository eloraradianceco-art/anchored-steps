// The Stripe webhook's routing, with Stripe, the database and the planner database replaced by stand-ins.
// Run: node tests/webhook-all-access.cjs
const Module = require('module')
const calls = { rpc: [], planner: [], inserts: [] }
let failPlanner = false
const fakeSupabase = {
  rpc: async (name, args) => { calls.rpc.push({ name, args }); return { data: { linked: true, active: true }, error: null } },
  from: (table) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'app_secrets' ? { value: 'test-secret' } : null, error: null }) }) }),
    insert: (row) => { calls.inserts.push({ table, row }); return { select: () => ({ single: async () => ({ data: { id: 'p1' }, error: null }) }) } },
    update: () => ({ eq: async () => ({}) }),
    upsert: async () => ({ error: null }),
  }),
  auth: { admin: { getUserById: async () => ({ data: null }) } },
}
class FakeStripe {
  constructor() { this.webhooks = { constructEvent: (raw) => JSON.parse(raw.toString()) }; this.customers = { retrieve: async () => ({ email: 'Member@Example.com' }) } }
}
const realLoad = Module._load
Module._load = function (request, ...rest) {
  if (request === 'stripe') return FakeStripe
  if (request === '@supabase/supabase-js') return { createClient: () => fakeSupabase }
  return realLoad.call(this, request, ...rest)
}
process.env.STRIPE_SECRET_KEY = 'sk_test_x'; process.env.VITE_SUPABASE_URL = 'http://x'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'; process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x'
global.fetch = async (url, opts) => {
  calls.planner.push(JSON.parse(opts.body))
  return failPlanner ? { ok: false, status: 500, text: async () => 'down' } : { ok: true, status: 200, text: async () => JSON.stringify({ linked: false, tier: null }) }
}
const handler = require('../api/webhook.js')
const send = async (event) => {
  calls.rpc.length = 0; calls.planner.length = 0; calls.inserts.length = 0
  const req = { method: 'POST', headers: { 'stripe-signature': 's' }, async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(event)) } }
  let out = {}; const res = { status: (c) => ({ json: (b) => { out = { code: c, body: b } } }) }
  await handler(req, res); return out
}
const results = []; const check = (n, ok, x = '') => results.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : ''))
const sub = (product, status = 'active') => ({ id: 'sub_1', customer: 'cus_1', status, items: { data: [{ price: { id: 'price_1', product, recurring: { interval: 'year' } }, current_period_end: 1826000000 }] } })
;(async () => {
  // All-Access checkout
  let r = await send({ type: 'checkout.session.completed', created: 1795000000, data: { object: { id: 'cs_1', mode: 'subscription', payment_status: 'paid', subscription: 'sub_1', customer: 'cus_1', client_reference_id: '11111111-2222-3333-4444-555555555555', customer_details: { email: 'member@example.com' }, metadata: { app: 'all_access' }, success_url: 'https://eloraradiance.com/welcome' } } })
  const m = calls.rpc.find((c) => c.name === 'membership_sync')
  check('All-Access checkout → membership recorded here', r.code === 200 && !!m && m.args.p.source === 'checkout' && m.args.p.subscription_id === 'sub_1' && m.args.p.email === 'member@example.com' && m.args.p.checkout_session_id === 'cs_1')
  check('All-Access checkout → same subscription sent to the planner database', calls.planner.length === 1 && calls.planner[0].p.subscription_id === 'sub_1' && calls.planner[0].p_secret === 'test-secret')
  check('All-Access checkout is not recorded as a one-time purchase', calls.inserts.length === 0)
  // All-Access renewal / cancel
  r = await send({ type: 'customer.subscription.updated', created: 1795000100, data: { object: sub('prod_VeXfguJFoh7Xpy') } })
  check('All-Access renewal → both databases, with period end', r.code === 200 && calls.rpc[0]?.args.p.current_period_end && calls.planner[0]?.p.status === 'active' && calls.rpc[0].args.p.email === 'Member@Example.com')
  r = await send({ type: 'customer.subscription.deleted', created: 1795000200, data: { object: sub('prod_VeXfguJFoh7Xpy', 'canceled') } })
  check('All-Access cancellation → both databases', r.code === 200 && calls.rpc[0]?.args.p.status === 'canceled' && calls.planner[0]?.p.status === 'canceled')
  // Planner database down → Stripe is asked to retry
  failPlanner = true
  r = await send({ type: 'customer.subscription.updated', created: 1795000300, data: { object: sub('prod_VeXfguJFoh7Xpy') } })
  check('Planner database unreachable → 500 so Stripe retries', r.code === 500)
  failPlanner = false
  // Planner Pro alone is unchanged: planner only, no membership
  r = await send({ type: 'customer.subscription.updated', created: 1795000400, data: { object: sub('prod_UVSUALsRwiiehH') } })
  check('Planner Pro subscription → planner only', r.code === 200 && calls.planner.length === 1 && !calls.rpc.some((c) => c.name === 'membership_sync'))
  r = await send({ type: 'checkout.session.completed', created: 1795000500, data: { object: { id: 'cs_2', mode: 'subscription', payment_status: 'paid', subscription: 'sub_2', customer: 'cus_2', payment_link: 'plink_1UdD5iBr8nMXOo8tlAKMGtUL', metadata: { app: 'tlp' }, customer_details: { email: 'p@example.com' } } } })
  check('Planner Pro $49.99 checkout → planner only, active (no trial)', r.code === 200 && calls.planner[0]?.p.status === 'active' && calls.planner[0]?.p.trial_end === null && !calls.rpc.some((c) => c.name === 'membership_sync'))
  // Lifetime purchases unchanged
  r = await send({ type: 'checkout.session.completed', created: 1795000600, data: { object: { id: 'cs_3', mode: 'payment', payment_status: 'paid', payment_link: 'plink_1UcXpsBr8nMXOo8tR6UwEncI', customer_details: { email: 'L@example.com' }, amount_total: 7900 } } })
  check('Anchored Library purchase → recorded and unlocked as before', r.code === 200 && calls.inserts[0]?.row.app === 'bundle' && calls.rpc.some((c) => c.name === 'unlock_bundle_purchase') && calls.planner.length === 0)
  // Prices of 2026-11-25: new $39.99 links (recognised by the link's metadata, by its id, or by where it returns), and both years in one purchase
  const paid = (id, o) => ({ type: 'checkout.session.completed', created: 1795650700, data: { object: { id, mode: 'payment', payment_status: 'paid', customer_details: { email: 'B@example.com' }, ...o } } })
  r = await send(paid('cs_4', { payment_link: 'plink_1UfpxxBr8nMXOo8tAeo9VukE', metadata: { app: 'both' }, amount_total: 5999, success_url: 'https://steps.eloraradiance.com/?paid=true&session_id=cs_4' }))
  check('Both years purchase → one row with app "both", $59.99, nothing unlocked for other apps', r.code === 200 && calls.inserts.length === 1 && calls.inserts[0].row.app === 'both' && calls.inserts[0].row.amount === 5999 && calls.inserts[0].row.email === 'b@example.com' && !calls.rpc.some((c) => c.name === 'unlock_bundle_purchase') && calls.planner.length === 0)
  r = await send(paid('cs_5', { payment_link: 'plink_1UfpxxBr8nMXOo8tAeo9VukE', amount_total: 5999, success_url: 'https://steps.eloraradiance.com/?paid=true&session_id=cs_5' }))
  check('Both years purchase without metadata → still "both" (by link id), not Year 1', calls.inserts[0]?.row.app === 'both')
  r = await send(paid('cs_6', { payment_link: 'plink_1UfpxsBr8nMXOo8t6fyzRtHX', metadata: { app: 'as1' }, amount_total: 3999 }))
  check('Year 1 $39.99 link → as1', calls.inserts[0]?.row.app === 'as1' && calls.inserts[0].row.amount === 3999)
  r = await send(paid('cs_7', { payment_link: 'plink_1UfpxtBr8nMXOo8ty4uLNZMS', amount_total: 3999 }))
  check('Year 2 $39.99 link → as2', calls.inserts[0]?.row.app === 'as2')
  r = await send(paid('cs_8', { payment_link: 'plink_1UfpxvBr8nMXOo8tYNuqNN05', amount_total: 3999 }))
  check('Armed & Anchored $39.99 link → aa', calls.inserts[0]?.row.app === 'aa')
  r = await send(paid('cs_9', { payment_link: 'plink_1TekXdBr8nMXOo8tIeA9z5Gh', amount_total: 3900 }))
  check('A checkout still open on the retired $39 Year 1 link → as1', calls.inserts[0]?.row.app === 'as1')
  console.log(results.join('\n')); process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0)
})()
