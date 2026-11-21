// Public-domain rules by country, and the date an edition becomes public domain.
//
// SIMPLIFIED: copyright lasts for the life of the last surviving creator plus a
// number of years that depends on the country; protection ends on 31 December,
// so the work is free from 1 January of the following year. The United States
// counts from publication for works published before 1978. Many details are
// left out (wartime extensions, rule of the shorter term, special rights for
// critical editions, photographs, anonymous works...). Must be reviewed by a
// lawyer before Mouseion is public.
const Rights = (() => {
  // ISO 3166-1 alpha-2 codes of all countries and territories.
  const COUNTRIES = (
    "AD AE AF AG AI AL AM AO AR AS AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR " +
    "BS BT BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ " +
    "EC EE EG ER ES ET FI FJ FM FO FR GA GB GD GE GH GI GL GM GN GQ GR GT GU GW GY HK " +
    "HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA " +
    "LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX " +
    "MY MZ NA NE NG NI NL NO NP NR NU NZ OM PA PE PG PH PK PL PR PS PT PW PY QA RO RS " +
    "RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN " +
    "TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW"
  ).split(" ");

  // Copyright term in years after the creator's death. Countries not listed use
  // 50, the minimum required by the Berne Convention.
  const LIFE_PLUS = {};
  const set = (years, codes) => codes.split(" ").forEach((c) => { LIFE_PLUS[c] = years; });
  set(70, // EU, EEA, and others with life + 70
    "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE " +
    "IS LI NO CH GB AD MC SM VA AL BA ME MK RS XK MD UA RU GE AM KZ TR IL " +
    "AU CA JP KR SG BR AR CL PE PY EC CR DO NG GH MA BH OM QA");
  set(60, "IN VE BD");
  set(75, "GT HN");
  set(80, "CO");
  set(99, "CI");
  set(100, "MX");

  // Extensions that did not revive works already in the public domain:
  // creators who died before `before` keep the older term.
  const TRANSITIONS = {
    AU: { before: 1955, years: 50 },
    JP: { before: 1968, years: 50 },
    CA: { before: 1972, years: 50 },
    ES: { before: 1987, years: 80 }, // Spain: older law gave life + 80
  };

  function termFor(country, died) {
    const tr = TRANSITIONS[country];
    if (tr && died < tr.before) return tr.years;
    return LIFE_PLUS[country] || 50;
  }

  // First year in which the edition is public domain in `country`.
  // Returns -Infinity for works with no (known) modern creators, such as
  // manuscripts, and null if a creator's death year is unknown.
  function pdYear(edition, country) {
    const creators = edition.creators || [];
    if (!creators.length) return -Infinity;
    if (creators.some((c) => c.died == null)) return null;
    const died = Math.max(...creators.map((c) => c.died));
    if (country === "US" && edition.year != null && edition.year < 1978) {
      return edition.year + 96; // 95 years from publication
    }
    return died + termFor(country, died) + 1;
  }

  function currentYear() {
    return new Date().getUTCFullYear();
  }

  function isPD(edition, country) {
    const y = pdYear(edition, country);
    return y != null && y <= currentYear();
  }

  // Where the edition is public domain now, and where it will be (soonest first).
  function survey(edition) {
    const now = currentYear();
    const free = [], later = [];
    for (const c of COUNTRIES) {
      const y = pdYear(edition, c);
      if (y != null && y <= now) free.push(c);
      else later.push({ country: c, year: y });
    }
    later.sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity));
    return { free, later };
  }

  // The visitor's country: saved choice, else the region in the browser's
  // language settings (e.g. "de-CH" → CH), else the likeliest region.
  const KEY = "mouseion.country";
  function country() {
    const saved = localStorage.getItem(KEY);
    if (saved && COUNTRIES.includes(saved)) return saved;
    for (const l of navigator.languages || [navigator.language]) {
      const m = /-([A-Z]{2})(?:-|$)/.exec(l || "");
      if (m && COUNTRIES.includes(m[1])) return m[1];
    }
    try {
      const r = new Intl.Locale(navigator.language).maximize().region;
      if (COUNTRIES.includes(r)) return r;
    } catch (e) { /* fall through */ }
    return "US";
  }

  function setCountry(c) {
    localStorage.setItem(KEY, c);
  }

  function countryName(c, lang) {
    try {
      return new Intl.DisplayNames([lang, "en"], { type: "region" }).of(c) || c;
    } catch (e) {
      return c;
    }
  }

  // Countries sorted by name in the UI language.
  function countriesByName(lang) {
    const coll = new Intl.Collator(lang);
    return COUNTRIES.map((c) => ({ code: c, name: countryName(c, lang) }))
      .sort((a, b) => coll.compare(a.name, b.name));
  }

  // Midnight UTC on 1 January of `year`.
  function startOf(year) {
    const d = new Date(0);
    d.setUTCFullYear(year, 0, 1);
    return d.getTime();
  }

  return { pdYear, isPD, survey, country, setCountry, countryName, countriesByName, startOf, COUNTRIES };
})();
window.Rights = Rights;
