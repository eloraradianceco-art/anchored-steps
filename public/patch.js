/**
 * Anchored Steps — Content Patch
 * Fixes all known corruption in data.js (studyNotes fragments, reflection
 * prompt page numbers, typos). Load AFTER data.js and BEFORE main.jsx.
 *
 * index.html load order:
 *   <script src="/data.js"></script>
 *   <script src="/patch.js"></script>       ← ADD THIS LINE
 *   <script type="module" src="/src/main.jsx"></script>
 */
(function () {
  if (!window.__APPDATA__) return;
  var weeks = window.__APPDATA__.ALL_WEEKS;
  function getWeek(n) { return weeks.find(function (w) { return w.week === n; }); }
  function fix(s, from, to) { return s.split(from).join(to); }

  var w;

  /* ─────────────────────────────────────────────────────────────────────
     WEEKS 11–21: remove embedded numbered question fragments from studyNotes
     ───────────────────────────────────────────────────────────────────── */

  w = getWeek(11);
  if (w) w.studyNotes = fix(w.studyNotes,
    "\n\n1.Who or what do I find hardest to forgive, and why?\n\n2.How has God\u2019s forgiveness toward me shaped my\n\n3.What emotions surface when I consider\n\n4. How might forgiveness bring freedom to",
    "");

  w = getWeek(12);
  if (w) w.studyNotes = fix(w.studyNotes,
    "\n\n1.How would I describe my\n\n2.What tends to distract or discourage me\n\n3.How does prayer influence my\n\n4. What would it look like to practice continual prayer",
    "");

  w = getWeek(13);
  if (w) w.studyNotes = fix(w.studyNotes,
    "\n\n1.How would I define integrity in\n\n2.Are there areas where my actions and\n\n3.What boundaries help\n\n4. How does integrity influence my relationship with God and others?",
    "");

  w = getWeek(14);
  if (w) w.studyNotes = fix(w.studyNotes,
    "\n\n1.In what areas do I struggle most with self-control?\n\n2.How does the Holy Spirit help me practice restraint rather than\n\n3.What boundaries protect\n\n4. How might self-control lead to greater freedom",
    "");

  w = getWeek(15);
  if (w) w.studyNotes = fix(w.studyNotes,
    "\n\n1.In what areas of my life do I need God\u2019s\n\n2.How do I typically seek guidance through prayer and self-reliance?\n\n3.What does reverence for God look like in\n\n4. How can wisdom shape the way I",
    "");

  w = getWeek(16);
  if (w) w.studyNotes = fix(w.studyNotes,
    "\n\n1.How do I typically make decisions -\n\n2.What voices or influences most shape my\n\n3.How does Scripture\n\n4. Where is God inviting me to slow down",
    "");

  w = getWeek(17);
  if (w) w.studyNotes = fix(w.studyNotes,
    "\n\n1.What situations most disrupt my\n\n2.How does prayer help restore peace\n\n3.Where do I need to release control and trust God more fully?\n\n4. How can I keep my mind fixed on God",
    "");

  w = getWeek(18);
  if (w) w.studyNotes = fix(w.studyNotes,
    "\n\n1.How do I typically view service - as\n\n2.Where is God inviting me to serve\n\n3.How does servanthood reflect Christ\u2019s love\n\n4. What attitude might need to change for me",
    "");

  w = getWeek(19);
  if (w) w.studyNotes = fix(w.studyNotes,
    "\n\n1.What resources has God entrusted to me and how am I managing them?\n\n2.How do my daily habits reflect my\n\n3.Where might God be calling me to be more\n\n4. How does stewardship deepen my sense of",
    "");

  w = getWeek(20);
  if (w) w.studyNotes = fix(w.studyNotes,
    "\n\n1.How do I distinguish between happiness\n\n2.What tends to steal my\n\n3.How does focusing on God\u2019s\n\n4. What practices help me remain rooted",
    "");

  // Week 21: remove embedded questions AND the corrupt duplicate paragraph block
  w = getWeek(21);
  if (w) w.studyNotes = fix(w.studyNotes,
    "\n\n1.How do I usually express kindness in\n\n2.Where might God be inviting me to show\n\n3.How does understanding God\u2019s kindness toward me shape how I treat others?\n\n4. What attitude or habits may hinder kindness\n\nScripture reveals kindness as a reflection of God\u2019s own character. Titus describes God\u2019s kindness as the motivation behind salvation, showing that kindness initiates restoration and invites repentance (Titus 3:4). Kindness is not weakness, but purposeful love. Paul urges believers kindness as an outflow of forgiveness and grace (Ephesians 4:32). Biblical kindness goes beyond politeness; it actively seeks the good of others, even when undeserved. It is rooted in compassion and sustained by humility.\n\nGod\u2019s kindness leads hearts toward healing and transformation. Romans teaches that kindness draws people toward repentance rather than fear. As believers reflect God\u2019s kindness through words and hinder kindness actions, they participate in God\u2019s redemptive work. Kindness builds unity, strengthens relationships, and serves as a powerful witness of God\u2019s love in daily life.",
    "");

  /* ─────────────────────────────────────────────────────────────────────
     WEEKS 23–52: mid-sentence corruption in studyNotes
     ───────────────────────────────────────────────────────────────────── */

  w = getWeek(23);
  if (w) w.studyNotes = fix(w.studyNotes,
    "their lives. faithfulness feels unnoticed or Paul emphasizes",
    "their lives. Paul emphasizes");

  w = getWeek(24);
  if (w) {
    w.studyNotes = fix(w.studyNotes,
      "revealing communication style under inner character",
      "revealing inner character");
    w.studyNotes = fix(w.studyNotes,
      "Paul instructs believers to speak building up with grace and purpose",
      "Paul instructs believers to speak with grace and purpose");
    w.studyNotes = fix(w.studyNotes,
      "while speech fosters unity and growth",
      "while gracious speech fosters unity and growth");
    w.studyNotes = fix(w.studyNotes,
      "prevents unnecessary conflict guide my speech more (James 1:19). God-honoring intentionally? communication",
      "prevents unnecessary conflict (James 1:19). God-honoring communication");
  }

  w = getWeek(25);
  if (w) w.studyNotes = fix(w.studyNotes,
    "God uses community to strengthen protect believers",
    "God uses community to protect believers");

  // Week 26: CONFIRMED FIX
  w = getWeek(26);
  if (w) w.studyNotes = fix(w.studyNotes,
    "strengthen? preserve purity",
    "strengthen and preserve purity");

  w = getWeek(27);
  if (w) w.studyNotes = fix(w.studyNotes,
    "their gifts for the of others",
    "their gifts for the good of others");

  // Week 28: CONFIRMED FIX
  w = getWeek(28);
  if (w) w.studyNotes = fix(w.studyNotes,
    "divisions are healed, pursue peace and relationships strengthened, and reconciliation?",
    "divisions are healed, relationships strengthened, and reconciliation pursued.");

  // Week 29: CONFIRMED FIX + others
  w = getWeek(29);
  if (w) {
    w.studyNotes = fix(w.studyNotes,
      "Paul difficulty instructs believers to consistently encourage",
      "Paul instructs believers to consistently encourage");
    w.studyNotes = fix(w.studyNotes,
      "restore greatest impact on those joy and confidence. around me?",
      "restore joy and confidence, with the greatest impact on those around me.");
    w.studyNotes = fix(w.studyNotes,
      "Encouragement is not flattery, but strengthen unity and intentional support truth.",
      "Encouragement is not flattery, but intentional support rooted in truth.");
  }

  w = getWeek(30);
  if (w) w.studyNotes = fix(w.studyNotes,
    "intentionally in God\u2019s design? purpose becomes clearer.",
    "purpose becomes clearer.");

  // Week 31: CONFIRMED FIX
  w = getWeek(31);
  if (w) w.studyNotes = fix(w.studyNotes,
    "not driven by recognition alone, but excellence? by devotion to God.",
    "not driven by recognition, but by devotion to God and a pursuit of excellence.");

  w = getWeek(32);
  if (w) {
    w.studyNotes = fix(w.studyNotes,
      "calling is rooted in God\u2019s than personal ambition",
      "calling is rooted in God\u2019s purposes rather than personal ambition");
    w.studyNotes = fix(w.studyNotes,
      "Vocation becomes sacred when it has God is surrendered to God.",
      "Vocation becomes sacred when it is surrendered to God.");
    w.studyNotes = fix(w.studyNotes,
      "through the others and glorify God? body of Christ.",
      "through the body of Christ.");
    w.studyNotes = fix(w.studyNotes,
      "Calling may seasons, but faithfulness remains constant.",
      "Calling may change across seasons, but faithfulness remains constant.");
  }

  // Week 33: CONFIRMED FIX + others
  w = getWeek(33);
  if (w) {
    w.studyNotes = fix(w.studyNotes,
      "all are prevent intended for the common good.",
      "all are intended for the common good.");
    w.studyNotes = fix(w.studyNotes,
      "strengthens the body of gifts Christ.",
      "strengthens the body of Christ.");
    w.studyNotes = fix(w.studyNotes,
      "encourages growth, service? and reflects God\u2019s love.",
      "encourages growth, and reflects God\u2019s love.");
  }

  w = getWeek(34);
  if (w) {
    w.studyNotes = fix(w.studyNotes,
      "Paul instructs journey? Timothy to pass on truth",
      "Paul instructs Timothy to pass on truth");
    w.studyNotes = fix(w.studyNotes,
      "preserved across generations. influence impactful?\n\nBiblical mentorship",
      "preserved across generations.\n\nBiblical mentorship");
    w.studyNotes = fix(w.studyNotes,
      "Mentorship to mentor models obedience",
      "Mentorship models obedience");
    w.studyNotes = fix(w.studyNotes,
      "or correction, to others? mentorship strengthens believers",
      "or correction, mentorship strengthens believers");
  }

  w = getWeek(35);
  if (w) {
    w.studyNotes = fix(w.studyNotes,
      "Jesus leadership? redefines greatness",
      "Jesus redefines greatness");
    w.studyNotes = fix(w.studyNotes,
      "Spiritual leadership requires self- awareness",
      "Spiritual leadership requires self-awareness");
    w.studyNotes = fix(w.studyNotes,
      "God God developing in me as a values leaders who example, model godly character",
      "God values leaders who model godly character");
  }

  w = getWeek(37);
  if (w) {
    w.studyNotes = fix(w.studyNotes,
      "faithfulness over time achievement.",
      "faithfulness over time rather than achievement.");
    w.studyNotes = fix(w.studyNotes,
      "faithfully in words, and actions? others.",
      "faithfully in others.");
    w.studyNotes = fix(w.studyNotes,
      "A on to consistent life of faith speaks louder than words alone.",
      "A consistent life of faith speaks louder than words alone.");
  }

  w = getWeek(39);
  if (w) w.studyNotes = fix(w.studyNotes,
    "When believers others? anchor their hope in God\u2019s promises, they experience strength, peace, and renewed",
    "When believers anchor their hope in God\u2019s promises, they experience strength, peace, and renewed purpose.");

  w = getWeek(40);
  if (w) w.studyNotes = fix(w.studyNotes,
    "Because God compassion is compassionate,",
    "Because God is compassionate,");

  w = getWeek(41);
  if (w) w.studyNotes = fix(w.studyNotes,
    "speak truth with grace, becomes visible.",
    "speak truth with grace, Christ becomes visible.");

  w = getWeek(42);
  if (w) w.studyNotes = fix(w.studyNotes,
    "they loosen a the grip",
    "they loosen the grip");

  w = getWeek(43);
  if (w) {
    w.studyNotes = fix(w.studyNotes,
      "vision is from God? essential for spiritual direction",
      "vision is essential for spiritual direction");
    w.studyNotes = fix(w.studyNotes,
      "reliance on God\u2019s decisions? promises.",
      "reliance on God\u2019s promises.");
    w.studyNotes = fix(w.studyNotes,
      "Vision grows through prayer, Scripture, clarity or trust in God\u2019s and obedience.",
      "Vision grows through prayer, Scripture, and obedience.");
    w.studyNotes = fix(w.studyNotes,
      "When believers timing? seek God\u2019s direction",
      "When believers seek God\u2019s direction");
  }

  w = getWeek(44);
  if (w) w.studyNotes = fix(w.studyNotes,
    "Perseverance through sustained trust in God.",
    "Perseverance is sustained through trust in God.");

  w = getWeek(45);
  if (w) {
    w.studyNotes = fix(w.studyNotes,
      "Galatians not to grow weary in doing good, reminding them that endurance produces fruit over time (Galatians 6:9).",
      "Galatians 6:9 urges believers not to grow weary in doing good, noting that endurance produces fruit over time.");
    w.studyNotes = fix(w.studyNotes,
      "unwavering, patient, and look like in sacrificial.",
      "unwavering, patient, and sacrificial.");
  }

  w = getWeek(46);
  if (w) {
    w.studyNotes = fix(w.studyNotes,
      "established by Sabbath? God.",
      "established by God.");
    w.studyNotes = fix(w.studyNotes,
      "look like When practiced faithfully",
      "When practiced faithfully");
  }

  w = getWeek(47);
  if (w) w.studyNotes = fix(w.studyNotes,
    "When toward believers surrender broken places to God",
    "When believers surrender broken places to God");

  w = getWeek(48);
  if (w) w.studyNotes = fix(w.studyNotes,
    "not human remain open to God\u2019s effort.",
    "not human effort.");

  w = getWeek(49);
  if (w) {
    w.studyNotes = fix(w.studyNotes,
      "is a central hope return of the Christian faith.",
      "is a central hope of the Christian faith.");
    w.studyNotes = fix(w.studyNotes,
      "live with return encourage urgency, hope, and perseverance. perseverance?",
      "live with urgency, hope, and perseverance.");
  }

  w = getWeek(50);
  if (w) w.studyNotes = fix(w.studyNotes,
    "Abiding like in means remaining",
    "Abiding means remaining");

  w = getWeek(51);
  if (w) {
    w.studyNotes = fix(w.studyNotes,
      "purpose, journey up perseverance,",
      "purpose, perseverance,");
    w.studyNotes = fix(w.studyNotes,
      "Faith that endures reflects circumstances.",
      "Faith that endures reflects trust in God regardless of circumstances.");
    w.studyNotes = fix(w.studyNotes,
      "dependence on God. like in my\n\nA life that finishes well",
      "dependence on God.\n\nA life that finishes well");
  }

  w = getWeek(52);
  if (w) {
    w.studyNotes = fix(w.studyNotes,
      "Reflection allows believers to see how God has growth, challenge, obedience, and renewal.",
      "Reflection allows believers to see how God has worked through growth, challenge, obedience, and renewal.");
    w.studyNotes = fix(w.studyNotes,
      "gratitude into worship. carry forward into the next A year of reflection",
      "gratitude into worship. A year of reflection");
    w.keywords = "Reflection, Gratitude, Faithfulness";
  }

  /* ─────────────────────────────────────────────────────────────────────
     REFLECTION PROMPTS: trailing PDF page numbers & typos
     ───────────────────────────────────────────────────────────────────── */

  function fixPrompts(weekNum, fixes) {
    w = getWeek(weekNum);
    if (!w) return;
    w.reflectionPrompts = w.reflectionPrompts.map(function (p) {
      var out = p;
      fixes.forEach(function (f) { out = fix(out, f[0], f[1]); });
      return out;
    });
  }

  fixPrompts(22, [["? 34", "?"]]);
  fixPrompts(23, [["? 0", "?"], ["Where id God calling", "Where is God calling"]]);
  fixPrompts(26, [["? 58", "?"]]);
  fixPrompts(27, [["? 4", "?"]]);
  fixPrompts(28, [["? 70", "?"]]);
  fixPrompts(29, [["during difficulty seasons", "during difficult seasons"], ["? 6", "?"]]);
  fixPrompts(30, [["reffing", "refining"], ["? 182", "?"]]);
  fixPrompts(31, [["? 8", "?"]]);
  fixPrompts(32, [["? 4", "?"]]);
  fixPrompts(33, [["? 200", "?"]]);
  fixPrompts(34, [["? 6", "?"]]);
  fixPrompts(35, [["? 2", "?"]]);
  fixPrompts(36, [["How do i respond", "How do I respond"], ["? 8", "?"]]);
  fixPrompts(37, [["? 224", "?"]]);
  fixPrompts(39, [["? 6", "?"]]);
  fixPrompts(41, [["? 48", "?"]]);
  fixPrompts(42, [["? 4", "?"]]);
  fixPrompts(43, [["? 0", "?"]]);
  fixPrompts(44, [["? 6", "?"]]);
  fixPrompts(49, [["? 96", "?"]]);
  fixPrompts(50, [["What practice help", "What practices help"], ["? 302", "?"]]);
  fixPrompts(51, [["? 08", "?"]]);

  /* ─────────────────────────────────────────────────────────────────────
     END REFLECTIONS: typos
     ───────────────────────────────────────────────────────────────────── */

  function fixEndReflections(weekNum, fixes) {
    w = getWeek(weekNum);
    if (!w) return;
    w.endReflections = w.endReflections.map(function (p) {
      var out = p;
      fixes.forEach(function (f) { out = fix(out, f[0], f[1]); });
      return out;
    });
  }

  fixEndReflections(14, [
    ["Where is self-control strengthen my faith this week?", "Where did self-control strengthen my faith this week?"],
    ["Waht habits", "What habits"]
  ]);
  fixEndReflections(15, [["How I continue growing in wisdom moving forward?", "How will I continue growing in wisdom moving forward?"]]);
  fixEndReflections(20, [["expercience", "experience"], ["moving foward", "moving forward"]]);
  fixEndReflections(23, [["moving foward", "moving forward"]]);
  fixEndReflections(25, [["Accountabilty", "Accountability"]]);
  fixEndReflections(34, [["How I continue investing in spiritual relationships?", "How will I continue investing in spiritual relationships?"]]);
  fixEndReflections(37, [["Legacy -building", "legacy-building"]]);
  fixEndReflections(44, [["through trail this week", "through trial this week"]]);
  fixEndReflections(45, [["patience ir commitment", "patience or commitment"]]);
  fixEndReflections(49, [["on enternity shape", "on eternity shape"]]);
  fixEndReflections(52, [["where do I sense God leading me next?", "Where do I sense God leading me next?"]]);

  /* ─────────────────────────────────────────────────────────────────────
     TRACKER LABELS: typos
     ───────────────────────────────────────────────────────────────────── */

  w = getWeek(25);
  if (w) w.trackerLabel = fix(w.trackerLabel, "Accountabilty", "Accountability");

  w = getWeek(29);
  if (w) w.trackerLabel = fix(w.trackerLabel, "Encouragment", "Encouragement");

})();
