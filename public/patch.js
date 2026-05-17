/**
 * Anchored Steps — Content Patch (v2)
 * Uses regex patterns instead of exact string matching — immune to
 * Unicode encoding differences that caused v1 to silently fail.
 *
 * index.html load order:
 *   <script src="/data.js"></script>
 *   <script src="/patch.js"></script>
 *   <script type="module" src="/src/main.jsx"></script>
 */
(function () {
  if (!window.__APPDATA__) { console.error("patch.js: __APPDATA__ not found"); return; }

  var weeks = window.__APPDATA__.ALL_WEEKS;
  function W(n) { return weeks.find(function (w) { return w.week === n; }); }
  var w;

  console.log("patch.js v2: running on", weeks.length, "weeks");

  // ── WEEKS 11–21: strip appended numbered-question blocks ──────────────────
  // Matches everything from the first "\n\n1." to end of string
  [11,12,13,14,15,16,17,18,19,20,21].forEach(function(n) {
    w = W(n);
    if (w) w.studyNotes = w.studyNotes.replace(/\n\n1\.[\s\S]*$/, "");
  });

  // ── ALL WEEKS: strip trailing PDF page numbers from reflectionPrompts ──────
  // Matches a space + 1–4 digits at the very end of each prompt string
  weeks.forEach(function(wk) {
    if (!wk.reflectionPrompts) return;
    wk.reflectionPrompts = wk.reflectionPrompts.map(function(p) {
      return p.replace(/ \d{1,4}$/, "");
    });
  });

  // ── WEEK 23 ───────────────────────────────────────────────────────────────
  w = W(23);
  if (w) {
    w.studyNotes = w.studyNotes.replace(/faithfulness feels unnoticed or (Paul)/, "$1");
    w.reflectionPrompts[0] = w.reflectionPrompts[0].replace("Where id God", "Where is God");
  }

  // ── WEEK 24 ───────────────────────────────────────────────────────────────
  w = W(24);
  if (w) {
    w.studyNotes = w.studyNotes
      .replace("communication style under inner character", "inner character")
      .replace("to speak building up with grace", "to speak with grace")
      .replace("while speech fosters", "while gracious speech fosters")
      .replace(/prevents unnecessary conflict guide my speech more \(James 1:19\)\. God-honoring intentionally\? communication/, "prevents unnecessary conflict (James 1:19). God-honoring communication");
  }

  // ── WEEK 25 ───────────────────────────────────────────────────────────────
  w = W(25);
  if (w) {
    w.studyNotes = w.studyNotes.replace("to strengthen protect believers", "to protect believers");
    w.reflectionPrompts[3] = w.reflectionPrompts[3].replace("purse Godly", "pursue Godly");
  }

  // ── WEEK 26 ───────────────────────────────────────────────────────────────
  w = W(26);
  if (w) w.studyNotes = w.studyNotes.replace(/strengthen\? preserve purity/, "strengthen and preserve purity");

  // ── WEEK 27 ───────────────────────────────────────────────────────────────
  w = W(27);
  if (w) w.studyNotes = w.studyNotes.replace("for the of others", "for the good of others");

  // ── WEEK 28 ───────────────────────────────────────────────────────────────
  w = W(28);
  if (w) w.studyNotes = w.studyNotes.replace(/divisions are healed, pursue peace and relationships strengthened, and reconciliation\?/, "divisions are healed, relationships strengthened, and reconciliation pursued.");

  // ── WEEK 29 ───────────────────────────────────────────────────────────────
  w = W(29);
  if (w) {
    w.studyNotes = w.studyNotes
      .replace("Paul difficulty instructs", "Paul instructs")
      .replace(/restore greatest impact on those joy and confidence\. around me\?/, "restore joy and confidence, with the greatest impact on those around me.")
      .replace("but strengthen unity and intentional support truth.", "but intentional support rooted in truth.");
    w.reflectionPrompts[0] = w.reflectionPrompts[0].replace("difficulty seasons", "difficult seasons");
  }

  // ── WEEK 30 ───────────────────────────────────────────────────────────────
  w = W(30);
  if (w) {
    w.studyNotes = w.studyNotes.replace(/intentionally in God.s design\? purpose becomes clearer\./, "purpose becomes clearer.");
    w.reflectionPrompts[1] = w.reflectionPrompts[1].replace("reffing", "refining");
  }

  // ── WEEK 31 ───────────────────────────────────────────────────────────────
  w = W(31);
  if (w) w.studyNotes = w.studyNotes.replace(/not driven by recognition alone, but excellence\? by devotion to God\./, "not driven by recognition, but by devotion to God and a pursuit of excellence.");

  // ── WEEK 32 ───────────────────────────────────────────────────────────────
  w = W(32);
  if (w) {
    w.studyNotes = w.studyNotes
      .replace(/rooted in God.s than personal ambition/, "rooted in God's purposes rather than personal ambition")
      .replace("when it has God is surrendered to God.", "when it is surrendered to God.")
      .replace(/through the others and glorify God\? body of Christ\./, "through the body of Christ.")
      .replace("Calling may seasons,", "Calling may change across seasons,");
  }

  // ── WEEK 33 ───────────────────────────────────────────────────────────────
  w = W(33);
  if (w) {
    w.studyNotes = w.studyNotes
      .replace("all are prevent intended", "all are intended")
      .replace("body of gifts Christ.", "body of Christ.")
      .replace(/encourages growth, service\? and reflects/, "encourages growth, and reflects");
  }

  // ── WEEK 34 ───────────────────────────────────────────────────────────────
  w = W(34);
  if (w) {
    w.studyNotes = w.studyNotes
      .replace(/Paul instructs journey\? Timothy/, "Paul instructs Timothy")
      .replace(/influence impactful\?\n\nBiblical/, "\n\nBiblical")
      .replace("Mentorship to mentor models", "Mentorship models")
      .replace(/or correction, to others\? mentorship/, "or correction, mentorship");
  }

  // ── WEEK 35 ───────────────────────────────────────────────────────────────
  w = W(35);
  if (w) {
    w.studyNotes = w.studyNotes
      .replace(/Jesus leadership\? redefines/, "Jesus redefines")
      .replace("self- awareness", "self-awareness")
      .replace("God God developing in me as a values leaders who example, model godly character", "God values leaders who model godly character");
  }

  // ── WEEK 36 ───────────────────────────────────────────────────────────────
  w = W(36);
  if (w) w.reflectionPrompts[0] = w.reflectionPrompts[0].replace("How do i respond", "How do I respond");

  // ── WEEK 37 ───────────────────────────────────────────────────────────────
  w = W(37);
  if (w) {
    w.studyNotes = w.studyNotes
      .replace("faithfulness over time achievement.", "faithfulness over time rather than achievement.")
      .replace(/faithfully in words, and actions\? others\./, "faithfully in others.")
      .replace("A on to consistent life of faith", "A consistent life of faith");
    w.endReflections[0] = w.endReflections[0].replace("Legacy -building", "legacy-building");
  }

  // ── WEEK 39 ───────────────────────────────────────────────────────────────
  w = W(39);
  if (w) w.studyNotes = w.studyNotes.replace(/When believers others\? anchor[\s\S]*?renewed[\s\S]*?$/, "When believers anchor their hope in God's promises, they experience strength, peace, and renewed purpose.");

  // ── WEEK 40 ───────────────────────────────────────────────────────────────
  w = W(40);
  if (w) w.studyNotes = w.studyNotes.replace("God compassion is compassionate,", "God is compassionate,");

  // ── WEEK 41 ───────────────────────────────────────────────────────────────
  w = W(41);
  if (w) w.studyNotes = w.studyNotes.replace("with grace, becomes visible.", "with grace, Christ becomes visible.");

  // ── WEEK 42 ───────────────────────────────────────────────────────────────
  w = W(42);
  if (w) w.studyNotes = w.studyNotes.replace("loosen a the grip", "loosen the grip");

  // ── WEEK 43 ───────────────────────────────────────────────────────────────
  w = W(43);
  if (w) {
    w.studyNotes = w.studyNotes
      .replace(/vision is from God\? essential/, "vision is essential")
      .replace(/God.s decisions\? promises/, "God's promises")
      .replace(/Scripture, clarity or trust in God.s and obedience\./, "Scripture, and obedience.")
      .replace(/When believers timing\? seek/, "When believers seek");
  }

  // ── WEEK 44 ───────────────────────────────────────────────────────────────
  w = W(44);
  if (w) {
    w.studyNotes = w.studyNotes.replace("Perseverance through sustained", "Perseverance is sustained through");
    w.endReflections[0] = w.endReflections[0].replace("through trail this week", "through trial this week");
  }

  // ── WEEK 45 ───────────────────────────────────────────────────────────────
  w = W(45);
  if (w) {
    w.studyNotes = w.studyNotes
      .replace("Galatians not to grow weary", "Galatians 6:9 urges believers not to grow weary")
      .replace(", reminding them that endurance produces fruit over time (Galatians 6:9).", ", noting that endurance produces fruit over time.")
      .replace("and look like in sacrificial.", "and sacrificial.");
    w.endReflections[1] = w.endReflections[1].replace("patience ir commitment", "patience or commitment");
  }

  // ── WEEK 46 ───────────────────────────────────────────────────────────────
  w = W(46);
  if (w) {
    w.studyNotes = w.studyNotes
      .replace(/established by Sabbath\? God\./, "established by God.")
      .replace("look like When practiced", "When practiced");
  }

  // ── WEEK 47 ───────────────────────────────────────────────────────────────
  w = W(47);
  if (w) w.studyNotes = w.studyNotes.replace("When toward believers surrender", "When believers surrender");

  // ── WEEK 48 ───────────────────────────────────────────────────────────────
  w = W(48);
  if (w) w.studyNotes = w.studyNotes.replace(/not human remain open to God.s effort\./, "not human effort.");

  // ── WEEK 49 ───────────────────────────────────────────────────────────────
  w = W(49);
  if (w) {
    w.studyNotes = w.studyNotes
      .replace("a central hope return of", "a central hope of")
      .replace(/live with return encourage urgency[\s\S]*?perseverance\./, "live with urgency, hope, and perseverance.");
    w.endReflections[0] = w.endReflections[0].replace("enternity", "eternity");
  }

  // ── WEEK 50 ───────────────────────────────────────────────────────────────
  w = W(50);
  if (w) {
    w.studyNotes = w.studyNotes.replace("Abiding like in means", "Abiding means");
    w.reflectionPrompts[2] = w.reflectionPrompts[2].replace("What practice help", "What practices help");
  }

  // ── WEEK 51 ───────────────────────────────────────────────────────────────
  w = W(51);
  if (w) {
    w.studyNotes = w.studyNotes
      .replace("purpose, journey up perseverance,", "purpose, perseverance,")
      .replace("Faith that endures reflects circumstances.", "Faith that endures reflects trust in God regardless of circumstances.")
      .replace(/like in my\n\nA life that finishes well/, "\n\nA life that finishes well");
  }

  // ── WEEK 52 ───────────────────────────────────────────────────────────────
  w = W(52);
  if (w) {
    w.studyNotes = w.studyNotes
      .replace("how God has growth, challenge", "how God has worked through growth, challenge")
      .replace("carry forward into the next A year of reflection", "A year of reflection");
    w.keywords = "Reflection, Gratitude, Faithfulness";
    w.endReflections[2] = w.endReflections[2].replace(/^where /, "Where ");
  }

  // ── TYPOS: endReflections & trackerLabels ─────────────────────────────────
  w = W(14);
  if (w) {
    w.endReflections[0] = w.endReflections[0].replace("is self-control strengthen", "did self-control strengthen");
    w.endReflections[2] = w.endReflections[2].replace("Waht habits", "What habits");
  }
  w = W(15);
  if (w) w.endReflections[2] = w.endReflections[2].replace("How I continue growing", "How will I continue growing");
  w = W(20);
  if (w) {
    w.endReflections[0] = w.endReflections[0].replace("expercience", "experience");
    w.endReflections[2] = w.endReflections[2].replace("foward", "forward");
  }
  w = W(23);
  if (w) w.endReflections[2] = w.endReflections[2].replace("foward", "forward");
  w = W(25);
  if (w) {
    w.trackerLabel = w.trackerLabel.replace("Accountabilty", "Accountability");
    w.endReflections[0] = w.endReflections[0].replace("Accountabilty", "Accountability");
  }
  w = W(29);
  if (w) w.trackerLabel = w.trackerLabel.replace("Encouragment", "Encouragement");
  w = W(34);
  if (w) w.endReflections[2] = w.endReflections[2].replace("How I continue investing", "How will I continue investing");

  console.log("patch.js v2: complete.");
})();
