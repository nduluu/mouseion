// Timeline (3400 BCE → today) + drill-down calendar (centuries/decades/years/months)
// in multiple calendar systems, via the Intl API. Exact dates come from ICU; the
// timeline strip itself uses mean year lengths, which is accurate at century scale.
const TimeCal = (() => {
  const DAY = 86400000;
  const PX_PER_CENTURY = 150;

  const CALS = [
    { id: "gregory", key: "calGregory", meanYear: 365.2425 },
    { id: "islamic-umalqura", key: "calIslamic", meanYear: 354.36708 },
    { id: "persian", key: "calPersian", meanYear: 365.2422 },
    { id: "hebrew", key: "calHebrew", meanYear: 365.2468 },
    { id: "buddhist", key: "calBuddhist", meanYear: 365.2425 },
    { id: "indian", key: "calIndian", meanYear: 365.2425 },
    { id: "ethiopic", key: "calEthiopic", meanYear: 365.25 },
    { id: "coptic", key: "calCoptic", meanYear: 365.25 },
  ];
  const byId = Object.fromEntries(CALS.map((c) => [c.id, c]));

  // Default calendar implied by the chosen site language.
  const LANG_CAL = {
    fa: "persian", ps: "persian",
    ar: "islamic-umalqura", ur: "islamic-umalqura", sd: "islamic-umalqura",
    ckb: "islamic-umalqura", ks: "islamic-umalqura", dv: "islamic-umalqura",
    bal: "islamic-umalqura",
    he: "hebrew", yi: "hebrew",
    am: "ethiopic", ti: "ethiopic",
    th: "buddhist", lo: "buddhist", km: "buddhist",
  };

  const NEG_ERAS = new Set(["BC", "BCE", "B", "ERA0"]);
  // 3400 BCE, noon UTC (astronomical year -3399)
  const START = (() => { const d = new Date(0); d.setUTCFullYear(-3399, 0, 1); return d.getTime() + DAY / 2; })();
  const NOW = Date.now();

  let locale = "en";
  let cal = CALS[0];
  let state = { level: "month", Y: 0, M: 0 };
  let els = null;
  const parsers = {};
  const fmtCache = {};

  function t(key) {
    const lang = document.documentElement.lang;
    return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
  }

  function parser(c) {
    return (parsers[c.id] ||= new Intl.DateTimeFormat("en-u-ca-" + c.id + "-nu-latn", {
      era: "short", year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC",
    }));
  }

  // Calendar fields of a timestamp; y is the signed year (era-aware).
  function fields(ts, c = cal) {
    const o = {};
    for (const p of parser(c).formatToParts(ts)) {
      if (p.type === "era") o.era = p.value;
      else if (p.type === "year") o.year = parseInt(p.value, 10);
      // month can be a name (e.g. Hebrew "Av"), so compare it as a string
      else if (p.type === "month") o.month = p.value;
      else if (p.type === "day") o.day = parseInt(p.value, 10);
    }
    o.y = NEG_ERAS.has(o.era) ? 1 - o.year : o.year;
    return o;
  }

  function fmt(opts) {
    const key = locale + "|" + cal.id + "|" + JSON.stringify(opts);
    return (fmtCache[key] ||= new Intl.DateTimeFormat(locale + "-u-ca-" + cal.id, { timeZone: "UTC", ...opts }));
  }

  function nf() {
    const key = "nf|" + locale;
    return (fmtCache[key] ||= new Intl.NumberFormat(locale, { useGrouping: false }));
  }

  // First day (noon UTC) of calendar year Y, or null if the calendar can't resolve it.
  function yearStart(Y, c = cal) {
    try {
      if (c.id === "gregory") {
        const d = new Date(0); d.setUTCFullYear(Y, 0, 1); return d.getTime() + DAY / 2;
      }
      const curY = fields(NOW, c).y;
      let lo = NOW - (curY - Y + 2) * c.meanYear * DAY;
      let hi = NOW - (curY - Y - 2) * c.meanYear * DAY;
      let guard = 0;
      while (fields(lo, c).y >= Y && guard++ < 12) lo -= 400 * DAY;
      while (fields(hi, c).y < Y && guard++ < 12) hi += 400 * DAY;
      if (guard >= 12) return null;
      // binary search on whole days for the first day with signed year >= Y
      let dLo = Math.floor((lo - START) / DAY), dHi = Math.ceil((hi - START) / DAY);
      const at = (d) => START + d * DAY;
      while (dLo < dHi) {
        const mid = (dLo + dHi) >> 1;
        if (fields(at(mid), c).y < Y) dLo = mid + 1; else dHi = mid;
      }
      const res = at(dLo);
      return fields(res, c).y === Y ? res : null;
    } catch (e) {
      return null;
    }
  }

  // Months of calendar year Y: [{t, days, month}] or null → caller falls back to approx.
  function monthsOf(Y) {
    const s = yearStart(Y), e = yearStart(Y + 1);
    if (s == null || e == null || !(e > s) || e - s > 500 * DAY) return null;
    const ms = [];
    let ts = s, guard = 0;
    while (ts < e - DAY / 2 && guard++ < 20) {
      const f0 = fields(ts);
      let n = ts + 25 * DAY;
      while (n < e && fields(n).month === f0.month) n += DAY;
      if (n > e) n = e;
      ms.push({ t: ts, days: Math.round((n - ts) / DAY), month: f0.month });
      ts = n;
    }
    return ms.length ? ms : null;
  }

  // Approximate months for years the calendar engine can't resolve (deep past):
  // names borrowed from the current year, positions from mean year length.
  function monthsApprox(Y) {
    const curY = fields(NOW).y;
    const ref = monthsOf(curY) || [];
    const n = ref.length || 12;
    const t0 = NOW - (curY - Y) * cal.meanYear * DAY;
    const step = (cal.meanYear * DAY) / n;
    const ms = [];
    for (let i = 0; i < n; i++) {
      ms.push({ t: t0 + i * step, days: Math.round(cal.meanYear / n), month: i + 1, nameT: ref[i] ? ref[i].t : null, approx: true });
    }
    return ms;
  }

  function yearLabel(Y) {
    const s = yearStart(Y);
    if (s != null) return fmt(Y < 1 ? { year: "numeric", era: "short" } : { year: "numeric" }).format(s);
    return nf().format(Y);
  }

  function monthName(m) {
    return fmt({ month: "long" }).format(m.approx && m.nameT != null ? m.nameT : m.t);
  }

  // ---------- timeline strip ----------

  function model() {
    const curY = fields(NOW).y + 0.5;
    const total = (NOW - START) / DAY / cal.meanYear;
    return { startY: curY - total, endY: curY };
  }

  function pos(Y, m) {
    const c0 = Math.floor(m.startY / 100) * 100;
    return ((Y - c0) / 100) * PX_PER_CENTURY;
  }

  function renderStrip() {
    const m = model();
    const c0 = Math.floor(m.startY / 100) * 100;
    els.track.textContent = "";
    for (let c = c0; c < m.endY; c += 100) {
      const cell = document.createElement("div");
      cell.className = "tl-cent";
      const w = Math.min(100, m.endY - c) / 100 * PX_PER_CENTURY;
      cell.style.width = w + "px";
      const lbl = document.createElement("span");
      lbl.className = "lbl";
      lbl.textContent = nf().format(c);
      cell.appendChild(lbl);
      els.track.appendChild(cell);
    }
    els.track.appendChild(els.today);
    els.track.appendChild(els.marker);
    els.today.style.insetInlineStart = pos(m.endY, m) - 1 + "px";
    updateMarker();
  }

  function updateMarker() {
    const m = model();
    const Y = Math.min(Math.max(state.Y + 0.5, m.startY), m.endY);
    els.marker.style.insetInlineStart = pos(Y, m) - 1 + "px";
  }

  function stripClick(ev) {
    const rect = els.track.getBoundingClientRect();
    const m = model();
    const rtl = document.documentElement.dir === "rtl";
    const x = rtl ? rect.right - ev.clientX : ev.clientX - rect.left;
    const c0 = Math.floor(m.startY / 100) * 100;
    let Y = Math.round(c0 + (x / PX_PER_CENTURY) * 100);
    Y = Math.min(Math.max(Y, Math.ceil(m.startY)), Math.floor(m.endY));
    setState({ level: "year", Y });
  }

  function scrollToToday() {
    els.today.scrollIntoView({ inline: "center", block: "nearest" });
  }

  // ---------- calendar grid ----------

  function clampY(Y) {
    const m = model();
    return Math.min(Math.max(Y, Math.ceil(m.startY)), fields(NOW).y);
  }

  function setState(patch) {
    state = { ...state, ...patch };
    state.Y = clampY(state.Y);
    render();
  }

  function cell(label, cls, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cell" + (cls ? " " + cls : "");
    b.textContent = label;
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }

  function render() {
    const grid = els.grid;
    grid.textContent = "";
    grid.classList.remove("days");
    const curF = fields(NOW);
    let title = "";

    if (state.level === "millennium") {
      const m0 = Math.floor(state.Y / 1000) * 1000;
      title = nf().format(m0) + "–" + nf().format(m0 + 999);
      for (let c = m0; c < m0 + 1000; c += 100) {
        const isNow = curF.y >= c && curF.y < c + 100;
        grid.appendChild(cell(nf().format(c) + "–" + nf().format(c + 99), isNow ? "now" : "", () => setState({ level: "century", Y: c })));
      }
    } else if (state.level === "century") {
      const c0 = Math.floor(state.Y / 100) * 100;
      title = nf().format(c0) + "–" + nf().format(c0 + 99);
      for (let d = c0; d < c0 + 100; d += 10) {
        const isNow = curF.y >= d && curF.y < d + 10;
        grid.appendChild(cell(nf().format(d) + "–" + nf().format(d + 9), isNow ? "now" : "", () => setState({ level: "decade", Y: d })));
      }
    } else if (state.level === "decade") {
      const d0 = Math.floor(state.Y / 10) * 10;
      title = nf().format(d0) + "–" + nf().format(d0 + 9);
      for (let y = d0; y < d0 + 10; y++) {
        grid.appendChild(cell(yearLabel(y), y === curF.y ? "now" : "", () => setState({ level: "year", Y: y })));
      }
    } else if (state.level === "year") {
      const ms = monthsOf(state.Y) || monthsApprox(state.Y);
      const approx = ms[0] && ms[0].approx;
      title = (approx ? "≈ " : "") + yearLabel(state.Y);
      ms.forEach((m, i) => {
        const isNow = state.Y === curF.y && !approx && m.month === curF.month;
        grid.appendChild(cell(monthName(m), isNow ? "now" : "", () => setState({ level: "month", M: i })));
      });
    } else {
      const ms = monthsOf(state.Y) || monthsApprox(state.Y);
      const M = Math.min(state.M, ms.length - 1);
      const m = ms[M];
      const approx = m.approx;
      title = (approx ? "≈ " : "") + monthName(m) + " " + yearLabel(state.Y);
      grid.classList.add("days");

      let firstDay = 1; // Monday
      try {
        const loc = new Intl.Locale(locale);
        const wi = loc.getWeekInfo ? loc.getWeekInfo() : loc.weekInfo;
        if (wi && wi.firstDay) firstDay = wi.firstDay;
      } catch (e) { /* keep default */ }

      const wdFmt = fmt({ weekday: "narrow" });
      const monday = Date.UTC(2024, 0, 1) + DAY / 2; // a known Monday
      for (let i = 0; i < 7; i++) {
        const span = document.createElement("span");
        span.className = "dow";
        span.textContent = wdFmt.format(monday + ((firstDay - 1 + i) % 7) * DAY);
        grid.appendChild(span);
      }

      const startWd = ((new Date(m.t).getUTCDay() + 6) % 7) + 1; // Mon=1..Sun=7
      const blanks = (startWd - firstDay + 7) % 7;
      for (let i = 0; i < blanks; i++) grid.appendChild(cell("", "blank daycell"));
      for (let d = 1; d <= m.days; d++) {
        const ts = m.t + (d - 1) * DAY;
        const isToday = !approx && state.Y === curF.y && m.month === curF.month && d === curF.day;
        grid.appendChild(cell(nf().format(d), "daycell" + (isToday ? " now" : "")));
      }
    }

    els.title.textContent = title;
    for (const b of els.levelBtns) b.classList.toggle("active", b.dataset.level === state.level);
    updateMarker();
  }

  function navigate(dir) {
    if (state.level === "millennium") setState({ Y: state.Y + dir * 1000 });
    else if (state.level === "century") setState({ Y: state.Y + dir * 100 });
    else if (state.level === "decade") setState({ Y: state.Y + dir * 10 });
    else if (state.level === "year") setState({ Y: state.Y + dir });
    else {
      const ms = monthsOf(state.Y) || monthsApprox(state.Y);
      let M = Math.min(state.M, ms.length - 1) + dir;
      if (M < 0) {
        const prev = monthsOf(state.Y - 1) || monthsApprox(state.Y - 1);
        setState({ Y: state.Y - 1, M: prev.length - 1 });
      } else if (M >= ms.length) {
        setState({ Y: state.Y + 1, M: 0 });
      } else {
        setState({ M });
      }
    }
  }

  function goToday() {
    const f = fields(NOW);
    const ms = monthsOf(f.y);
    let M = 0;
    if (ms) M = Math.max(0, ms.findIndex((m) => m.month === f.month));
    setState({ level: "month", Y: f.y, M });
    scrollToToday();
  }

  function setCalendar(id, keepTime) {
    const prev = cal;
    cal = byId[id] || CALS[0];
    els.select.value = cal.id;
    if (keepTime) {
      // keep looking at the same point in time, renumbered in the new calendar
      const ts = yearStart(state.Y, prev);
      state.Y = ts != null ? fields(ts).y : fields(NOW).y;
    }
    renderStrip();
    render();
  }

  function setLanguage(lang, isRtl) {
    locale = lang;
    for (const k in fmtCache) delete fmtCache[k];
    cal = byId[LANG_CAL[lang] || "gregory"];
    els.select.value = cal.id;
    const f = fields(NOW);
    const ms = monthsOf(f.y);
    state = { level: "month", Y: f.y, M: ms ? Math.max(0, ms.findIndex((m) => m.month === f.month)) : 0 };
    renderStrip();
    render();
    scrollToToday();
  }

  function init() {
    els = {
      track: document.getElementById("tl-track"),
      marker: document.createElement("div"),
      today: document.createElement("div"),
      grid: document.getElementById("cal-grid"),
      title: document.getElementById("cal-title"),
      select: document.getElementById("cal-system"),
      levelBtns: [...document.querySelectorAll(".cal-levels [data-level]")],
    };
    els.marker.className = "tl-marker";
    els.today.className = "tl-today";
    els.track.addEventListener("click", stripClick);
    els.select.addEventListener("change", () => setCalendar(els.select.value, true));
    document.getElementById("cal-prev").addEventListener("click", () => navigate(-1));
    document.getElementById("cal-next").addEventListener("click", () => navigate(1));
    document.getElementById("cal-today").addEventListener("click", goToday);
    for (const b of els.levelBtns) {
      b.addEventListener("click", () => {
        const level = b.dataset.level;
        const patch = { level };
        if (level === "month") {
          const f = fields(NOW);
          if (state.Y === f.y) {
            const ms = monthsOf(f.y);
            patch.M = ms ? Math.max(0, ms.findIndex((m) => m.month === f.month)) : 0;
          } else patch.M = 0;
        }
        setState(patch);
      });
    }
  }

  init();
  return { setLanguage };
})();
window.TimeCal = TimeCal;
