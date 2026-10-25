// Kelda booking flow (demo). Availability is generated deterministically per
// slot and combined with requests saved in localStorage; nothing leaves the browser.
(function () {
  const form = document.querySelector("[data-booking]");
  if (!form) return;

  const CAPACITY = 12;
  const SESSION_MIN = 90;
  const DAYS_AHEAD = 14;
  const STORE_KEY = "kelda.demoBookings.v1";
  const PRICES = { adult: 16, concession: 11, private: 120 };
  const LIMITS = { sharedMax: 6, groupMin: 1, groupMax: 8 };
  const WEEKDAY_SLOTS = ["07:00", "08:45", "17:00", "18:45"];
  const WEEKEND_SLOTS = ["08:00", "09:45", "11:30", "13:15", "15:00", "16:45", "18:30"];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const fmtDay = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
  const fmtMon = new Intl.DateTimeFormat("en-GB", { month: "short" });
  const fmtLong = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const state = {
    type: "shared",
    adults: 1,
    concessions: 0,
    group: 4,
    date: null,
    time: null,
    submitted: false,
    busy: false,
  };

  // ---------- Storage ----------
  function loadBookings() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }
  function saveBookings(list) {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  }

  // ---------- Dates & slots ----------
  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addMinutes = (time, mins) => {
    const [h, m] = time.split(":").map(Number);
    const t = h * 60 + m + mins;
    return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
  };
  const slotStart = (date, time) => { const d = parseIso(date); const [h, m] = time.split(":").map(Number); d.setHours(h, m, 0, 0); return d; };

  function slotsForDate(date) {
    const dow = parseIso(date).getDay();
    if (dow === 1) return [];
    return dow === 0 || dow === 6 ? WEEKEND_SLOTS : WEEKDAY_SLOTS;
  }

  function upcomingDates() {
    const out = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      out.push(isoDate(d));
    }
    return out;
  }

  // FNV-1a: stable pseudo-random "existing bookings" for each slot.
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function seededTaken(date, time) {
    const h = hash(`${date}|${time}`);
    if (h % 100 < 24) return 0;
    const weekend = [0, 6].includes(parseIso(date).getDay());
    const base = 1 + ((h >>> 8) % 11);
    return Math.min(CAPACITY, base + (weekend ? 2 : 0));
  }

  function slotInfo(date, time, bookings = loadBookings()) {
    const mine = bookings.filter((b) => b.date === date && b.time === time);
    const privateTaken = mine.some((b) => b.type === "private");
    const seeded = seededTaken(date, time);
    const taken = privateTaken ? CAPACITY : seeded + mine.reduce((n, b) => n + b.spaces, 0);
    const started = slotStart(date, time).getTime() - 15 * 60 * 1000 <= Date.now();
    return { left: Math.max(0, CAPACITY - taken), empty: taken === 0, privateTaken, started };
  }

  function guestCount() {
    return state.type === "private" ? state.group : state.adults + state.concessions;
  }

  // Returns { ok, label, low } for the current selection.
  function evaluateSlot(date, time, bookings) {
    const info = slotInfo(date, time, bookings);
    if (info.started) return { ok: false, label: "Started" };
    if (info.privateTaken) return { ok: false, label: "Private hire" };
    if (state.type === "private") {
      return info.empty ? { ok: true, label: "Available" } : { ok: false, label: info.left ? "Shared bookings" : "Full" };
    }
    if (info.left === 0) return { ok: false, label: "Full" };
    if (info.left < guestCount()) return { ok: false, label: `Only ${info.left} left` };
    return { ok: true, label: `${info.left} of ${CAPACITY} left`, low: info.left <= 3 };
  }

  function totalPrice() {
    return state.type === "private" ? PRICES.private : state.adults * PRICES.adult + state.concessions * PRICES.concession;
  }

  // ---------- Rendering ----------
  const datesEl = $("[data-dates]");
  const slotsEl = $("[data-slots]");
  const timeStatus = $("[data-time-status]");

  function renderGuests() {
    const shared = state.type === "shared";
    $("[data-guests-shared]").hidden = !shared;
    $("[data-guests-private]").hidden = shared;
    $('[data-count="adults"]').textContent = state.adults;
    $('[data-count="concessions"]').textContent = state.concessions;
    $('[data-count="group"]').textContent = state.group;

    const total = state.adults + state.concessions;
    const bounds = {
      adults: [state.adults <= (state.concessions ? 0 : 1), total >= LIMITS.sharedMax],
      concessions: [state.concessions <= (state.adults ? 0 : 1), total >= LIMITS.sharedMax],
      group: [state.group <= LIMITS.groupMin, state.group >= LIMITS.groupMax],
    };
    $$("[data-step]").forEach((btn) => {
      const [atMin, atMax] = bounds[btn.dataset.step];
      btn.disabled = Number(btn.dataset.delta) < 0 ? atMin : atMax;
    });
    const hint = $("[data-guest-hint]");
    hint.textContent = total >= LIMITS.sharedMax
      ? "That's the maximum of 6 spaces per booking. For a bigger group, try private hire."
      : "Up to 6 spaces per booking.";
  }

  function renderDates() {
    const bookings = loadBookings();
    datesEl.innerHTML = "";
    upcomingDates().forEach((date, i) => {
      const d = parseIso(date);
      const slots = slotsForDate(date);
      const free = slots.filter((t) => evaluateSlot(date, t, bookings).ok).length;
      const closed = slots.length === 0;
      const label = document.createElement("label");
      label.className = "date";
      const availText = closed ? "Closed" : free ? `${free} ${free === 1 ? "time" : "times"}` : "Full";
      const srText = `${fmtLong.format(d)}${i === 0 ? ", today" : ""}: ${closed ? "closed" : free ? `${free} times available` : "no times available"}`;
      label.innerHTML = `
        <input type="radio" name="date" value="${date}" ${closed ? "disabled" : ""} ${state.date === date ? "checked" : ""} aria-label="${srText}" />
        <span class="date__body ${!closed && !free ? "is-full" : ""}" aria-hidden="true">
          <span class="date__dow">${i === 0 ? "Today" : fmtDay.format(d)}</span>
          <span class="date__day">${d.getDate()}</span>
          <span class="date__mon">${fmtMon.format(d)}</span>
          <span class="date__avail">${availText}</span>
        </span>`;
      datesEl.appendChild(label);
    });
  }

  function renderSlots() {
    slotsEl.innerHTML = "";
    timeStatus.classList.remove("is-warning");
    if (!state.date) {
      timeStatus.textContent = "Pick a day to see times.";
      return;
    }
    const bookings = loadBookings();
    const slots = slotsForDate(state.date);
    const results = slots.map((t) => ({ time: t, ...evaluateSlot(state.date, t, bookings) }));
    const openCount = results.filter((r) => r.ok).length;

    if (!openCount) {
      timeStatus.textContent = "";
      const empty = document.createElement("div");
      empty.className = "empty";
      const reason = state.type === "private"
        ? "Private hire needs a slot with no shared bookings yet, and every slot on this day has some."
        : `There's no slot on this day with ${guestCount()} ${guestCount() === 1 ? "space" : "spaces"} free.`;
      empty.innerHTML = `<strong>Nothing free on ${fmtLong.format(parseIso(state.date))}</strong><span>${reason} Try another day${state.type === "shared" && guestCount() > 1 ? " or fewer spaces" : ""}.</span>`;
      slotsEl.appendChild(empty);
      return;
    }

    timeStatus.textContent = `${openCount} of ${slots.length} times available on ${fmtLong.format(parseIso(state.date))}. Each session lasts 90 minutes.`;
    results.forEach((r) => {
      const label = document.createElement("label");
      label.className = "slot";
      const range = `${r.time}–${addMinutes(r.time, SESSION_MIN)}`;
      label.innerHTML = `
        <input type="radio" name="time" value="${r.time}" ${r.ok ? "" : "disabled"} ${state.time === r.time ? "checked" : ""} aria-label="${range}, ${r.label}" />
        <span class="slot__body" aria-hidden="true">
          <span class="slot__time">${range}</span>
          <span class="slot__state ${r.low ? "is-low" : ""}">${r.label}</span>
        </span>`;
      slotsEl.appendChild(label);
    });
  }

  function setSum(key, text, empty = false) {
    const el = $(`[data-sum="${key}"]`);
    el.textContent = text;
    el.classList.toggle("is-empty", empty);
  }

  function guestSummary() {
    if (state.type === "private") return `${state.group} ${state.group === 1 ? "person" : "people"}`;
    const parts = [];
    if (state.adults) parts.push(`${state.adults} full price`);
    if (state.concessions) parts.push(`${state.concessions} concession`);
    return parts.join(", ");
  }

  function renderSummary() {
    setSum("type", state.type === "private" ? "Private hire" : "Shared session");
    setSum("date", state.date ? fmtLong.format(parseIso(state.date)) : "Not chosen", !state.date);
    setSum("time", state.time ? `${state.time}–${addMinutes(state.time, SESSION_MIN)}` : "Not chosen", !state.time);
    setSum("guests", guestSummary());
    setSum("total", `£${totalPrice()}`);
  }

  // Drop a chosen time that no longer fits after a change, and say why.
  // Returns true when it re-rendered the slots itself.
  function revalidateTime() {
    if (!state.date || !state.time || evaluateSlot(state.date, state.time).ok) return false;
    const dropped = state.time;
    state.time = null;
    renderSlots();
    timeStatus.textContent = `${dropped} no longer fits your booking, so it's been cleared. Please choose another time.`;
    timeStatus.classList.add("is-warning");
    return true;
  }

  function refreshAvailability() {
    renderGuests();
    renderDates();
    if (!revalidateTime()) renderSlots();
    renderSummary();
  }

  function renderAll() {
    renderGuests();
    renderDates();
    renderSlots();
    renderSummary();
  }

  // ---------- Validation ----------
  const fields = {
    name: { el: $("#name"), check: (v) => (v.trim().length < 2 ? "Enter the name the booking should be under." : "") },
    email: {
      el: $("#email"),
      check: (v) => (!v.trim() ? "Enter an email address." : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "" : "Enter an email address like name@example.com."),
    },
    phone: {
      el: $("#phone"),
      check: (v) => (!v.trim() || /^[+()\d\s-]{7,20}$/.test(v.trim()) ? "" : "Use digits, spaces and + only, or leave this blank."),
    },
    rules: { el: $("#rules"), check: (_, el) => (el.checked ? "" : "Please confirm you've read the house rules.") },
  };

  function showFieldError(key, msg) {
    const { el } = fields[key];
    const err = $(`#${key}-error`);
    err.textContent = msg;
    err.hidden = !msg;
    if (msg) el.setAttribute("aria-invalid", "true");
    else el.removeAttribute("aria-invalid");
  }

  function validate() {
    const problems = [];
    if (!state.date) problems.push({ msg: "Choose a day.", target: "#step-date" });
    else if (!state.time) problems.push({ msg: "Choose a time.", target: "#step-time" });
    Object.entries(fields).forEach(([key, f]) => {
      const msg = f.check(f.el.value, f.el);
      showFieldError(key, msg);
      if (msg) problems.push({ msg, target: `#${key}` });
    });
    return problems;
  }

  const formError = $("[data-form-error]");
  function showFormError(html) {
    formError.innerHTML = html;
    formError.hidden = !html;
  }

  // ---------- Events ----------
  form.addEventListener("change", (e) => {
    const t = e.target;
    if (t.name === "type") {
      state.type = t.value;
      refreshAvailability();
    } else if (t.name === "date") {
      state.date = t.value;
      state.time = null;
      renderSlots();
      renderSummary();
    } else if (t.name === "time") {
      state.time = t.value;
      renderSummary();
    }
    if (state.submitted) liveRevalidate();
  });

  form.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-step]");
    if (!btn || btn.disabled) return;
    const key = btn.dataset.step;
    const delta = Number(btn.dataset.delta);
    if (key === "group") state.group = Math.min(LIMITS.groupMax, Math.max(LIMITS.groupMin, state.group + delta));
    else state[key] = Math.max(0, state[key] + delta);
    refreshAvailability();
    // Keep focus on the control when it becomes disabled at a limit.
    if (btn.disabled) btn.parentElement.querySelector(`[data-delta="${-delta}"]`).focus();
  });

  Object.entries(fields).forEach(([key, f]) => {
    const evt = f.el.type === "checkbox" ? "change" : "blur";
    f.el.addEventListener(evt, () => { if (state.submitted || f.el.value) showFieldError(key, f.check(f.el.value, f.el)); });
    f.el.addEventListener("input", () => { if (f.el.getAttribute("aria-invalid")) showFieldError(key, f.check(f.el.value, f.el)); });
  });

  function liveRevalidate() {
    const problems = validate();
    if (!problems.length) showFormError("");
  }

  const submitBtn = $("[data-submit]");
  const submitLabel = $("[data-submit-label]");

  function setBusy(busy) {
    state.busy = busy;
    submitBtn.classList.toggle("is-loading", busy);
    submitBtn.disabled = busy;
    submitLabel.textContent = busy ? "Saving request…" : "Request booking";
    form.setAttribute("aria-busy", String(busy));
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.busy) return;
    state.submitted = true;
    const problems = validate();
    if (problems.length) {
      showFormError(
        `<strong>Please fix ${problems.length === 1 ? "this" : "these"} before continuing:</strong><ul>${problems
          .map((p) => `<li><a href="${p.target}" data-jump="${p.target}">${p.msg}</a></li>`)
          .join("")}</ul>`
      );
      formError.focus?.();
      return;
    }
    showFormError("");
    setBusy(true);

    // Simulated network delay, then re-check the slot in case another tab took it.
    setTimeout(() => {
      const bookings = loadBookings();
      const check = evaluateSlot(state.date, state.time, bookings);
      if (!check.ok) {
        setBusy(false);
        const dropped = state.time;
        state.time = null;
        renderAll();
        showFormError(`<strong>${dropped} is no longer available</strong> (${check.label.toLowerCase()}). Nothing was saved — please choose another time.`);
        $("#step-time").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const booking = {
        ref: `KLD-${Date.now().toString(36).slice(-4).toUpperCase()}${Math.floor(Math.random() * 36).toString(36).toUpperCase()}`,
        type: state.type,
        date: state.date,
        time: state.time,
        adults: state.type === "shared" ? state.adults : 0,
        concessions: state.type === "shared" ? state.concessions : 0,
        spaces: state.type === "shared" ? guestCount() : 0,
        group: state.type === "private" ? state.group : 0,
        name: fields.name.el.value.trim(),
        total: totalPrice(),
        createdAt: new Date().toISOString(),
      };
      try {
        saveBookings([...bookings, booking]);
      } catch {
        setBusy(false);
        showFormError("<strong>Your browser wouldn't let us save the request</strong> (storage may be full or disabled). Nothing was saved.");
        return;
      }
      setBusy(false);
      showSuccess(booking);
      renderMine();
    }, 1100);
  });

  formError.addEventListener("click", (e) => {
    const link = e.target.closest("[data-jump]");
    if (!link) return;
    e.preventDefault();
    const target = $(link.dataset.jump);
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusable = target.matches("input") ? target : $("input:not(:disabled)", target);
    focusable?.focus({ preventScroll: true });
  });

  // ---------- Success ----------
  const successEl = $("[data-success]");
  function describe(b) {
    return {
      session: b.type === "private" ? "Private hire" : "Shared session",
      when: `${fmtLong.format(parseIso(b.date))}`,
      time: `${b.time}–${addMinutes(b.time, SESSION_MIN)}`,
      who: b.type === "private"
        ? `${b.group} ${b.group === 1 ? "person" : "people"}`
        : [b.adults && `${b.adults} full`, b.concessions && `${b.concessions} concession`].filter(Boolean).join(", "),
    };
  }

  function showSuccess(b) {
    const d = describe(b);
    $("[data-success-ref]").textContent = b.ref;
    $("[data-success-details]").innerHTML = `
      <div><dt>Session</dt><dd>${d.session}</dd></div>
      <div><dt>Day</dt><dd>${d.when}</dd></div>
      <div><dt>Time</dt><dd>${d.time}</dd></div>
      <div><dt>Total</dt><dd>£${b.total} · ${d.who}</dd></div>`;
    form.hidden = true;
    successEl.hidden = false;
    successEl.scrollIntoView({ behavior: "smooth", block: "start" });
    successEl.focus({ preventScroll: true });
  }

  $("[data-again]").addEventListener("click", () => {
    successEl.hidden = true;
    form.hidden = false;
    state.time = null;
    state.submitted = false;
    fields.rules.el.checked = false;
    renderAll();
    $("#step-date").scrollIntoView({ behavior: "smooth", block: "start" });
    $('input[name="date"]:checked, input[name="date"]:not(:disabled)', datesEl)?.focus({ preventScroll: true });
  });

  // ---------- Saved requests ----------
  const mineEl = $("[data-mine]");
  const mineStatus = $("[data-mine-status]");

  function renderMine() {
    const list = loadBookings().sort((a, b) => slotStart(a.date, a.time) - slotStart(b.date, b.time));
    if (!list.length) {
      mineEl.innerHTML = `<div class="empty"><strong>No saved requests yet</strong><span>Requests you make above will appear here, in this browser only.</span></div>`;
      return;
    }
    const ul = document.createElement("ul");
    ul.className = "mine-list";
    list.forEach((b) => {
      const d = describe(b);
      const past = slotStart(b.date, b.time) < new Date();
      const li = document.createElement("li");
      li.className = `mine-item${past ? " is-past" : ""}`;
      li.innerHTML = `
        <span class="mine-item__ref">${b.ref}</span>
        <span class="mine-item__when">${d.when}, ${d.time}<span class="mine-item__what">${d.session} · ${d.who}${past ? " · finished" : ""}</span></span>
        <span class="mine-item__total">£${b.total}</span>
        <button type="button" class="btn btn--ghost btn--small" data-cancel="${b.ref}">${past ? "Remove" : "Cancel"}<span class="visually-hidden"> request ${b.ref}</span></button>`;
      ul.appendChild(li);
    });
    mineEl.replaceChildren(ul);
  }

  mineEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cancel]");
    if (!btn) return;
    const ref = btn.dataset.cancel;
    saveBookings(loadBookings().filter((b) => b.ref !== ref));
    renderMine();
    renderDates();
    renderSlots();
    mineStatus.textContent = `Request ${ref} removed.`;
    ($("[data-cancel]", mineEl) || $("#mine-title")).focus?.();
  });

  // Keep the timetable in sync with other tabs.
  window.addEventListener("storage", (e) => {
    if (e.key !== STORE_KEY) return;
    renderMine();
    refreshAvailability();
  });

  // ---------- Init ----------
  const params = new URLSearchParams(location.search);
  if (params.get("type") === "private") {
    state.type = "private";
    $('input[name="type"][value="private"]').checked = true;
  }
  formError.tabIndex = -1;
  $("#mine-title").tabIndex = -1;
  renderAll();
  renderMine();
})();
