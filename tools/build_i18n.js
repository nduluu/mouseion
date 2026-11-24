// Split the interface text into one small file per language.
//
// js/i18n.js stays the one place where interface text is written (all
// languages together, easy to compare). Visitors don't load it: they load
//   i18n/gate.js      "Choose your language" in every language (the picker)
//   i18n/en.js        English, the fallback for anything not yet translated
//   i18n/<code>.js    their own language
// Run after changing js/i18n.js:   node tools/build_i18n.js
// It also updates the version in index.html, so browsers fetch the new files.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "js", "i18n.js"), "utf8");
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(src + "\n;this.__I18N = I18N;", ctx);
const I18N = ctx.__I18N;

const OUT = path.join(ROOT, "i18n");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);

const GATE_KEYS = ["chooseLanguage", "searchLanguages"];
const header = "// Built by tools/build_i18n.js from js/i18n.js; edit that file, not this one.\n";
const hash = crypto.createHash("sha1");
let total = 0;

for (const code of Object.keys(I18N).sort()) {
  const body = header +
    "(window.I18N = window.I18N || {})[" + JSON.stringify(code) + "] = Object.assign(window.I18N[" + JSON.stringify(code) +
    "] || {}, " + JSON.stringify(I18N[code]) + ");\n" +
    "(window.I18N_LOADED = window.I18N_LOADED || {})[" + JSON.stringify(code) + "] = true;\n";
  fs.writeFileSync(path.join(OUT, code + ".js"), body);
  hash.update(body);
  total += body.length;
}

const gate = {};
for (const code of Object.keys(I18N)) {
  const g = {};
  for (const k of GATE_KEYS) if (I18N[code][k]) g[k] = I18N[code][k];
  if (Object.keys(g).length) gate[code] = g;
}
const gateBody = header +
  "(function (G) {\n  var I = (window.I18N = window.I18N || {});\n" +
  "  for (var c in G) I[c] = Object.assign(G[c], I[c] || {});\n})(" + JSON.stringify(gate) + ");\n";
fs.writeFileSync(path.join(OUT, "gate.js"), gateBody);
hash.update(gateBody);

// The version the page asks for (cache-busting).
const version = hash.digest("hex").slice(0, 10);
const indexPath = path.join(ROOT, "index.html");
const html = fs.readFileSync(indexPath, "utf8");
const updated = html.replace(/var I18N_V = "[^"]*";/, 'var I18N_V = "' + version + '";');
if (updated === html && !html.includes('var I18N_V = "' + version + '";')) {
  console.error("index.html: no 'var I18N_V = \"…\";' line to update");
  process.exit(1);
}
fs.writeFileSync(indexPath, updated);

const sizes = Object.keys(I18N).map((c) => fs.statSync(path.join(OUT, c + ".js")).size);
console.log(Object.keys(I18N).length + " languages -> i18n/ (" + Math.round(total / 1024) + " KB in all; one language " +
  Math.round(Math.min(...sizes) / 1024) + "–" + Math.round(Math.max(...sizes) / 1024) + " KB; gate.js " +
  Math.round(gateBody.length / 1024) + " KB), version " + version);
