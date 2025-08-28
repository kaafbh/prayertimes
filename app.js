// =========================
// إعداد Firebase (مع تحكم في الأعطال)
// =========================
(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyB4ZdMmW67zsp1zNk3oKGiQui_u8L7vIcs",
    authDomain: "prayer-times-5d2a5.firebaseapp.com",
    databaseURL: "https://prayer-times-5d2a5-default-rtdb.firebaseio.com",
    projectId: "prayer-times-5d2a5",
    storageBucket: "prayer-times-5d2a5.firebasestorage.app",
    messagingSenderId: "374194704275",
    appId: "1:374194704275:web:bbd3c42c4f44bd702be266",
    measurementId: "G-K194KQGLEE",
  };

  const nowTimeEl = document.getElementById("nowTime");
  const nowDateEl = document.getElementById("nowDate");
  const tzLabelEl = document.getElementById("tzLabel");

  const nextTypeEl = document.getElementById("nextType");
  const nextTitleEl = document.getElementById("nextTitle");
  const nextAtEl = document.getElementById("nextAt");
  const countdownEl = document.getElementById("countdown");
  const statusTipEl = document.getElementById("statusTip");

  const todayTableEl = document.getElementById("todayTable");

  const mosqueNameInput = document.getElementById("mosqueName");
  const themeSelect = document.getElementById("themeSelect");
  const accentColorInput = document.getElementById("accentColor");
  const saveBtn = document.getElementById("saveBtn");
  const resetBtn = document.getElementById("resetBtn");
  const footMosqueEl = document.getElementById("footMosque");

  const LOCAL_KEY = "athan_iqama_settings_v2";
  const defaultSettings = {
    mosqueName: "العدّاد – كاف الإنسانية",
    theme: "auto",
    accent: "#0ea5e9",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Bahrain",
  };

  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(LOCAL_KEY));
      return { ...defaultSettings, ...(s || {}) };
    } catch {
      return { ...defaultSettings };
    }
  }

  function applySettings(s) {
    document.documentElement.classList.remove("light", "dark");
    if (s.theme === "light") document.documentElement.classList.add("light");
    if (s.theme === "dark") document.documentElement.classList.add("dark");
    document.documentElement.style.setProperty("--accent", s.accent);
    mosqueNameInput.value = s.mosqueName || "";
    themeSelect.value = s.theme || "auto";
    accentColorInput.value = s.accent || "#0ea5e9";
    footMosqueEl.textContent = s.mosqueName || "";
  }

  function saveSettings() {
    const s = {
      ...loadSettings(),
      mosqueName: mosqueNameInput.value.trim() || defaultSettings.mosqueName,
      theme: themeSelect.value,
      accent: accentColorInput.value,
    };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(s));
    applySettings(s);
  }
  function resetSettings() { localStorage.removeItem(LOCAL_KEY); applySettings(defaultSettings); }
  saveBtn.addEventListener("click", saveSettings);
  resetBtn.addEventListener("click", resetSettings);
  applySettings(loadSettings());

  function formatArabicDate(d, tz) {
    return new Intl.DateTimeFormat("ar", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: tz,
    }).format(d);
  }
  function formatArabicTime(d, tz, withSeconds = true) {
    return new Intl.DateTimeFormat("ar", {
      hour: "numeric", minute: "2-digit", second: withSeconds ? "2-digit" : undefined, hour12: true, timeZone: tz,
    }).format(d);
  }
  function tickNow() {
    const tz = loadSettings().timezone;
    const now = new Date();
    nowTimeEl.textContent = formatArabicTime(now, tz, true);
    nowDateEl.textContent = formatArabicDate(now, tz);
    tzLabelEl.textContent = `المنطقة الزمنية: ${tz}`;
  }
  setInterval(tickNow, 1000); tickNow();

  const DB_ROOT = "/prayerTimes";
  let cachedToday = null;
  let cachedTomorrow = null;
  function ymd(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  function toDateOn(date, hhmm) {
    if (!/^[0-2]\d:[0-5]\d$/.test(hhmm || "")) return null;
    const [h, m] = hhmm.split(":").map(Number);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0);
  }
  const PRAYERS = [
    { key: "fajr", label: "الفجر" },
    { key: "dhuhr", label: "الظهر" },
    { key: "asr", label: "العصر" },
    { key: "maghrib", label: "المغرب" },
    { key: "isha", label: "العشاء" },
  ];
  function buildEventsForDay(baseDate, dayData) {
    if (!dayData) return [];
    const events = [];
    for (const p of PRAYERS) {
      const adhan = dayData[`${p.key}_adhan`];
      const iqama = dayData[`${p.key}_iqama`];
      const adhanDate = toDateOn(baseDate, adhan);
      const iqamaDate = toDateOn(baseDate, iqama);
      if (adhanDate) events.push({ type: "أذان", prayer: p.label, at: adhanDate, raw: adhan });
      if (iqamaDate) events.push({ type: "إقامة", prayer: p.label, at: iqamaDate, raw: iqama });
    }
    events.sort((a,b) => a.at - b.at);
    return events;
  }
  function renderTable(dayData) {
    todayTableEl.innerHTML = "";
    if (!dayData) {
      todayTableEl.innerHTML = `<tr><td colspan="3">لا توجد بيانات لليوم في قاعدة البيانات.</td></tr>`;
      return;
    }
    const rows = PRAYERS.map(p => {
      const ad = dayData[`${p.key}_adhan`] || "—";
      const iq = dayData[`${p.key}_iqama`] || "—";
      return `<tr><td>${p.label}</td><td>${ad}</td><td>${iq}</td></tr>`;
    }).join("");
    todayTableEl.innerHTML = rows;
  }

  let timerId = null;
  function updateNextEvent() {
    const now = new Date();
    const todayEvents = buildEventsForDay(now, cachedToday);
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const tomorrowEvents = buildEventsForDay(tomorrow, cachedTomorrow);
    const merged = [...todayEvents, ...tomorrowEvents];
    const upcoming = merged.find(ev => ev.at.getTime() > now.getTime());

    if (!upcoming) {
      nextTypeEl.textContent = "—";
      nextTitleEl.textContent = "لا يوجد حدث قادم";
      nextAtEl.textContent = "—";
      countdownEl.textContent = "—";
      statusTipEl.textContent = "تأكد من وجود مواقيت اليوم والغد في قاعدة البيانات.";
      return;
    }

    nextTypeEl.textContent = upcoming.type === "أذان" ? "الأذان التالي" : "الإقامة التالية";
    nextTitleEl.textContent = `${upcoming.type} ${upcoming.prayer}`;
    const atFmt = new Intl.DateTimeFormat("ar", {
      hour: "numeric", minute: "2-digit", hour12: true, timeZone: loadSettings().timezone,
      weekday: "long", month: "long", day: "numeric"
    }).format(upcoming.at);
    nextAtEl.textContent = `الساعة ${atFmt}`;

    function renderCountdown() {
      const now2 = new Date();
      const diff = upcoming.at.getTime() - now2.getTime();
      if (diff <= 0) {
        countdownEl.textContent = "حان الوقت";
        statusTipEl.textContent = `حان وقت ${upcoming.type.toLowerCase()} ${upcoming.prayer}`;
        clearInterval(timerId);
        timerId = setTimeout(updateNextEvent, 60_000);
        return;
      }
      const secs = Math.floor(diff / 1000);
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      countdownEl.textContent = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
      statusTipEl.textContent = `الحدث القادم: ${upcoming.type} ${upcoming.prayer}`;
    }
    if (timerId) clearInterval(timerId);
    renderCountdown();
    timerId = setInterval(renderCountdown, 1000);
  }

  async function safeFetchDay(date) {
    try {
      if (typeof firebase === "undefined" || !firebase.apps) {
        throw new Error("مكتبة Firebase لم تُحمَّل. تأكد من عدم حظر الشبكة لملفات Google.");
      }
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      const db = firebase.database();
      const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
      const snap = await db.ref(`/prayerTimes/${key}`).get();
      return snap.exists() ? snap.val() : null;
    } catch (e) {
      console.warn("فشل جلب البيانات من القاعدة:", e);
      return null;
    }
  }

  async function boot() {
    const now = new Date();
    const tmr = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    cachedToday = await safeFetchDay(now);
    cachedTomorrow = await safeFetchDay(tmr);

    if (!cachedToday && !cachedTomorrow) {
      cachedToday = {
        fajr_adhan: "04:00", fajr_iqama: "04:25",
        dhuhr_adhan: "11:58", dhuhr_iqama: "12:20",
        asr_adhan: "15:20", asr_iqama: "15:35",
        maghrib_adhan: "18:20", maghrib_iqama: "18:30",
        isha_adhan: "19:45", isha_iqama: "20:00",
      };
      cachedTomorrow = cachedToday;
      const tip = "ملاحظة: بيانات تجريبية لعدم توفر اتصال القاعدة.";
      statusTipEl.textContent = tip;
      console.warn(tip);
    }

    renderTable(cachedToday);
    updateNextEvent();
    setInterval(updateNextEvent, 60_000);
  }

  // ابدأ بعد أن تُحمّل سكربتات Firebase (مؤشر تقريبي)
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(boot, 50);
  } else {
    document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 50));
  }
})();
