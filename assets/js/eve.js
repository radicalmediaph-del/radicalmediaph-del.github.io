/* ==========================================================================
   Eve Wanderlust — hero slideshow, scroll reveals, and form capture.
   Enquiries post to the same Google Apps Script as the rest of the site,
   tagged so travel leads are easy to filter from client leads.
   ========================================================================== */
(function () {
  "use strict";

  var EVE = {
    email:        "radicalmediaph@gmail.com",
    whatsappIntl: "639156479771",
    messenger:    "https://m.me/61591158385146",

    // Same endpoint and token as the main site. Rows land in the Clients sheet
    // with Form = "Eve Wanderlust ..." so they can be filtered or moved to a tab.
    sheetEndpoint: "https://script.google.com/macros/s/AKfycbxLVRllqXiSZi6I5LkUnVzlfoM1I6uI3DE-esFeosN-wP6lk5lZj0Sjm4WBHZVFudhy/exec",
    sheetToken:    "rmph-2026-web",

    // Separate Apps Script that stores reviews and emails them for approval.
    // Paste the /exec URL of the reviews deployment here. Until it is filled in,
    // the review form explains itself instead of silently failing.
    reviewEndpoint: ""
  };

  var LABELS = {
    full_name: "Name", email: "Email", phone: "Mobile", destination: "Destination",
    event_date: "Travel date", nights: "Nights", guests: "Travellers",
    budget: "Budget per person", package: "Package", pickup: "Pickup point",
    note: "Notes", newsletter: "Newsletter opt-in"
  };

  /* ----- hero slideshow ------------------------------------------------- */
  function slideshow() {
    var slides = document.querySelectorAll(".hero .slide");
    if (slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var i = 0;
    setInterval(function () {
      slides[i].classList.remove("is-on");
      i = (i + 1) % slides.length;
      // restart the Ken Burns zoom on the incoming slide
      var next = slides[i];
      next.style.animation = "none";
      void next.offsetWidth;
      next.style.animation = "";
      next.classList.add("is-on");
    }, 6000);
  }

  /* ----- duplicate the rail so the marquee loops seamlessly -------------- */
  function rail() {
    var track = document.querySelector(".rail-track");
    if (!track) return;
    track.innerHTML += track.innerHTML;
    track.querySelectorAll("img").forEach(function (img) { img.setAttribute("aria-hidden", "true"); });
  }

  /* ----- reveal on scroll ------------------------------------------------ */
  function reveals() {
    var els = document.querySelectorAll(".reveal");
    if (!els.length || !("IntersectionObserver" in window)) {
      els.forEach(function (e) { e.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ----- forms ----------------------------------------------------------- */
  function send(payload) {
    if (!EVE.sheetEndpoint || typeof fetch !== "function") return Promise.resolve(false);
    var body = JSON.stringify(payload);
    return fetch(EVE.sheetEndpoint, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: body
    }).then(function (r) { return r.ok; })
      .catch(function () {
        return fetch(EVE.sheetEndpoint, { method: "POST", mode: "no-cors", body: body })
          .then(function () { return true; }).catch(function () { return false; });
      });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function done(form, payload, saved) {
    var box = form.querySelector(".form-done");
    if (!box) return;
    box.innerHTML = "";
    box.classList.add("is-on");

    var first = (payload.full_name || "").split(" ")[0];
    var lines = Object.keys(LABELS).filter(function (k) { return payload[k]; })
      .map(function (k) { return LABELS[k] + ": " + payload[k]; }).join("\n");

    var p = document.createElement("p");
    p.innerHTML = saved
      ? "<strong>Got it" + (first ? ", " + esc(first) : "") + ".</strong> " +
        "We read every one of these ourselves. Expect a reply within 48 hours."
      : "<strong>Almost sent" + (first ? ", " + esc(first) : "") + ".</strong> " +
        "Pick a way to get it to us and we will take it from there:";
    box.appendChild(p);

    var row = document.createElement("div");
    row.className = "alt-row";

    var mail = document.createElement("a");
    mail.className = "btn";
    mail.href = "mailto:" + EVE.email + "?subject=" + encodeURIComponent(payload.form) +
                "&body=" + encodeURIComponent(lines);
    mail.textContent = saved ? "Also email it" : "Send by email";
    row.appendChild(mail);

    var fb = document.createElement("a");
    fb.className = "btn";
    fb.href = EVE.messenger; fb.target = "_blank"; fb.rel = "noopener";
    fb.textContent = "Chat on Messenger";
    row.appendChild(fb);

    var wa = document.createElement("a");
    wa.className = "btn";
    wa.href = "https://wa.me/" + EVE.whatsappIntl + "?text=" +
              encodeURIComponent(payload.form + "\n\n" + lines);
    wa.target = "_blank"; wa.rel = "noopener";
    wa.textContent = "WhatsApp";
    row.appendChild(wa);

    if (!saved) {
      var copy = document.createElement("button");
      copy.type = "button"; copy.className = "btn";
      copy.textContent = "Copy details";
      copy.addEventListener("click", function () {
        navigator.clipboard.writeText(payload.form + "\n\n" + lines)
          .then(function () { copy.textContent = "Copied"; }, function () {});
      });
      row.appendChild(copy);
    }
    box.appendChild(row);
  }

  function forms() {
    document.querySelectorAll("form[data-eve-form]").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var ok = true;
        form.querySelectorAll("[required]").forEach(function (f) {
          var wrap = f.closest(".field"), err = wrap && wrap.querySelector(".err");
          var bad = !f.value.trim() ||
                    (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value));
          if (wrap) wrap.classList.toggle("bad", bad);
          if (err) err.textContent = bad ? (f.type === "email" ? "Check this email address" : "We need this one") : "";
          if (bad && ok) { f.focus(); ok = false; }
        });
        if (!ok) return;

        var btn = form.querySelector("button[type=submit]");
        var label = btn ? btn.textContent : "";
        if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }

        var payload = {
          token: EVE.sheetToken,
          form: form.getAttribute("data-subject") || "Eve Wanderlust enquiry",
          page: "travel.html"
        };
        new FormData(form).forEach(function (v, k) { payload[k] = v; });

        // Unchecked boxes are absent from FormData. Record the answer either way,
        // so an opt-in is a deliberate "Yes" and never an empty cell.
        form.querySelectorAll("input[type=checkbox][name]").forEach(function (box) {
          payload[box.name] = box.checked ? "Yes" : "No";
        });

        send(payload).then(function (saved) {
          if (btn) { btn.disabled = false; btn.textContent = label; }
          done(form, payload, saved);
          if (saved) form.reset();
        });
      });
    });

    // Travel date cannot be in the past
    var today = new Date().toISOString().slice(0, 10);
    document.querySelectorAll("input[name=event_date]").forEach(function (i) { i.min = today; });
  }

  /* ----- reviews: show approved ones, send new ones for approval -------- */
  function stars(n) {
    n = Math.max(0, Math.min(5, Number(n) || 0));
    return n ? "★".repeat(n) + "☆".repeat(5 - n) : "";
  }

  function showReviews() {
    var list = document.getElementById("review-list");
    if (!list || !EVE.reviewEndpoint) return;
    fetch(EVE.reviewEndpoint)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok || !d.reviews || !d.reviews.length) return;
        d.reviews.forEach(function (rv) {
          var card = document.createElement("article");
          card.className = "review";

          if (rv.rating) {
            var st = document.createElement("div");
            st.className = "review-stars";
            st.setAttribute("aria-label", rv.rating + " out of 5");
            st.textContent = stars(rv.rating);
            card.appendChild(st);
          }

          var p = document.createElement("p");
          p.className = "review-text";
          p.textContent = rv.review;          // textContent, never innerHTML
          card.appendChild(p);

          var who = document.createElement("div");
          who.className = "review-who";
          var b = document.createElement("b");
          b.textContent = rv.name;
          who.appendChild(b);
          who.appendChild(document.createTextNode(
            [rv.trip, rv.date].filter(Boolean).join(" · ")));
          card.appendChild(who);

          list.appendChild(card);
        });
        list.hidden = false;
      })
      .catch(function () { /* leave the section hidden */ });
  }

  function reviewForm() {
    var form = document.querySelector("form[data-eve-review]");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      form.querySelectorAll("[required]").forEach(function (f) {
        var wrap = f.closest(".field"), err = wrap && wrap.querySelector(".err");
        var bad = !f.value.trim();
        if (wrap) wrap.classList.toggle("bad", bad);
        if (err) err.textContent = bad ? "We need this one" : "";
        if (bad && ok) { f.focus(); ok = false; }
      });
      if (!ok) return;

      var box = form.querySelector(".form-done");
      var btn = form.querySelector("button[type=submit]");
      var label = btn ? btn.textContent : "";

      if (!EVE.reviewEndpoint) {
        box.classList.add("is-on");
        box.textContent = "Reviews are not switched on yet. Send it to " + EVE.email +
                          " and we will put it up.";
        return;
      }

      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
      var payload = { token: EVE.sheetToken };
      new FormData(form).forEach(function (v, k) { payload[k] = v; });

      fetch(EVE.reviewEndpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      }).then(function (r) { return r.json(); })
        .catch(function () {
          return fetch(EVE.reviewEndpoint, {
            method: "POST", mode: "no-cors", body: JSON.stringify(payload)
          }).then(function () { return { ok: true }; });
        })
        .then(function (res) {
          if (btn) { btn.disabled = false; btn.textContent = label; }
          box.classList.add("is-on");
          box.textContent = (res && res.ok)
            ? "Thank you — that has gone to us for approval. Once we have read it, it goes up on this page."
            : "That did not send. Please email it to " + EVE.email + " instead.";
          if (res && res.ok) form.reset();
        });
    });
  }

  function init() {
    var yr = document.getElementById("yr");
    if (yr) yr.textContent = new Date().getFullYear();
    slideshow();
    rail();
    reveals();
    forms();
    reviewForm();
    showReviews();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();


/* ---------- floating Home button (back to top) ---------- */
(function () {
  if (window.__rmHomeTop) return;
  window.__rmHomeTop = true;

  var css = document.createElement("style");
  css.textContent = [
    ".rm-hometop{position:fixed;top:72px;right:20px;z-index:9999;",
    "transform:translateY(-14px);opacity:0;pointer-events:none;",
    "display:inline-flex;align-items:center;gap:9px;",
    "padding:10px 20px 10px 16px;border-radius:999px;cursor:pointer;",
    "font:600 15px/1 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;",
    "color:#fff;background:rgba(18,14,28,.88);",
    "border:1px solid rgba(232,176,75,.55);",
    "box-shadow:0 10px 30px rgba(0,0,0,.3);",
    "-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);",
    "transition:opacity .28s ease,transform .28s ease,box-shadow .2s ease,border-color .2s ease}",
    ".rm-hometop.is-on{opacity:1;pointer-events:auto;transform:translateY(0)}",
    ".rm-hometop:hover{box-shadow:0 14px 34px rgba(0,0,0,.38);border-color:rgba(232,176,75,.95)}",
    ".rm-hometop:focus-visible{outline:2px solid #e8b04b;outline-offset:3px}",
    ".rm-hometop .rm-e{font-size:19px;line-height:1}",
    "@media (max-width:700px){.rm-hometop{top:64px;right:12px;padding:9px 16px 9px 13px;font-size:14px}}",
    "@media (prefers-reduced-motion:reduce){.rm-hometop{transition:none}}"
  ].join("");
  document.head.appendChild(css);

  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "rm-hometop";
  btn.setAttribute("aria-label", "Back to the top of the page");
  btn.innerHTML = '<span class="rm-e" aria-hidden="true">🥾</span><span>Home</span>';
  document.body.appendChild(btn);

  btn.addEventListener("click", function () {
    var reduce = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  });

  function sync() { btn.classList.toggle("is-on", window.pageYOffset > 420); }
  window.addEventListener("scroll", sync, { passive: true });
  sync();
})();


/* ---------- trips: place cards, travel calendar and trip sections ----------
   Everything below reads assets/data/trips.json, the file the back office
   (eve-admin.html) edits. Places are never crossed out: a place with no
   upcoming date says so and folds its section to one line until a date is
   added. Calendar days that have passed, or were cancelled, show faded.     */
(function () {
  var DATA_URL = "assets/data/trips.json";
  var MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
  var DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var LONG   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  var TODAY  = (function () { var d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

  var places = [], trips = [];

  function parse(s) {
    var m = String(s || "").trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function same(a, b) { return !!(a && b && a.getTime() === b.getTime()); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function range(a, b) {
    if (!b || same(a, b)) return a.getDate() + " " + MONTHS[a.getMonth()] + " " + a.getFullYear();
    if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
      return a.getDate() + " – " + b.getDate() + " " + MONTHS[a.getMonth()] + " " + a.getFullYear();
    }
    return a.getDate() + " " + MONTHS[a.getMonth()].slice(0, 3) + " – " +
           b.getDate() + " " + MONTHS[b.getMonth()].slice(0, 3) + " " + b.getFullYear();
  }
  function longDate(t) {
    return same(t.start, t.end) ? LONG[t.start.getDay()] + " " + range(t.start) : range(t.start, t.end);
  }
  function upcoming(t) { return t.status !== "cancelled" && t.end >= TODAY; }
  function label(t) {
    if (t.status === "cancelled") return "Cancelled";
    if (t.end < TODAY) return "Completed";
    return "";
  }
  function nextFor(id) {
    return trips.filter(function (t) { return t.place.id === id && upcoming(t); })
                .sort(function (a, b) { return a.start - b.start; })[0] || null;
  }
  function placeById(id) {
    return places.filter(function (p) { return p.id === id; })[0] || null;
  }

  /* ---- place cards (no dates on them) ---- */
  function renderCards() {
    var board = document.getElementById("tripboard");
    if (!board) return;
    var van = board.querySelector('a[href="#van"]');
    board.textContent = "";
    places.forEach(function (p) {
      var next = nextFor(p.id);
      var a = el("a", "tp-card");
      a.href = "#" + p.id;
      a.setAttribute("data-place", p.id);
      a.appendChild(el("span", "tp-when", p.tag || "Trip"));
      a.appendChild(el("span", "tp-name", p.name));
      var meta = [p.blurb, p.price].filter(Boolean).join(" · ");
      if (meta) a.appendChild(el("span", "tp-meta", meta));
      var go = el("span", "tp-go", next ? "See the dates " : "Dates coming soon ");
      var arrow = el("span", null, "→");
      arrow.setAttribute("aria-hidden", "true");
      go.appendChild(arrow);
      a.appendChild(go);
      board.appendChild(a);
    });
    if (van) board.appendChild(van);
  }

  /* ---- a section for each place the page has no hand-built section for ---- */
  function renderMoreSections() {
    var host = document.getElementById("moretrips");
    if (!host) return;
    host.textContent = "";
    places.forEach(function (p) {
      if (document.querySelector('section.trip[data-place="' + p.id + '"]')) return;
      var sec = el("section", "section trip");
      sec.id = p.id;
      sec.setAttribute("data-place", p.id);
      var wrap = el("div", "wrap");
      var head = el("div", "trip-head center narrow");
      head.appendChild(el("p", "eyebrow", p.tag || "Trip"));
      head.appendChild(el("h2", null, p.name));
      if (p.blurb) head.appendChild(el("p", "lead", p.blurb));
      wrap.appendChild(head);

      var body = el("div", "trip-body");
      var bar = el("div", "datebar");
      var c1 = el("div");
      c1.appendChild(el("span", "datebar-label", "Next date"));
      var s1 = el("strong"); s1.setAttribute("data-next", ""); c1.appendChild(s1);
      var sep = el("div", "datebar-sep"); sep.setAttribute("aria-hidden", "true");
      var c2 = el("div");
      c2.appendChild(el("span", "datebar-label", p.noteLabel || "Details"));
      var s2 = el("strong"); s2.setAttribute("data-next-note", ""); c2.appendChild(s2);
      var btn = el("a", "btn btn--sun", "Reserve a seat"); btn.href = "#plan";
      bar.appendChild(c1); bar.appendChild(sep); bar.appendChild(c2); bar.appendChild(btn);
      body.appendChild(bar);
      if (p.price) body.appendChild(el("p", "center lead trip-price", p.price));

      var rows = (p.itinerary || []).filter(function (r) { return r && (r.time || r.text); });
      if (rows.length) {
        var h = el("div", "center"); h.style.marginTop = "56px";
        h.appendChild(el("p", "eyebrow", "The itinerary"));
        h.appendChild(el("h2", null, "How it runs"));
        body.appendChild(h);
        var itin = el("div", "itin itin--single");
        var day = el("div", "itin-day");
        rows.forEach(function (r) {
          var row = el("div", "itin-row");
          row.appendChild(el("span", "t", r.time || ""));
          row.appendChild(el("span", "w", r.text || ""));
          day.appendChild(row);
        });
        itin.appendChild(day);
        body.appendChild(itin);
      }
      wrap.appendChild(body);
      sec.appendChild(wrap);
      host.appendChild(sec);
    });
  }

  /* ---- next date in every trip section; quiet fold when there is none ---- */
  function fillSections() {
    document.querySelectorAll("section.trip[data-place]").forEach(function (sec, n) {
      var p = placeById(sec.getAttribute("data-place"));
      var t = p ? nextFor(p.id) : null;
      sec.querySelectorAll("[data-next]").forEach(function (s) {
        s.textContent = t ? longDate(t) : "To be announced";
      });
      sec.querySelectorAll("[data-next-note]").forEach(function (s) {
        s.textContent = t ? ((t.status === "full" ? "Fully booked · " : "") + (t.note || "We send the details when you book"))
                          : "We tell you when a date is set";
      });

      var head = sec.querySelector(".trip-head");
      var body = sec.querySelector(".trip-body");
      var old = sec.querySelector(".trip-quietbar");
      if (old) old.remove();
      sec.classList.remove("is-quiet", "is-open");
      if (t || !head || !body) return;

      sec.classList.add("is-quiet");
      if (!body.id) body.id = (sec.id || "trip" + n) + "-details";
      var bar = el("div", "trip-quietbar");
      bar.appendChild(el("span", "trip-badge", "No date on the calendar yet"));
      var b = el("button", "trip-toggle", "Show the itinerary");
      b.type = "button";
      b.setAttribute("aria-expanded", "false");
      b.setAttribute("aria-controls", body.id);
      b.addEventListener("click", function () {
        var open = sec.classList.toggle("is-open");
        b.setAttribute("aria-expanded", open ? "true" : "false");
        b.textContent = open ? "Hide the itinerary" : "Show the itinerary";
        if (open) body.querySelectorAll(".reveal").forEach(function (e) { e.classList.add("in"); });
      });
      bar.appendChild(b);
      var ask = el("a", "trip-ask", "Ask us about a date");
      ask.href = "#plan";
      bar.appendChild(ask);
      head.appendChild(bar);
    });
  }

  /* ---- hero line and the booking form's trip list ---- */
  function fillHero() {
    var k = document.getElementById("nextup");
    if (!k) return;
    var live = trips.filter(function (t) { return upcoming(t) && t.status !== "full" && t.start >= TODAY; })
                    .sort(function (a, b) { return a.start - b.start; });
    if (!live.length) { k.textContent = "Philippine tours & custom itineraries"; return; }
    var first = live[0];
    var sameDay = live.filter(function (t) { return same(t.start, first.start); });
    var names = sameDay.map(function (t) { return t.place.name; });
    var when = first.start.getDate() + " " + MONTHS[first.start.getMonth()] + " " + first.start.getFullYear();
    k.textContent = "Next up: " + (names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names.slice(-1) : names[0]) +
                    " · " + when + " · seats open";
  }

  function fillPackages() {
    var g = document.getElementById("pkg-trips");
    if (!g) return;
    g.textContent = "";
    trips.filter(function (t) { return upcoming(t) && t.status !== "full"; })
         .sort(function (a, b) { return a.start - b.start; })
         .forEach(function (t) {
           var o = el("option", null, t.place.name + " — " + range(t.start, t.end) + (t.place.price ? " · " + t.place.price : ""));
           g.appendChild(o);
         });
    if (!g.children.length) g.remove();
  }

  /* ---- the travel calendar ---- */
  var grid = document.getElementById("calgrid");
  var cal = document.getElementById("calendar");
  var monthEl = document.getElementById("calmonth");
  var panel = document.getElementById("calpanel");
  var view = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1), selected = null, focusId = null;

  function tripsOn(d) { return trips.filter(function (t) { return d >= t.start && d <= t.end; }); }

  function render() {
    if (!grid) return;
    monthEl.textContent = MONTHS[view.getMonth()] + " " + view.getFullYear();
    grid.textContent = "";
    var head = el("div", "tripcal-row tripcal-row--head");
    head.setAttribute("role", "row");
    DAYS.forEach(function (d) {
      var h = el("div", "tripcal-dow", d);
      h.setAttribute("role", "columnheader");
      head.appendChild(h);
    });
    grid.appendChild(head);

    var y = view.getFullYear(), m = view.getMonth();
    var lead = new Date(y, m, 1).getDay(), count = new Date(y, m + 1, 0).getDate(), row = null;
    for (var i = 0; i < lead + count; i++) {
      if (i % 7 === 0) { row = el("div", "tripcal-row"); row.setAttribute("role", "row"); grid.appendChild(row); }
      var cell = el("div", "tripcal-cell");
      cell.setAttribute("role", "gridcell");
      row.appendChild(cell);
      if (i < lead) continue;

      var d = new Date(y, m, i - lead + 1), on = tripsOn(d), day;
      if (on.length) {
        var allDone = on.every(function (t) { return !!label(t); });
        day = el("button", "tripcal-day has-trip" + (allDone ? " is-done" : ""));
        day.type = "button";
        day.setAttribute("aria-label", d.getDate() + " " + MONTHS[m] + ": " + on.map(function (t) {
          var l = label(t) || (t.status === "full" ? "Fully booked" : "");
          return t.place.name + (l ? " (" + l.toLowerCase() + ")" : "");
        }).join(", "));
        day.setAttribute("aria-pressed", same(d, selected) ? "true" : "false");
        (function (dd) { day.addEventListener("click", function () { select(dd); }); })(d);
        if (focusId && on.some(function (t) { return t.place.id === focusId; })) day.classList.add("is-focus");
      } else {
        day = el("span", "tripcal-day");
      }
      if (same(d, TODAY)) day.classList.add("is-today");
      if (same(d, selected)) day.classList.add("is-selected");
      day.appendChild(el("span", "tripcal-num", String(d.getDate())));
      if (on.length) {
        var tags = el("span", "tripcal-tags");
        on.forEach(function (t) { tags.appendChild(el("span", "tripcal-tag" + (label(t) ? " is-done" : ""), t.place.name)); });
        day.appendChild(tags);
      }
      cell.appendChild(day);
    }
  }

  function showPanel() {
    if (!panel) return;
    panel.textContent = "";
    if (!selected) return;
    var on = tripsOn(selected);
    if (!on.length) return;
    panel.appendChild(el("p", "tripcal-paneldate", LONG[selected.getDay()] + ", " + range(selected)));
    on.forEach(function (t) {
      var l = label(t);
      var item = el("div", "tripcal-item" + (l ? " is-done" : ""));
      var text = el("div");
      text.appendChild(el("p", "tripcal-name", t.place.name));
      text.appendChild(el("p", "tripcal-when", range(t.start, t.end) + (t.note && !l ? " · " + t.place.noteLabel + ": " + t.note : "")));
      item.appendChild(text);
      if (l) item.appendChild(el("span", "trip-badge", l));
      else if (t.status === "full") item.appendChild(el("span", "trip-badge", "Fully booked"));
      var a = el("a", "btn " + (l ? "btn--glass-dark" : "btn--sun"), "See the itinerary");
      a.href = "#" + t.place.id;
      item.appendChild(a);
      panel.appendChild(item);
    });
  }

  function select(d) {
    selected = d;
    if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) {
      view = new Date(d.getFullYear(), d.getMonth(), 1);
    }
    render();
    showPanel();
    var b = grid && grid.querySelector(".tripcal-day.is-selected");
    if (b && b.focus) b.focus({ preventScroll: true });
  }

  if (cal) {
    cal.querySelectorAll("[data-cal]").forEach(function (b) {
      b.addEventListener("click", function () {
        view = new Date(view.getFullYear(), view.getMonth() + (b.getAttribute("data-cal") === "next" ? 1 : -1), 1);
        render();
      });
    });
  }

  // a place card jumps to its next date on the calendar; with no date it opens the place itself
  document.addEventListener("click", function (e) {
    var card = e.target.closest && e.target.closest("#tripboard [data-place]");
    if (!card || !grid) return;
    var t = nextFor(card.getAttribute("data-place"));
    if (!t) return;
    e.preventDefault();
    focusId = t.place.id;
    select(t.start);
    cal.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function build(data) {
    places = (data && data.places || []).filter(function (p) { return p && p.id && p.name; });
    trips = [];
    places.forEach(function (p) {
      (p.dates || []).forEach(function (d) {
        var start = parse(d.start);
        if (!start) return;
        var end = parse(d.end) || start;
        if (end < start) end = start;
        trips.push({ place: p, start: start, end: end,
                     status: String(d.status || "open").toLowerCase(), note: d.note || "" });
      });
    });
    renderCards();
    renderMoreSections();
    fillSections();
    fillHero();
    fillPackages();
    var first = trips.filter(upcoming).sort(function (a, b) { return a.start - b.start; })[0];
    if (first) view = new Date(first.start.getFullYear(), first.start.getMonth(), 1);
    render();
  }

  render();
  if (!window.fetch) return;
  fetch(DATA_URL + "?v=" + Date.now(), { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(build)
    .catch(function () { /* data file unreachable: the page keeps its written-in content */ });
})();

