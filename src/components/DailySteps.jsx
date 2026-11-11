import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

/* ─────────────────────────────────────────────────────────────
   ANCHORED STEPS — DAILY STEPS
   Seven short steps per week, one opening each day (missed ones
   stay open). Reads the same week content as the journal and saves
   into the same journal_entries keys:
     Read → vm_pr · Word study → lexicon · Memorize → mem_<ref>
     Reflect → rf0–rf3 · Apply → apply · Pray → prayer
     Review → er0–er2 · Daily tracker → tr_0–tr_6
   Step progress: ds_1–ds_7 (date done), ds_start, ds_rq, ds_carry,
   ds_match, ds_mem.
   Testing: add ?steps=all to the URL to open every step.
   ───────────────────────────────────────────────────────────── */

const NUM = ["zero", "one", "two", "three", "four", "five", "six", "seven"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MILESTONES = [13, 26, 39, 52];
const STOP = new Set(("the and that this with from have will your you for are was were but not his her him they them their there then than into unto upon who whom which what when where shall been being also even very more most over under about because through those these every other should would could might must said says thee thou thine hath").split(" "));

/* ---------- helpers ---------- */
const pad = n => String(n).padStart(2, "0");
const localDay = (d = new Date()) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
function dayDiff(a, b) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}
function addDays(a, n) { const [y, m, d] = a.split("-").map(Number); return new Date(y, m - 1, d + n); }
function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; } return b; }
const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
const shortRef = r => String(r || "").replace(/\s*\([^)]*\)\s*$/, "");
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LETTERS = "A-Za-z\u00C0-\u024F'";
const cleanWord = t => t.replace(new RegExp("^[^" + LETTERS + "]+|[^" + LETTERS + "]+$", "g"), "");
const excerpt = s => { s = String(s || "").trim(); return s.length > 180 ? s.slice(0, 177).trim() + "\u2026" : s; };

