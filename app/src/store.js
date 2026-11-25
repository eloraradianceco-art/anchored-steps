// Apple in-app purchase for the phone app (RevenueCat), same pattern as Armed & Anchored.
//
// Turns on by itself once REVENUECAT_IOS_KEY holds this app's public RevenueCat key (starts with "appl_"; it is meant
// to ship inside the app). Until then the front page shows the years an account already owns and no buy buttons.
//
// App Store Connect (app "Anchored Steps", com.eloraradiance.anchoredsteps), three non-consumables:
//   as_year1_lifetime · as_year2_lifetime · as_both_years_lifetime
// RevenueCat: entitlements `year1` (Year 1 product + both-years product) and `year2` (Year 2 product + both-years
// product); offering `default` with three packages whose identifiers are exactly  year1 · year2 · both.
// A purchase is tied to the signed-in account (RevenueCat app user id = account id). The shared database is updated
// by the store-sync function (app = "as"), so the year also opens on the website.
import { Capacitor } from '@capacitor/core'
import { Purchases } from '@revenuecat/purchases-capacitor'

export const REVENUECAT_IOS_KEY = import.meta.env.VITE_REVENUECAT_IOS_KEY ?? ''   // public key goes here once the RevenueCat app exists
const fake = typeof window !== 'undefined' ? window.__ER_TEST_STORE__ || null : null   // browser checks only
export const PURCHASES_ON = !!fake || (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios' && /^appl_/.test(REVENUECAT_IOS_KEY))
export const ENTITLEMENT = { as1: 'year1', as2: 'year2' }

let ready = null
let signedInAs = null
export async function storeSignIn(userId) {
  if (!PURCHASES_ON || !userId) return false
  if (fake) return true
  try {
    if (!ready) ready = Purchases.configure({ apiKey: REVENUECAT_IOS_KEY, appUserID: userId }).then(() => { signedInAs = userId; return true })
    await ready
    // Also after a sign-out (signedInAs is null then): without this the next person to sign in stays anonymous in the
    // store, and Apple takes their purchase without tying it to their account.
    if (signedInAs !== userId) await Purchases.logIn({ appUserID: userId })
    signedInAs = userId
    return true
  } catch { ready = null; return false }
}
export async function storeSignOut() {
  if (!PURCHASES_ON || fake || !ready) return
  try { await ready; await Purchases.logOut() } catch { /* fails for anonymous users; nothing to undo */ }
  signedInAs = null
}

const owns = (info) => ({ as1: !!info?.entitlements?.active?.[ENTITLEMENT.as1], as2: !!info?.entitlements?.active?.[ENTITLEMENT.as2] })

// { year1, year2, both }: each { pkg, price } with Apple's own price text for this person's country. A missing
// product is simply absent; null means the store could not be reached.
export async function storeProducts(userId) {
  if (!(await storeSignIn(userId))) return null
  if (fake) return fake.products()
  try {
    const list = (await Purchases.getOfferings())?.current?.availablePackages || []
    const find = (id, re) => list.find((p) => p.identifier === id) || list.find((p) => re.test(p.product?.identifier || ''))
    const out = {}
    for (const [key, pkg] of [['year1', find('year1', /year1/i)], ['year2', find('year2', /year2/i)], ['both', find('both', /both/i)]]) {
      if (pkg) out[key] = { pkg, price: pkg.product?.priceString || '', amount: pkg.product?.price ?? null }
    }
    return out
  } catch { return null }
}

// { ok: { as1, as2 } } | 'cancelled' | 'pending' (Ask to Buy) | { error }
export async function storeBuy(userId, pkg) {
  if (!(await storeSignIn(userId))) return { error: "The App Store isn't available right now." }
  if (fake) return fake.buy(pkg)
  try {
    const r = await Purchases.purchasePackage({ aPackage: pkg })
    const o = owns(r?.customerInfo)
    return o.as1 || o.as2 ? { ok: o } : 'pending'
  } catch (e) {
    if (e?.userCancelled || String(e?.code) === '1') return 'cancelled'   // PURCHASE_CANCELLED_ERROR
    if (String(e?.code) === '20') return 'pending'                          // PAYMENT_PENDING_ERROR (Ask to Buy)
    return { error: e?.message || "The purchase didn't go through." }
  }
}

// What this Apple ID already owns, restored onto the signed-in account: { as1, as2 }, or null if unreachable
export async function storeRestore(userId) {
  if (!(await storeSignIn(userId))) return null
  if (fake) return fake.restore()
  try { return owns((await Purchases.restorePurchases())?.customerInfo) } catch { return null }
}
