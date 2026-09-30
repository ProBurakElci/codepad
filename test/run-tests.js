/*
 * Tests:  node test/run-tests.js
 *
 * Two things here can hurt somebody, and both are covered hardest:
 *
 *   1. Highlighting writes into innerHTML. If a token carrying <script> came
 *      out unescaped, typing it into the editor would run it in the page.
 *   2. The tokeniser must never lose or reorder a character. If the highlighted
 *      layer does not match the textarea exactly, the caret drifts away from
 *      the text underneath it.
 *
 * Both are checked against every language, with awkward input.
 */
"use strict";

const Highlight = require("../js/highlight.js");
const Share = require("../js/share.js");
const Samples = require("../js/samples.js");

let passed = 0;
let failed = 0;

function ok(label, condition) {
  if (condition) passed++;
  else {
    failed++;
    console.error("  FAILED: " + label);
  }
}

function eq(label, actual, expected) {
  ok(label + " (got " + JSON.stringify(actual) + ", expected " + JSON.stringify(expected) + ")",
    actual === expected);
}

function section(name) {
  console.log("\n" + name);
}

const LANGUAGE_IDS = Object.keys(Highlight.LANGUAGES);

/* ---------------- nothing may be lost ---------------- */

section("The tokeniser never loses a character");

const AWKWARD = [
  "",
  "\n",
  "a",
  "const x = 1;",
  "// just a comment",
  "/* unterminated block comment",
  "\"unterminated string",
  "'\"`",
  "const s = \"he said \\\"hi\\\"\";",
  "a\n\n\nb",
  "\t\tindented",
  "emoji 🙂 and ünïcode",
  "x = 0x1F + 1e10 + 3.14;",
  "<div class=\"a\">text</div>",
  "# heading\n- item\n> quote",
  "SELECT * FROM t WHERE a = 'b';",
  "a".repeat(5000),
];

let roundTripped = true;
for (const id of LANGUAGE_IDS) {
  for (const input of AWKWARD) {
    const back = Highlight.plainText(Highlight.tokenize(input, id));
    if (back !== input) {
      roundTripped = false;
      console.error("  lost text in " + id + ": " + JSON.stringify(input.slice(0, 40)));
    }
  }
}
ok("every language returns exactly what it was given, for all " +
  AWKWARD.length + " awkward inputs", roundTripped);

eq("an unknown language falls back instead of throwing",
  Highlight.plainText(Highlight.tokenize("const a = 1;", "klingon")), "const a = 1;");
eq("null is treated as empty", Highlight.plainText(Highlight.tokenize(null, "javascript")), "");

/* ---------------- escaping ---------------- */

section("Nothing reaches innerHTML unescaped");

const DANGEROUS = [
  "<script>alert(1)</script>",
  "const s = \"<img src=x onerror=alert(1)>\";",
  "// <script>alert(1)</script>",
  "<div onclick=\"alert(1)\">",
  "a & b < c > d",
  "\"'&<>",
];

let escapedEverywhere = true;
for (const id of LANGUAGE_IDS) {
  for (const input of DANGEROUS) {
    const html = Highlight.toHtml(input, id);
    // the only < in the output may be the ones this module wrote itself
    const withoutOurSpans = html.replace(/<\/?span[^>]*>/g, "");
    if (withoutOurSpans.includes("<") || withoutOurSpans.includes(">")) {
      escapedEverywhere = false;
      console.error("  unescaped in " + id + ": " + JSON.stringify(input));
    }
  }
}
ok("dangerous input is escaped in every language", escapedEverywhere);

eq("ampersands go first", Highlight.escapeHtml("&<>"), "&amp;&lt;&gt;");
eq("quotes are escaped too", Highlight.escapeHtml("\"'"), "&quot;&#39;");
ok("a script tag cannot survive",
  !Highlight.toHtml("<script>x</script>", "javascript").includes("<script>"));

/* ---------------- it actually highlights ---------------- */

section("It recognises what it should");

function typesIn(code, id) {
  const types = new Set();
  for (const token of Highlight.tokenize(code, id)) types.add(token.type);
  return types;
}

ok("javascript keywords", typesIn("const x = 1;", "javascript").has("keyword"));
ok("javascript strings", typesIn("const s = 'hi';", "javascript").has("string"));
ok("javascript numbers", typesIn("const n = 42;", "javascript").has("number"));
ok("javascript comments", typesIn("// hi", "javascript").has("comment"));
ok("javascript block comments", typesIn("/* hi */", "javascript").has("comment"));
ok("javascript calls", typesIn("doThing()", "javascript").has("call"));
ok("javascript literals", typesIn("const a = true;", "javascript").has("literal"));

ok("python keywords", typesIn("def f():", "python").has("keyword"));
ok("python uses # for comments", typesIn("# hi", "python").has("comment"));
ok("python builtins", typesIn("print(1)", "python").has("builtin"));
ok("python has no block comments",
  !typesIn("/* not a comment in python */", "python").has("comment"));

ok("html tags", typesIn("<div>", "html").has("tag"));
ok("html attributes", typesIn("<a href=\"x\">", "html").has("attr"));
ok("html attribute values are strings", typesIn("<a href=\"x\">", "html").has("string"));
ok("html comments", typesIn("<!-- hi -->", "html").has("comment"));
ok("a quoted > does not end the tag",
  Highlight.plainText(Highlight.tokenize("<a title=\"a>b\">x</a>", "html")) === "<a title=\"a>b\">x</a>");