function chunkVerse(text) {
  const words = String(text).trim().split(/\s+/);
  if (words.length <= 7) return words;
  const phrases = []; let cur = [];
  words.forEach(w => { cur.push(w); if (/[,;:.!?\u2014\u2013]["'\u201D\u2019)]*$/.test(w)) { phrases.push(cur); cur = []; } });
  if (cur.length) phrases.push(cur);
  const out = [];
  phrases.forEach(p => {
    let i = 0;
    while (i < p.length) {
      const rem = p.length - i;
      const size = rem <= 3 ? rem : rem === 4 ? 2 : 3;
      out.push(p.slice(i, i + size).join(" "));
      i += size;
    }
  });
  return out;
}

function makeBlanks(week) {
  const text = week.scriptures[0].text;
  const tokens = text.split(/\s+/);
  const lower = tokens.map(t => cleanWord(t).toLowerCase());
  const picks = [];
  const clash = (s, l) => picks.some(p => s <= p.start + p.len && s + l >= p.start);
  (week.keywords || "").split(",").map(k => k.trim().toLowerCase()).filter(Boolean).forEach(k => {
    if (picks.length >= 2) return;
    const kw = k.split(/\s+/);
    for (let i = 0; i + kw.length <= lower.length; i++) {
      if (kw.every((x, j) => lower[i + j] === x) && !clash(i, kw.length)) { picks.push({ start: i, len: kw.length }); break; }
    }
  });
  lower.map((w, i) => ({ w, i }))
    .filter(o => o.w.length >= 5 && !STOP.has(o.w))
    .sort((a, b) => b.w.length - a.w.length)
    .forEach(o => { if (picks.length < 2 && !clash(o.i, 1)) picks.push({ start: o.i, len: 1 }); });
  picks.sort((a, b) => a.start - b.start);

  const inVerse = new Set(lower);
  const pool = [];
  const addPool = w => {
    const c = String(w || "").trim(); const lc = c.toLowerCase();
    if (lc.length < 4 || STOP.has(lc) || lc.split(/\s+/).some(x => inVerse.has(x))) return;
    if (!pool.some(p => p.toLowerCase() === lc)) pool.push(c);
  };
  (week.keywords || "").split(",").forEach(k => addPool(k.trim().toLowerCase()));
  (week.lexicon || []).forEach(l => addPool(l.word));
  week.scriptures.slice(1).forEach(s => s.text.split(/\s+/).map(cleanWord).filter(w => w.length >= 5).forEach(w => addPool(w.toLowerCase())));
  ["grace", "mercy", "glory", "strength", "wisdom", "promise", "kingdom"].forEach(addPool);

  const leadRe = new RegExp("^[^" + LETTERS + "]*");
  const trailRe = new RegExp("[^" + LETTERS + "]*$");
  const blanks = picks.map(p => {
    const answer = tokens.slice(p.start, p.start + p.len).map(cleanWord).join(" ");
    const cap = /^[A-Z]/.test(answer);
    const fit = w => (cap ? w.charAt(0).toUpperCase() + w.slice(1) : w);
    const distract = shuffle(pool.filter(w => w.toLowerCase() !== answer.toLowerCase())).slice(0, 2).map(fit);
    return {
      ...p,
      lead: tokens[p.start].match(leadRe)[0],
      trail: tokens[p.start + p.len - 1].match(trailRe)[0],
      answer,
      opts: shuffle([answer, ...distract]),
    };
  });
  return { tokens, blanks };
}

const prayerLines = t => (String(t || "").match(/[^.!?]+[.!?]+["'\u201D\u2019)]*/g) || [String(t || "")]).map(s => s.trim()).filter(Boolean);

function makeHl(week) {
  const terms = [...String(week.keywords || "").split(","), ...(week.lexicon || []).map(l => l.word)]
    .map(s => String(s || "").trim()).filter(s => s.length >= 3);
  if (!terms.length) return t => t;
  const re = new RegExp("\\b(" + terms.sort((a, b) => b.length - a.length).map(escRe).join("|") + ")\\b", "gi");
  return t => String(t || "").split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

function speakText(text) {
  try {
    const s = window.speechSynthesis;
    if (!s || !window.SpeechSynthesisUtterance) return false;
    s.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.9; s.speak(u); return true;
  } catch (e) { return false; }
}
const hush = () => { try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {} };

/* ---------- icons ---------- */
const Anchor = () => (<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="24" cy="8.5" r="4" /><path d="M24 12.5V41" /><path d="M16 19h16" /><path d="M8 28c0 8 7 13 16 13s16-5 16-13" /><path d="M5 31l3-3 3 3M37 31l3-3 3 3" /></svg>);
const Check = () => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
const Close = () => (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>);
const Flame = () => (<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.6 2.5c.5 2.9 2.4 4.4 3.9 6.3 1.2 1.5 1.9 3.2 1.9 5.1A6.4 6.4 0 0 1 12 20.3a6.4 6.4 0 0 1-6.4-6.4c0-2.3 1.1-4 2.6-5.3.1 1.7.8 2.9 2 3.6-.3-3.7 1-6.9 2.4-9.7z" /></svg>);
const Speaker = () => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></svg>);

/* ---------- blank-verse renderer ---------- */
function BlankVerse({ data, filled }) {
  const out = []; let i = 0;
  const { tokens, blanks } = data;
  while (i < tokens.length) {
    const bi = blanks.findIndex(b => b.start === i);
    if (bi > -1) {
      const b = blanks[bi];
      out.push(<span key={"b" + i}>{b.lead}<span className={"ds-blank" + (bi === filled ? " is-active" : "")}>{bi < filled ? b.answer : "\u00A0"}</span>{b.trail} </span>);
      i += b.len;
    } else { out.push(tokens[i] + " "); i++; }
  }
  return <p className="ds-blank-verse">{out}</p>;
}

/* ---------- step definitions (generated from the week's content) ---------- */
function buildSteps(week) {
  const lex = week.lexicon || [];
  const v0 = week.scriptures[0];
  const chunks = chunkVerse(v0.text);
  const bl = makeBlanks(week);
  const lines = prayerLines(week.prayerPrompt);
  const prompts = week.reflectionPrompts || [];
  const ends = week.endReflections || [];
  const langs = [...new Set(lex.map(l => l.language).filter(Boolean))];
  const lexBlurb = (NUM[lex.length] ? NUM[lex.length].charAt(0).toUpperCase() + NUM[lex.length].slice(1) : lex.length) +
    " words from the original " + (langs.length === 1 ? langs[0] : "languages");

  const verseCard = (i, kicker) => ({
    render: c => {
      const s = week.scriptures[i];
      return (<>
        <p className="ds-kicker">{kicker || "Passage " + (i + 1) + " of " + week.scriptures.length}</p>
        <blockquote className="ds-verse">{c.hl(s.text)}</blockquote>
        <p className="ds-ref">{s.ref}</p>
        <button className="ds-chip" onClick={() => c.speak(s.text)}><Speaker />Listen</button>
      </>);
    },
  });

  const textCard = (key, q, hint, ph, extra = {}) => ({
    top: true,
    ...extra,
    ready: c => !!String(c.val(typeof key === "function" ? key(c) : key) || "").trim(),
    render: c => {
      const k = typeof key === "function" ? key(c) : key;
      const title = typeof q === "function" ? q(c) : q;
      return (<>
        {extra.kicker && <p className="ds-kicker">{extra.kicker}</p>}
        <h2 className="ds-q">{title}</h2>
        {hint && <p className="ds-hint">{hint}</p>}
        <textarea className="ds-textarea" rows={extra.rows || 5} value={c.val(k)} placeholder={ph} aria-label={title}
          onChange={e => c.put(k, e.target.value)} />
      </>);
    },
  });

  const lexCard = i => ({
    ready: c => !!c.u.seen,
    render: c => {
      const w = lex[i], f = !!c.u.flipped;
      return (<>
        <p className="ds-kicker">Word {i + 1} of {lex.length}</p>
        <button className={"ds-flip" + (f ? " is-flipped" : "")} aria-pressed={f} onClick={() => c.setU({ ...c.u, flipped: !f, seen: true })}>
          {!f ? (<>
            <span className="ds-flip-word">{w.word}</span>
            {w.original && <span className="ds-flip-orig">{w.original}</span>}
            <span className="ds-flip-hint">Tap to see what it means</span>
          </>) : (<>
            <span className="ds-flip-word is-small">{w.word}</span>
            <span className="ds-flip-mean">{w.meaning}</span>
            {w.note && <span className="ds-flip-note">{w.note}</span>}
          </>)}
        </button>
      </>);
    },
  });

  const matchCard = {
    top: true,
    cta: "Continue",
    init: () => ({ order: shuffle(lex.map((_, i) => i)), ok: [], sel: null, tries: 0, bad: null }),
    ready: c => !!c.u.ok && c.u.ok.length === lex.length,
    render: c => {
      const u = c.u; const done = u.ok.length === lex.length;
      const pickW = i => c.setU({ ...u, sel: i, bad: null });
      const pickM = i => {
        if (u.sel == null) return;
        const tries = u.tries + 1;
        if (i === u.sel) {
          const ok = [...u.ok, i];
          c.setU({ ...u, ok, sel: null, tries, bad: null });
          if (ok.length === lex.length) c.set("ds_match", String(tries));
        } else {
          const bad = { w: u.sel, m: i };
          c.setU({ ...u, sel: null, tries, bad });
          setTimeout(() => c.setU(p => (p.bad === bad ? { ...p, bad: null } : p)), 650);
        }
      };
      const hint = done ? "All " + NUM[lex.length] + " matched in " + plural(u.tries, "try", "tries") + "." : u.sel == null ? "Tap a word first." : "Now tap its meaning.";
      return (<>
        <h2 className="ds-q">Match each word to its meaning.</h2>
        <p className="ds-hint" aria-live="polite">{hint}</p>
        <div className="ds-words">
          {lex.map((w, i) => {
            const ok = u.ok.includes(i);
            return <button key={i} className={"ds-w" + (ok ? " is-ok" : "") + (u.sel === i ? " is-sel" : "") + (u.bad && u.bad.w === i ? " is-bad" : "")}
              disabled={ok} aria-pressed={u.sel === i} onClick={() => pickW(i)}>{w.word}</button>;
          })}
        </div>
        {u.order.map(i => {
          const ok = u.ok.includes(i);
          return <button key={i} className={"ds-m" + (ok ? " is-ok" : "") + (u.bad && u.bad.m === i ? " is-bad" : "")} disabled={ok} onClick={() => pickM(i)}>
            {ok && <span className="ds-tag">{lex[i].word}</span>}{shortMeaning(lex[i].meaning)}
          </button>;
        })}
      </>);
    },
  };

  const scrambleCard = {
    top: true,
    init: () => {
      let o; let guard = 0;
      do { o = shuffle(chunks.map((_, i) => i)); guard++; } while (chunks.length > 1 && guard < 20 && o.every((v, i) => chunks[v] === chunks[i]));
      return { order: o, placed: [], miss: 0, bad: null };
    },
    ready: c => !!c.u.placed && c.u.placed.length === chunks.length,
    render: c => {
      const u = c.u; const done = u.placed.length === chunks.length;
      const tap = i => {
        if (chunks[i] === chunks[u.placed.length]) {
          const placed = [...u.placed, i];
          c.setU({ ...u, placed, bad: null });
          if (placed.length === chunks.length) c.set("ds_mem", String(u.miss));
        } else {
          c.setU({ ...u, miss: u.miss + 1, bad: i });
          setTimeout(() => c.setU(p => (p.bad === i ? { ...p, bad: null } : p)), 450);
        }
      };
      return (<>
        <h2 className="ds-q">Rebuild the verse.</h2>
        <p className="ds-hint" aria-live="polite">{done ? "Rebuilt with " + plural(u.miss, "miss", "misses") + "." : "Tap the phrases in order."}</p>
        <p className={"ds-built" + (done ? " is-complete" : "")}>{u.placed.map(i => chunks[i]).join(" ")}{!done && <span className="ds-slot" aria-hidden="true" />}</p>
        <p className="ds-ref">{v0.ref}</p>
        <div className="ds-chunks">
          {u.order.filter(i => !u.placed.includes(i)).map(i => (
            <button key={i} className={"ds-chunk" + (u.bad === i ? " is-bad" : "")} onClick={() => tap(i)}>{chunks[i]}</button>
          ))}
        </div>
      </>);
    },
  };

  const blanksCard = {
    top: true,
    init: () => ({ k: 0, bad: null }),
    ready: c => c.u.k >= bl.blanks.length,
    render: c => {
      const u = c.u; const cur = bl.blanks[u.k];
      const pick = o => {
        if (o === cur.answer) c.setU({ ...u, k: u.k + 1, bad: null });
        else { c.setU({ ...u, bad: o }); setTimeout(() => c.setU(p => (p.bad === o ? { ...p, bad: null } : p)), 450); }
      };
      return (<>
        <h2 className="ds-q">Fill in what{"\u2019"}s missing.</h2>
        <p className="ds-hint" aria-live="polite">{cur ? (bl.blanks.length > 1 ? "Blank " + (u.k + 1) + " of " + bl.blanks.length + "." : "Choose the missing word.") : "That\u2019s the verse."}</p>
        <BlankVerse data={bl} filled={u.k} />
        <p className="ds-ref">{v0.ref}</p>
        {cur && <div className="ds-chunks">{cur.opts.map(o => (
          <button key={o} className={"ds-chunk" + (u.bad === o ? " is-bad" : "")} onClick={() => pick(o)}>{o}</button>
        ))}</div>}
      </>);
    },
  };

  const recapCard = {
    top: true,
    cta: "Set the anchor",
    render: c => {
      const item = (title, body, day) => (
        <div className="ds-rc" key={title}><h3>{title}</h3>{body ? <p>{body}</p> : <p className="is-empty">Not done yet. It{"\u2019"}s part of day {day}.</p>}</div>
      );
      const rq = c.val("ds_rq"), carry = c.val("ds_carry");
      const match = c.get("ds_match"), mem = c.get("ds_mem"), memorized = c.get("mem_" + v0.ref) === "1";
      const stood = excerpt(c.val("vm_pr")), refl = rq !== "" ? excerpt(c.val("rf" + rq)) : "";
      const plan = excerpt(c.val("apply")), prayer = excerpt(c.val("prayer"));
      return (<>
        <h2 className="ds-q">Your week, in your words.</h2>
        {item("What stood out", stood && "\u201C" + stood + "\u201D", 1)}
        {item("Word study", match ? "Matched all " + NUM[lex.length] + " words in " + plural(+match, "try", "tries") + "." : excerpt(c.val("lexicon")), 2)}
        {item("Memorize", memorized ? shortRef(v0.ref) + " is memorized" + (mem !== "" ? " (" + plural(+mem, "miss", "misses") + " while rebuilding)." : ".") : "", 3)}
        {item("Your reflection", refl && <><em>{prompts[+rq]}</em><br />{refl}</>, 4)}
        {item("Your plan", plan && <>{plan}{carry !== "" && week.scriptures[+carry] && <> <span className="ds-by">carried by</span> {shortRef(week.scriptures[+carry].ref)}</>}</>, 5)}
        {item("Prayer", prayer || (c.get("ds_6") ? "Prayed through this week\u2019s prayer." : ""), 6)}
      </>);
    },
  };

  const memCards = [verseCard(0, "Read it twice. Out loud if you can."), scrambleCard];
  if (bl.blanks.length) memCards.push(blanksCard);
  memCards[memCards.length - 1] = { ...memCards[memCards.length - 1], cta: "Finish step" };

  return [
    { id: 1, name: "Read", blurb: "Three passages and the study notes", min: 4, cards: [
      verseCard(0), verseCard(1), verseCard(2),
      { top: true,
        render: c => {
          const ps = String(week.studyNotes || "").split(/\n\s*\n/).filter(Boolean);
          const sh = c.u.more ? ps : ps.slice(0, 2);
          return (<>
            <p className="ds-kicker">Study notes</p>
            <div className="ds-notes">{sh.map((p, i) => <p key={i}>{p}</p>)}</div>
            {!c.u.more && ps.length > 2 && <button className="ds-link ds-left" onClick={() => c.setU({ ...c.u, more: true })}>Read all the notes</button>}
          </>);
        } },
      textCard("vm_pr", "What stood out to you in these passages?", "One sentence is enough. You\u2019ll see it again on day 7.", "Write the line, and why it caught you.", { rows: 4, skip: true, cta: "Finish step" }),
    ] },
    { id: 2, name: "Word study", blurb: lexBlurb, min: 5, cards: [
      ...lex.map((_, i) => lexCard(i)),
      matchCard,
      textCard("lexicon", "Which word stood out, and why does it matter?", "Optional. A line or two is plenty.", "The word that stayed with me\u2026", { rows: 4, skip: true, cta: "Finish step" }),
    ] },
    { id: 3, name: "Memorize", blurb: "Rebuild " + shortRef(v0.ref), min: 5, cards: memCards,
      onComplete: c => c.set("mem_" + v0.ref, "1") },
    { id: 4, name: "Reflect", blurb: "One question, answered honestly", min: 6, cards: [
      { top: true,
        ready: c => c.val("ds_rq") !== "",
        render: c => (<>
          <h2 className="ds-q">Pick the question you need today.</h2>
          {prompts.map((p, i) => {
            const sel = c.val("ds_rq") === String(i);
            const answered = !!String(c.get("rf" + i) || "").trim();
            return <button key={i} className={"ds-opt" + (sel ? " is-sel" : "")} aria-pressed={sel} onClick={() => c.put("ds_rq", String(i))}>
              {answered && <small>You{"\u2019"}ve written on this one</small>}{p}
            </button>;
          })}
        </>) },
      textCard(c => "rf" + (c.val("ds_rq") || "0"), c => prompts[+(c.val("ds_rq") || 0)], null, "Write what\u2019s true for you, not what sounds right.", { rows: 7, kicker: "Your question" }),
      { cta: "Finish step",
        render: c => (<>
          <p className="ds-kicker">Whatever you wrote, this is still true</p>
          <blockquote className="ds-verse">{c.hl(week.dailyConfession)}</blockquote>
          <p className="ds-hint">Say it once before you close the app.</p>
        </>) },
    ] },
    { id: 5, name: "Apply", blurb: "Choose how you\u2019ll live it out", min: 5, cards: [
      { render: () => (<>
          <p className="ds-kicker">This week{"\u2019"}s two challenges</p>
          {[week.applicationChallenge, week.renewalChallenge].filter(Boolean).map((ch, i) => (
            <div key={i} className="ds-chal"><h3>{ch.title}</h3><p>{ch.text}</p></div>
          ))}
        </>) },
      textCard("apply", "How will you live this out this week?", "Be specific: when, where, and with whom.", "This week I will\u2026", { rows: 5 }),
      { top: true,
        ready: c => c.val("ds_carry") !== "",
        render: c => (<>
          <h2 className="ds-q">Choose the verse you{"\u2019"}ll carry.</h2>
          {week.scriptures.map((s, i) => {
            const sel = c.val("ds_carry") === String(i);
            return <button key={i} className={"ds-opt" + (sel ? " is-sel" : "")} aria-pressed={sel} onClick={() => c.put("ds_carry", String(i))}><small>{s.ref}</small>{s.text}</button>;
          })}
        </>) },
      { cta: "Commit to it",
        render: c => {
          const s = week.scriptures[+(c.val("ds_carry") || 0)] || v0;
          return (<>
            <div className="ds-trade">
              <p className="ds-tlabel">Your plan</p>
              <p className="ds-plan">{c.val("apply")}</p>
              <div className="ds-tdiv" />
              <p className="ds-tlabel">Your verse</p>
              <blockquote className="ds-truth">{c.hl(s.text)}</blockquote>
              <p className="ds-ref ds-flush">{s.ref}</p>
            </div>
            <p className="ds-hint ds-after">Take a screenshot and keep it where you{"\u2019"}ll see it this week.</p>
          </>);
        } },
    ] },
    { id: 6, name: "Pray", blurb: "Pray the week\u2019s prayer, slowly", min: 4, cards: [
      { top: true,
        init: () => ({ line: 0 }),
        next: c => { if (c.u.line < lines.length - 1) { c.setU({ ...c.u, line: c.u.line + 1 }); return true; } return false; },
        cta: c => (c.u.line < lines.length - 1 ? "Next line" : "Continue"),
        render: c => (<>
          <p className="ds-kicker">One line at a time. Pause between each.</p>
          <div className="ds-pray">{lines.slice(0, c.u.line + 1).map((l, i) => <p key={i} className={i < c.u.line ? "is-past" : ""}>{l}</p>)}</div>
        </>) },
      { ready: c => !!c.u.said,
        render: c => (<>
          <p className="ds-kicker">Say it out loud</p>
          <blockquote className="ds-verse">{c.hl(week.dailyConfession)}</blockquote>
          <button className={"ds-chip" + (c.u.said ? " is-on" : "")} aria-pressed={!!c.u.said} onClick={() => c.setU({ ...c.u, said: !c.u.said })}>
            {c.u.said ? <><Check />Said it</> : "I said it"}
          </button>
        </>) },
      textCard("prayer", "Write your own prayer.", "Optional. Bring your heart before God in your own words.", "Speak freely to Him here\u2026", { rows: 7, skip: true, cta: "Finish step" }),
    ] },
    { id: 7, name: "Review", blurb: "Look back and set the anchor", min: 6, cards: [
      { top: true,
        ready: c => ends.some((_, i) => String(c.val("er" + i) || "").trim()),
        render: c => (<>
          <h2 className="ds-q">Look back on the week.</h2>
          <p className="ds-hint">Answer the ones that land. One is enough.</p>
          {ends.map((q, i) => (
            <label key={i} className="ds-er"><span>{q}</span>
              <textarea className="ds-textarea" rows={3} value={c.val("er" + i)} onChange={e => c.put("er" + i, e.target.value)} />
            </label>
          ))}
        </>) },
      recapCard,
    ] },
  ];
}

function shortMeaning(m) {
  let s = String(m || "").trim();
  const dot = s.indexOf(". ");
  if (dot > 20) s = s.slice(0, dot + 1);
  if (s.length > 130) { s = s.slice(0, 127); s = s.slice(0, s.lastIndexOf(" ")) + "\u2026"; }
  return s;
}

/* ─────────────────────────────────────────────────────────────
   COMPONENT
   ───────────────────────────────────────────────────────────── */
export default function DailySteps({ week, wk, totalWeeks = 52, entries = [], get, set, streak = 0, darkMode = true, onOpenWeek, onGoWeek }) {
  const steps = useMemo(() => buildSteps(week), [week]);
  const hl = useMemo(() => makeHl(week), [week]);
  const [session, setSession] = useState(null);   // { step, card }
  const [u, setU] = useState({});
  const [draft, setDraft] = useState({});
  const [done, setDone] = useState(null);          // { step, from }
  const [toast, setToast] = useState("");
  const ovRef = useRef(null);
  const ringRef = useRef(null);
  const closeRef = useRef(null);
  const unlockAll = useMemo(() => { try { return new URLSearchParams(window.location.search).get("steps") === "all"; } catch (e) { return false; } }, []);

  const theme = "ds-root " + (darkMode ? "ds-dark" : "ds-light");
  const today = localDay();

  /* ---- values: drafts first, then saved ---- */
  const val = k => (Object.prototype.hasOwnProperty.call(draft, k) ? draft[k] : get(k));
  const put = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const commit = () => {
    Object.keys(draft).forEach(k => { if (draft[k] !== get(k)) set(k, draft[k]); });
    setDraft({});
  };

  /* ---- progress ---- */
  const isDone = id => !!get("ds_" + id);
  const start = get("ds_start");
  const openThrough = unlockAll ? 7 : start ? Math.min(7, Math.max(1, dayDiff(start, today) + 1)) : 1;
  const isOpen = id => isDone(id) || id <= openThrough;
  const doneCount = steps.filter(s => isDone(s.id)).length;
  const anchored = doneCount === 7;
  const current = steps.find(s => !isDone(s.id) && isOpen(s.id));
  let lead = 0; while (lead < 7 && isDone(lead + 1)) lead++;
  const fill = anchored ? 100 : (lead / 7) * 100;

  const opensText = id => {
    if (!start) return "after Read";
    const d = addDays(start, id - 1);
    const diff = dayDiff(today, localDay(d));
    return diff <= 1 ? "tomorrow" : "on " + DAY_NAMES[d.getDay()];
  };

  /* ---- year strip ---- */
  const weekState = useMemo(() => {
    const anchoredW = new Set(), touched = new Set();
    entries.forEach(e => {
      if (e.field_key === "ds_7" && e.field_value) anchoredW.add(e.week);
      if (!String(e.field_key || "").startsWith("day_") && String(e.field_value || "").trim()) touched.add(e.week);
    });
    return { anchoredW, touched };
  }, [entries]);
  const nextMilestone = MILESTONES.find(m => m >= wk) || totalWeeks;

  /* ---- toast ---- */
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2800); return () => clearTimeout(t); }, [toast]);

  /* ---- session control ---- */
  const enterCard = (stepId, idx) => {
    const card = steps[stepId - 1].cards[idx];
    hush();
    setSession({ step: stepId, card: idx });
    setU(card.init ? card.init() : {});
    if (ovRef.current) ovRef.current.scrollTop = 0;
  };
  const openStep = s => {
    if (!isOpen(s.id)) {
      setToast(start ? s.name + " opens " + opensText(s.id) + ". One step a day keeps it steady." : "Start with Read. After that, one step opens each day.");
      return;
    }
    setDone(null);
    enterCard(s.id, 0);
  };
  const close = () => { hush(); commit(); setSession(null); setDone(null); setU({}); };
  closeRef.current = close;

  const finishStep = st => {
    const from = doneCount;
    const c = ctx();
    if (st.onComplete) st.onComplete(c);
    if (!isDone(st.id)) { set("ds_" + st.id, today); if (!start) set("ds_start", today); }
    hush();
    setSession(null); setU({});
    setDone({ step: st.id, from });
    if (ovRef.current) ovRef.current.scrollTop = 0;
  };

  const ctx = () => ({
    week, u, setU, val, put, get, set, hl,
    speak: t => { if (!speakText(t)) setToast("Listening isn\u2019t supported in this browser."); },
  });

  const st = session ? steps[session.step - 1] : null;
  const card = st ? st.cards[session.card] : null;
  const c = ctx();
  const ready = card ? (card.ready ? card.ready(c) : true) : false;
  const ctaLabel = card ? (typeof card.cta === "function" ? card.cta(c) : card.cta || "Continue") : "";

  const goNext = () => {
    if (card.next && card.next(c)) return;
    commit();
    if (session.card < st.cards.length - 1) { enterCard(st.id, session.card + 1); return; }
    finishStep(st);
  };
  const skip = () => {
    commit();
    if (session.card < st.cards.length - 1) { enterCard(st.id, session.card + 1); return; }
    finishStep(st);
  };

  /* ---- overlay: lock page scroll, Escape closes ---- */
  const overlayOpen = !!session || !!done;
  useEffect(() => {
    if (!overlayOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = e => { if (e.key === "Escape" && closeRef.current) closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [overlayOpen]);
  useEffect(() => () => hush(), []);

  /* ---- ring animation on the step-complete screen ---- */
  useEffect(() => {
    if (!done || !ringRef.current) return undefined;
    const el = ringRef.current;
    const t = setTimeout(() => { el.style.strokeDashoffset = el.getAttribute("data-to"); }, 60);
    return () => clearTimeout(t);
  }, [done]);

  /* ---- render pieces ---- */
  const yearStrip = (
    <div className="ds-year" role="img" aria-label={"Your year: week " + wk + " of " + totalWeeks}>
      {Array.from({ length: totalWeeks }, (_, i) => {
        const n = i + 1;
        const cls = [MILESTONES.includes(n) ? "is-m" : "", weekState.anchoredW.has(n) ? "is-done" : weekState.touched.has(n) ? "is-touched" : "", n === wk ? "is-cur" : ""].join(" ");
        return <span key={n} className={cls} />;
      })}
    </div>
  );

  const trKey = "tr_" + ((new Date().getDay() + 6) % 7);
  const C = 2 * Math.PI * 62;

  const overlay = overlayOpen ? createPortal(
    <div className={theme + " ds-overlay"} ref={ovRef} role="dialog" aria-modal="true" aria-label={st ? st.name : "Step complete"}>
      {session && card && (
        <div className="ds-session">
          <div className="ds-top">
            <div className="ds-head">
              <button className="ds-icon" onClick={close} aria-label="Close and go back to the week"><Close /></button>
              <div className="ds-stitle">{st.name}</div>
              <div className="ds-count">{session.card + 1} / {st.cards.length}</div>
            </div>
            <div className="ds-segs" aria-hidden="true">{st.cards.map((_, i) => <span key={i} className={i <= session.card ? "is-on" : ""} />)}</div>
          </div>
          <main key={session.step + "-" + session.card} className={"ds-card" + (card.top ? " is-top" : "")}>{card.render(c)}</main>
          <div className="ds-foot">
            <button className="ds-btn ds-primary" disabled={!ready} onClick={goNext}>{ctaLabel}</button>
            {card.skip && !ready && <button className="ds-link" onClick={skip}>Skip for now</button>}
          </div>
        </div>
      )}
      {done && (() => {
        const dst = steps[done.step - 1];
        const all = doneCount === 7;
        const nx = steps.find(s => !isDone(s.id));
        return (
          <div className="ds-done">
            <div className="ds-ring">
              <svg viewBox="0 0 140 140" aria-hidden="true">
                <circle cx="70" cy="70" r="62" className="ds-ring-bg" />
                <circle ref={ringRef} cx="70" cy="70" r="62" className="ds-ring-fg" strokeDasharray={C.toFixed(2)}
                  style={{ strokeDashoffset: (C * (1 - done.from / 7)).toFixed(2) }} data-to={(C * (1 - doneCount / 7)).toFixed(2)} />
              </svg>
              <span className="ds-ring-anchor"><Anchor /></span>
            </div>
            {all ? (<>
              <h1 className="ds-dtitle">Week {wk} is anchored</h1>
              <p className="ds-dsub">Seven steps, and every one of them yours.</p>
              {yearStrip}
              <div className="ds-year-meta"><span>{weekState.anchoredW.size || 1} of {totalWeeks} weeks anchored</span><span>{wk < totalWeeks ? "Next milestone: week " + (MILESTONES.find(m => m > wk) || totalWeeks) : "Final week"}</span></div>
            </>) : (<>
              <p className="ds-dcount">{doneCount} of 7 steps</p>
              <h1 className="ds-dtitle">{dst.name} is done</h1>
              <p className="ds-dsub">{streak > 0 ? <><b>{streak}</b>-day streak. Keep it going.</> : "Good work today."}</p>
              {nx && <div className="ds-next">
                <span className="ds-next-l">{isOpen(nx.id) ? "Next step, open now" : "Next step, opens " + opensText(nx.id)}</span>
                <span className="ds-next-n">{nx.name}</span>
                <span className="ds-next-b">{nx.blurb}, about {nx.min} minutes.</span>
              </div>}
            </>)}
            {week.trackerLabel && (
              <label className="ds-tracker"><span>{week.trackerLabel}</span>
                <textarea className="ds-textarea" rows={2} value={val(trKey)} placeholder="One line for today (optional)" onChange={e => put(trKey, e.target.value)} />
              </label>
            )}
            {all && wk < totalWeeks && <button className="ds-btn ds-primary ds-wide" onClick={() => { commit(); setDone(null); onGoWeek && onGoWeek(wk + 1); }}>Start week {wk + 1}</button>}
            <button className={all && wk < totalWeeks ? "ds-link" : "ds-btn ds-primary ds-wide"} onClick={close}>Back to the week</button>
          </div>
        );
      })()}
    </div>, document.body) : null;

  return (
    <div className={theme}>
      <style>{CSS}</style>
      <div className="ds-home">
        <div className="ds-weeknav">
          <button className="ds-arrow" onClick={() => onGoWeek && onGoWeek(wk - 1)} disabled={wk <= 1} aria-label="Previous week">{"\u2039"}</button>
          <span className="ds-wk">Week {wk} of {totalWeeks}</span>
          <button className="ds-arrow" onClick={() => onGoWeek && onGoWeek(wk + 1)} disabled={wk >= totalWeeks} aria-label="Next week">{"\u203A"}</button>
        </div>
        <h1 className="ds-title">{week.title}</h1>
        {week.subtitle && <p className="ds-sub">{week.subtitle}</p>}
        {yearStrip}
        <div className="ds-year-meta">
          <span className="ds-streak"><Flame />{streak > 0 ? <span><b>{streak}</b>-day streak</span> : <span>Start your streak today</span>}</span>
          <span>{wk === nextMilestone ? "Milestone week" : "Next milestone: week " + nextMilestone}</span>
        </div>

        <div className={"ds-trail" + (anchored ? " is-anchored" : "")}>
          <div className="ds-rope" aria-hidden="true"><i style={{ height: fill + "%" }} /></div>
          <ol className="ds-path">
            {steps.map(s => {
              const d = isDone(s.id), cur = current && s.id === current.id, open = isOpen(s.id);
              const cls = (d ? "is-done" : "") + (cur ? " is-cur" : "") + (!open ? " is-locked" : "");
              const meta = d ? "Done" : cur ? "Today" : open ? s.min + " min" : start ? (opensText(s.id) === "tomorrow" ? "Tomorrow" : opensText(s.id).replace("on ", "")) : "Day " + s.id;
              return (
                <li key={s.id} className={cls}>
                  <button className="ds-stone" onClick={() => openStep(s)} aria-label={"Day " + s.id + ": " + s.name + (d ? ", done" : cur ? ", today" : !open ? ", opens " + opensText(s.id) : "")}>
                    <span className="ds-mark">{d ? <Check /> : s.id}</span>
                    <span><span className="ds-name">{s.name}</span><span className="ds-blurb">{s.blurb}</span></span>
                    <span className="ds-meta">{meta}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="ds-anchor-row">
            <span className="ds-anchor-ic"><Anchor /></span>
            <span className="ds-anchor-text">{anchored ? "Week " + wk + " is anchored." : "Finish all seven steps to set this week\u2019s anchor. " + doneCount + " of 7 done."}</span>
          </div>
        </div>

        {anchored && wk < totalWeeks && <button className="ds-btn ds-primary ds-wide ds-gap" onClick={() => onGoWeek && onGoWeek(wk + 1)}>Start week {wk + 1}</button>}
        <button className="ds-link ds-left" onClick={() => onOpenWeek && onOpenWeek()}>See the whole week at once</button>
      </div>
      {overlay}
      {toast && createPortal(<div className={theme}><div className="ds-toast" role="status">{toast}</div></div>, document.body)}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   STYLES (scoped to .ds-root)
   ───────────────────────────────────────────────────────────── */
const CSS = `
.ds-root{--bg:#0F1A24;--panel:#152331;--ink:#F5F1E8;--body:#E6DED0;--muted:#9AAAB8;--line:rgba(255,255,255,.1);--gold:#B08A4E;--goldL:#D6B97A;--goldSoft:rgba(176,138,78,.16);--onGold:#0F1A24;--sage:#8FA697;--sageSoft:rgba(124,146,132,.18);--rose:#D97A7A;--roseSoft:rgba(217,122,122,.14);font-family:"EB Garamond",Garamond,Georgia,serif;color:var(--body);-webkit-font-smoothing:antialiased;font-size:18px;line-height:1.55}
.ds-root.ds-light{--bg:#F2EDE3;--panel:#FBF8F2;--ink:#2C2416;--body:#3D2E1A;--muted:#5E4E3C;--line:rgba(122,98,72,.24);--gold:#7A5A1E;--goldL:#6B4E18;--goldSoft:rgba(176,138,78,.15);--onGold:#FBF8F2;--sage:#56705F;--sageSoft:rgba(124,146,132,.18);--rose:#B25656;--roseSoft:rgba(217,122,122,.15)}
.ds-root *,.ds-root *::before,.ds-root *::after{box-sizing:border-box}
.ds-root p,.ds-root h1,.ds-root h2,.ds-root h3,.ds-root blockquote,.ds-root ol{margin:0;padding:0}
.ds-root button{font-family:inherit;color:inherit;-webkit-tap-highlight-color:transparent}
.ds-root :focus-visible{outline:2px solid var(--gold);outline-offset:3px;border-radius:6px}
.ds-root mark{background:none;color:var(--goldL);box-shadow:inset 0 -.14em 0 var(--goldSoft);padding:0;font-style:inherit}

.ds-home{max-width:460px;margin:0 auto;padding:0 2px 24px}
.ds-weeknav{display:flex;align-items:center;justify-content:space-between;gap:10px}
.ds-arrow{width:40px;height:40px;border-radius:50%;border:1.5px solid var(--line);background:transparent;color:var(--gold)!important;font-size:24px;line-height:1;cursor:pointer;display:grid;place-items:center;padding:0 0 3px}
.ds-arrow:disabled{opacity:.3;cursor:default}
.ds-wk{font-size:18px;color:var(--muted);font-style:italic}
.ds-title{font-family:Cinzel,Georgia,serif;font-size:clamp(27px,8vw,36px)!important;line-height:1.12;font-weight:600;color:var(--ink);margin:14px 0 10px!important}
.ds-sub{color:var(--muted);font-size:19px;font-style:italic;margin-bottom:24px!important}
.ds-year{display:flex;gap:2px;align-items:flex-end;height:18px;width:100%}
.ds-year span{flex:1;height:9px;border-radius:1px;background:var(--line)}
.ds-year span.is-m{height:17px}
.ds-year span.is-touched{background:var(--gold);opacity:.4}
.ds-year span.is-done{background:var(--gold);opacity:1}
.ds-year span.is-cur{background:var(--gold);opacity:1;box-shadow:0 0 0 1.5px var(--gold)}
.ds-year-meta{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:15px;color:var(--muted);margin:8px 0 32px;width:100%}
.ds-streak{display:inline-flex;align-items:center;gap:6px}
.ds-streak svg{width:15px;height:15px;color:var(--gold);flex:none}
.ds-streak b,.ds-dsub b{color:var(--ink);font-weight:600}

.ds-trail{position:relative}
.ds-rope{position:absolute;left:21px;top:28px;bottom:26px;width:2px;background:var(--line);border-radius:2px}
.ds-rope i{position:absolute;left:0;top:0;width:100%;background:var(--gold);border-radius:2px;transition:height .7s cubic-bezier(.2,.8,.2,1)}
.ds-path{list-style:none}
.ds-path li{margin-bottom:12px;list-style:none}
.ds-stone{display:grid;grid-template-columns:44px 1fr auto;gap:14px;align-items:center;width:100%;min-height:56px;background:none;border:0;padding:6px 0;text-align:left;cursor:pointer}
.ds-mark{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-family:Cinzel,Georgia,serif;font-weight:600;font-size:16px;background:var(--panel);border:1.5px solid var(--line);color:var(--muted);position:relative;z-index:1}
.is-done .ds-mark{background:var(--gold);border-color:var(--gold);color:var(--onGold)}
.is-cur .ds-mark{border-color:var(--gold);color:var(--gold);box-shadow:0 0 0 5px var(--goldSoft)}
.is-cur .ds-mark::after{content:"";position:absolute;inset:-7px;border-radius:50%;border:1.5px solid var(--gold);opacity:0;animation:ds-pulse 2.6s ease-out infinite}
.ds-name{display:block;font-family:Cinzel,Georgia,serif;font-size:17px;font-weight:600;color:var(--ink);letter-spacing:.02em}
.ds-blurb{display:block;font-size:16px;color:var(--muted);line-height:1.35;margin-top:2px}
.ds-meta{font-size:15px;color:var(--muted);white-space:nowrap}
.is-cur .ds-meta{color:var(--gold);font-weight:600}
.is-done .ds-meta{color:var(--sage)}
.is-locked .ds-name,.is-locked .ds-blurb,.is-locked .ds-mark{opacity:.55}
.ds-light .is-locked .ds-name,.ds-light .is-locked .ds-blurb,.ds-light .is-locked .ds-mark{opacity:.92}
.ds-anchor-row{display:grid;grid-template-columns:44px 1fr;gap:14px;align-items:center;margin-top:4px}
.ds-anchor-ic{width:44px;height:48px;display:grid;place-items:center;color:var(--muted);position:relative;z-index:1}
.ds-anchor-ic::before{content:"";position:absolute;inset:3px 1px;border-radius:50%;background:var(--panel);z-index:-1}
.ds-anchor-ic svg{width:36px;height:36px}
.is-anchored .ds-anchor-ic{color:var(--gold)}
.ds-anchor-text{font-size:17px;color:var(--muted);font-style:italic;line-height:1.4}
.is-anchored .ds-anchor-text{color:var(--ink);font-style:normal;font-weight:500}

.ds-link{background:none;border:0;color:var(--muted)!important;font-size:17px;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px;padding:10px;cursor:pointer}
.ds-left{padding-left:0;margin-top:20px;display:inline-block}
.ds-btn{appearance:none;border:0;border-radius:12px;padding:15px 20px;font-size:19px;font-weight:600;cursor:pointer;min-height:52px}
.ds-primary{background:var(--gold);color:var(--onGold)!important}
.ds-primary:disabled{background:var(--line);color:var(--muted)!important;cursor:not-allowed}
.ds-wide{width:100%}
.ds-gap{margin-top:22px}

.ds-overlay{position:fixed;inset:0;z-index:1000;background:var(--bg);overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.ds-session{min-height:100%;display:flex;flex-direction:column;max-width:460px;margin:0 auto;padding:0 22px}
.ds-top{position:sticky;top:0;background:var(--bg);z-index:5;padding-top:calc(8px + env(safe-area-inset-top,0px))}
.ds-head{display:grid;grid-template-columns:44px 1fr 44px;align-items:center;padding-bottom:8px}
.ds-icon{width:44px;height:44px;border-radius:50%;border:0;background:transparent;display:grid;place-items:center;color:var(--muted)!important;cursor:pointer;margin-left:-10px}
.ds-stitle{text-align:center;font-family:Cinzel,Georgia,serif;font-weight:600;font-size:15px;color:var(--ink);letter-spacing:.06em}
.ds-count{text-align:right;font-size:15px;color:var(--muted)}
.ds-segs{display:flex;gap:4px;padding-bottom:6px}
.ds-segs span{flex:1;height:3px;border-radius:2px;background:var(--line)}
.ds-segs span.is-on{background:var(--gold)}
.ds-card{flex:1;display:flex;flex-direction:column;justify-content:center;padding:26px 0 18px;animation:ds-in .28s ease}
.ds-card.is-top{justify-content:flex-start}
.ds-foot{position:sticky;bottom:0;padding:14px 0 calc(16px + env(safe-area-inset-bottom,0px));background:linear-gradient(to top,var(--bg) 72%,transparent);display:flex;flex-direction:column;align-items:stretch;gap:2px;z-index:5}

.ds-kicker{margin-bottom:14px!important;color:var(--muted);font-style:italic;font-size:17px}
.ds-verse{margin-bottom:14px!important;font-size:27px;line-height:1.4;color:var(--ink);font-style:italic;border:0}
.ds-ref{font-family:Cinzel,Georgia,serif;font-size:14px;letter-spacing:.07em;color:var(--gold);margin-bottom:22px!important}
.ds-flush{margin-bottom:0!important}
.ds-chip{display:inline-flex;align-items:center;gap:8px;border:1.5px solid var(--line);background:var(--panel);border-radius:999px;padding:10px 18px;font-size:17px;color:var(--ink)!important;cursor:pointer;align-self:flex-start;min-height:44px}
.ds-chip.is-on{border-color:var(--sage);background:var(--sageSoft);color:var(--sage)!important}
.ds-notes p{margin-bottom:14px!important;font-size:19px;line-height:1.6;color:var(--body);white-space:pre-line}
.ds-q{font-size:26px;line-height:1.3;color:var(--ink);font-weight:500;margin-bottom:10px!important;font-family:"EB Garamond",Garamond,Georgia,serif}
.ds-hint{color:var(--muted);font-size:17px;margin-bottom:18px!important;font-style:italic}
.ds-after{margin-top:16px}
.ds-textarea{width:100%;background:var(--panel);border:1.5px solid var(--line);border-radius:12px;padding:14px;font-family:inherit;font-size:18px;line-height:1.5;color:var(--ink);resize:vertical;min-height:110px;display:block}
.ds-textarea::placeholder{color:var(--muted);opacity:.8}
.ds-textarea:focus{outline:none;border-color:var(--gold)}

.ds-flip{width:100%;min-height:310px;border-radius:18px;border:1.5px solid var(--line);background:var(--panel);padding:28px 22px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;cursor:pointer}
.ds-flip.is-flipped{align-items:flex-start;text-align:left;justify-content:flex-start;border-color:var(--gold);animation:ds-in .25s ease}
.ds-flip-word{font-family:Cinzel,Georgia,serif;font-size:28px;font-weight:600;color:var(--ink);line-height:1.2}
.ds-flip-word.is-small{font-size:17px;color:var(--gold)}
.ds-flip-orig{font-size:23px;color:var(--gold);font-style:italic}
.ds-flip-hint{font-size:16px;color:var(--muted);margin-top:16px;font-style:italic}
.ds-flip-mean{font-size:21px;line-height:1.4;color:var(--ink)}
.ds-flip-note{font-size:17px;line-height:1.55;color:var(--muted)}

.ds-words{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
.ds-w{border:1.5px solid var(--line);background:var(--panel);border-radius:999px;padding:10px 17px;font-family:Cinzel,Georgia,serif;font-size:15px;font-weight:600;color:var(--ink)!important;cursor:pointer;min-height:44px}
.ds-w.is-sel{border-color:var(--gold);background:var(--goldSoft)}
.ds-m{display:block;width:100%;text-align:left;border:1.5px solid var(--line);background:var(--panel);border-radius:12px;padding:13px 15px;font-size:18px;line-height:1.35;color:var(--body)!important;margin-bottom:9px;cursor:pointer}
.ds-w.is-ok,.ds-m.is-ok{border-color:var(--sage);background:var(--sageSoft);color:var(--sage)!important;cursor:default}
.ds-tag{display:block;font-family:Cinzel,Georgia,serif;font-size:12px;letter-spacing:.06em;margin-bottom:3px;font-weight:600}
.ds-root .is-bad{border-color:var(--rose)!important;background:var(--roseSoft)!important;animation:ds-shake .35s}

.ds-built{min-height:130px;font-size:24px;line-height:1.45;font-style:italic;color:var(--ink);margin-bottom:6px!important}
.ds-built.is-complete{color:var(--goldL)}
.ds-slot{display:inline-block;width:40px;border-bottom:2px dashed var(--gold);margin-left:4px;height:1em;vertical-align:baseline;animation:ds-blink 1.2s steps(2) infinite}
.ds-chunks{display:flex;flex-wrap:wrap;gap:8px}
.ds-chunk{border:1.5px solid var(--line);background:var(--panel);border-radius:10px;padding:10px 14px;font-size:18px;color:var(--ink)!important;cursor:pointer;min-height:44px}
.ds-blank-verse{font-size:23px;line-height:1.6;font-style:italic;color:var(--ink);margin-bottom:8px!important}
.ds-blank{display:inline-block;min-width:110px;border-bottom:2px solid var(--line);text-align:center;font-style:normal;color:var(--gold);font-weight:600}
.ds-blank.is-active{border-bottom-color:var(--gold)}

.ds-opt{display:block;width:100%;text-align:left;border:1.5px solid var(--line);background:var(--panel);border-radius:14px;padding:15px 16px;font-size:19px;line-height:1.4;color:var(--ink)!important;margin-bottom:10px;cursor:pointer}
.ds-opt.is-sel{border-color:var(--gold);background:var(--goldSoft)}
.ds-opt small{display:block;font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.06em;color:var(--gold);margin-bottom:4px}
.ds-chal{border-left:3px solid var(--gold);padding:2px 0 2px 16px;margin-bottom:24px}
.ds-chal+.ds-chal{border-color:var(--sage)}
.ds-chal h3{font-family:Cinzel,Georgia,serif;font-size:17px;margin-bottom:6px!important;color:var(--ink);font-weight:600}
.ds-chal p{font-size:21px;line-height:1.45;color:var(--body)}
.ds-trade{border:1.5px solid var(--line);border-radius:18px;background:var(--panel);padding:22px}
.ds-tlabel{font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.08em;color:var(--muted);margin-bottom:6px!important;font-weight:600}
.ds-plan{font-size:20px;color:var(--ink);margin-bottom:16px!important;white-space:pre-line}
.ds-tdiv{height:1px;background:var(--line);margin:0 0 16px}
.ds-truth{font-size:23px;font-style:italic;line-height:1.4;color:var(--ink);margin-bottom:10px!important;border:0}

.ds-pray p{font-size:23px;line-height:1.45;font-style:italic;margin-bottom:16px!important;color:var(--ink);transition:opacity .4s}
.ds-pray p.is-past{opacity:.38}
.ds-pray p:last-child{animation:ds-in .35s ease}
.ds-er{display:block;margin-bottom:18px}
.ds-er span{display:block;font-size:19px;color:var(--ink);margin-bottom:8px;line-height:1.35}
.ds-er .ds-textarea{min-height:84px}
.ds-rc{border-top:1px solid var(--line);padding:14px 0}
.ds-rc h3{font-family:Cinzel,Georgia,serif;font-size:14px;letter-spacing:.06em;color:var(--gold);margin-bottom:6px!important;font-weight:600}
.ds-rc p{font-size:18px;line-height:1.5;color:var(--ink)}
.ds-rc p.is-empty{color:var(--muted);font-style:italic}
.ds-rc em{color:var(--muted)}
.ds-by{color:var(--muted);font-style:italic}

.ds-done{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:calc(36px + env(safe-area-inset-top,0px)) 22px calc(28px + env(safe-area-inset-bottom,0px));max-width:460px;margin:0 auto}
.ds-ring{width:150px;height:150px;position:relative;margin-bottom:22px;color:var(--gold);flex:none}
.ds-ring>svg{width:100%;height:100%;transform:rotate(-90deg)}
.ds-ring-bg{fill:none;stroke:var(--line);stroke-width:6}
.ds-ring-fg{fill:none;stroke:var(--gold);stroke-width:6;stroke-linecap:round;transition:stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)}
.ds-ring-anchor{position:absolute;inset:0;display:grid;place-items:center}
.ds-ring-anchor svg{width:56px;height:56px}
.ds-dcount{font-size:17px;color:var(--muted);margin-bottom:4px!important;font-style:italic}
.ds-dtitle{font-family:Cinzel,Georgia,serif;font-size:29px!important;line-height:1.2;font-weight:600;color:var(--ink);margin-bottom:8px!important}
.ds-dsub{font-size:19px;color:var(--muted);margin-bottom:22px!important}
.ds-next{display:flex;flex-direction:column;gap:2px;border:1.5px solid var(--line);border-radius:14px;padding:14px 18px;width:100%;text-align:left;margin-bottom:18px;background:var(--panel)}
.ds-next-l{font-size:15px;color:var(--muted);font-style:italic}
.ds-next-n{font-family:Cinzel,Georgia,serif;font-weight:600;font-size:18px;color:var(--ink)}
.ds-next-b{font-size:17px;color:var(--muted)}
.ds-tracker{display:block;width:100%;text-align:left;margin:0 0 20px}
.ds-tracker span{display:block;font-size:16px;color:var(--muted);font-style:italic;margin-bottom:8px}
.ds-tracker .ds-textarea{min-height:64px}
.ds-done .ds-year{margin-top:4px}
.ds-done .ds-year-meta{margin-bottom:22px}
.ds-done .ds-link{margin-top:6px}

.ds-toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:12px 18px;border-radius:12px;font-size:17px;max-width:88vw;width:max-content;z-index:1100;text-align:center;animation:ds-in .2s ease;font-family:"EB Garamond",Garamond,Georgia,serif}

@keyframes ds-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes ds-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
@keyframes ds-pulse{0%{opacity:.7;transform:scale(1)}100%{opacity:0;transform:scale(1.4)}}
@keyframes ds-blink{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){.ds-root *,.ds-root *::before,.ds-root *::after{animation:none!important;transition:none!important}}
`;