ok("sql is case insensitive", typesIn("select * from t", "sql").has("keyword"));
ok("sql uppercase works too", typesIn("SELECT * FROM t", "sql").has("keyword"));
ok("sql uses -- for comments", typesIn("-- hi", "sql").has("comment"));

ok("markdown headings", typesIn("# title", "markdown").has("keyword"));
ok("markdown lists", typesIn("- item", "markdown").has("builtin"));

ok("css properties", typesIn("color: red;", "css").has("attr"));
ok("json strings", typesIn("{\"a\": 1}", "json").has("string"));

eq("a comment swallows the rest of its line",
  Highlight.tokenize("a // b\nc", "javascript").filter((t) => t.type === "comment")[0].value,
  "// b");

/* ---------------- the language list ---------------- */

section("The language list");

const list = Highlight.list();
eq("every language is listed", list.length, LANGUAGE_IDS.length);
ok("at least fifteen languages", list.length >= 15);
ok("each has a name", list.every((l) => l.name && l.name.length > 0));
ok("each has a file extension", list.every((l) => l.ext && l.ext.length > 0));

const runnable = list.filter((l) => l.run);
eq("three of them run", runnable.length, 3);
ok("javascript runs", runnable.some((l) => l.id === "javascript"));
ok("python runs", runnable.some((l) => l.id === "python"));
ok("html renders", runnable.some((l) => l.id === "html"));
ok("nothing else claims to run",
  runnable.every((l) => ["javascript", "python", "html"].indexOf(l.id) !== -1));

/* ---------------- samples ---------------- */

section("Every language starts with something");

ok("every language has a sample", LANGUAGE_IDS.every((id) => Samples.get(id).length > 20));
ok("samples round trip through the tokeniser",
  LANGUAGE_IDS.every((id) => Highlight.plainText(Highlight.tokenize(Samples.get(id), id)) === Samples.get(id)));
ok("an unknown language still gets a sample", Samples.get("klingon").length > 20);

/* ---------------- sharing ---------------- */

section("Putting code in a link");

const SNIPPETS = [
  "const a = 1;",
  "print('hi')",
  "ünïcode ✅ 🙂 中文",
  "line one\nline two\n\ttabbed",
  "a+b/c=d&e?f#g",
  "\"'`<>&",
  "x".repeat(3000),
  "",
];

let shareRoundTrip = true;
for (const snippet of SNIPPETS) {
  if (Share.decode(Share.encode(snippet)) !== snippet) {
    shareRoundTrip = false;
    console.error("  lost: " + JSON.stringify(snippet.slice(0, 30)));
  }
}
ok("everything survives the trip into a link and back", shareRoundTrip);

const encoded = Share.encode("a+b/c?d&e=f");
ok("the payload is URL safe", !/[+/=]/.test(encoded));
ok("and carries no characters a chat app would eat", /^[A-Za-z0-9_-]*$/.test(encoded));

eq("rubbish decodes to null instead of throwing", Share.decode("!!!not base64!!!"), null);
eq("characters a base64 decoder would silently skip are rejected", Share.decode("ab*cd"), null);
eq("bytes that are not text are rejected", Share.decode("_____w"), null);
eq("an empty payload is an empty snippet", Share.decode(""), "");
eq("a missing payload is null", Share.decode(null), null);
eq("a number is null", Share.decode(42), null);

const url = Share.buildUrl("https://example.com/pad/", "console.log(1)", "javascript");
const read = Share.readUrl(new URL(url).search);
eq("the code comes back", read.code, "console.log(1)");
eq("the language comes back", read.language, "javascript");
eq("a link with no code reads as nothing", Share.readUrl("?lang=python"), null);
eq("an empty search reads as nothing", Share.readUrl(""), null);

ok("a short snippet is shareable", !Share.isTooLongToShare(url));
ok("a huge one is not",
  Share.isTooLongToShare(Share.buildUrl("https://example.com/", "x".repeat(20000), "javascript")));

/* ---------------- the draft ---------------- */

section("The draft in this browser");

function fakeStorage(options) {
  const opts = options || {};
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => {
      if (opts.full) throw new Error("QuotaExceededError");
      data.set(k, v);
    },
    removeItem: (k) => data.delete(k),
    size: () => data.size,
  };
}

const store = fakeStorage();
ok("saving works", Share.save(store, "const a = 1;", "javascript"));
const loaded = Share.load(store);
eq("the draft comes back", loaded.code, "const a = 1;");
eq("with its language", loaded.language, "javascript");

Share.clear(store);
eq("clearing removes it", Share.load(store), null);

eq("a full quota is not an error", Share.save(fakeStorage({ full: true }), "x", "javascript"), false);
eq("no storage at all is not an error", Share.save(null, "x", "javascript"), false);
eq("loading without storage is null", Share.load(null), null);

const broken = fakeStorage();
broken.setItem(Share.KEY, "{not json");
eq("a corrupted draft is ignored", Share.load(broken), null);

const wrongShape = fakeStorage();
wrongShape.setItem(Share.KEY, JSON.stringify({ nothing: true }));
eq("a draft with no code is ignored", Share.load(wrongShape), null);

/* ---------------- size ---------------- */

section("It stays quick on a big file");

const big = Samples.get("javascript").repeat(200);
const started = Date.now();
Highlight.toHtml(big, "javascript");
const took = Date.now() - started;
ok("highlighting " + Math.round(big.length / 1024) + " KB takes under 400 ms (took " +
  took + " ms)", took < 400);

console.log("\n" + passed + " passed, " + failed + " failed.");
process.exit(failed ? 1 : 0);
