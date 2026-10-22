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


/* ---------- trip board, filled from the Trips sheet ---------- */
(function () {
  var SHEET = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQzG8GZgQ0hmuok-" +
              "IHtJTJcUZiVt_DFPBh6GorYvpOMmwwuf75qqMak8IVNVKBsECr1c5i2Hibtwpyi" +
              "/pub?gid=0&single=true&output=csv";

  var board = document.getElementById("tripboard");
  if (!board || !window.fetch) return;
  var head = document.getElementById("boardhead");

  var MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
  var WORDS  = ["No trips","One trip","Two trips","Three trips","Four trips",
                "Five trips","Six trips"];

  function parseCsv(text) {
    var rows = [], row = [], field = "", q = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text.charAt(i);
      if (q) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i++; } else { q = false; }
        } else { field += c; }
      } else if (c === '"') { q = true; }
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c !== "\r") { field += c; }
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function toDate(s) {
    s = (s || "").trim();
    if (!s) return null;
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);          // m/d/yyyy
    if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function range(a, b) {
    if (!a) return "";
    if (!b || a.getTime() === b.getTime()) {
      return a.getDate() + " " + MONTHS[a.getMonth()];
    }
    if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
      return a.getDate() + " – " + b.getDate() + " " + MONTHS[a.getMonth()];
    }
    return a.getDate() + " " + MONTHS[a.getMonth()].slice(0, 3) + " – " +
           b.getDate() + " " + MONTHS[b.getMonth()].slice(0, 3);
  }

  function span(cls, text) {
    var s = document.createElement("span");
    s.className = cls;
    s.textContent = text;
    return s;
  }

  function render(trips) {
    board.textContent = "";
    trips.forEach(function (t) {
      var el = document.createElement(t.done || !t.link ? "div" : "a");
      el.className = "tp-card" + (t.done ? " is-done" : t.full ? " is-full" : "");
      if (el.tagName === "A") el.setAttribute("href", t.link);

      el.appendChild(span("tp-when", t.when));
      el.appendChild(span("tp-name", t.name));
      var meta = [t.blurb, t.price].filter(Boolean).join(" · ");
      if (meta) el.appendChild(span("tp-meta", meta));
      if (t.done) el.appendChild(span("tp-badge", "✕ Completed"));
      else if (t.full) el.appendChild(span("tp-badge", "Fully booked"));
      board.appendChild(el);
    });
  }

  fetch(SHEET, { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw 0; return r.text(); })
    .then(function (text) {
      var rows = parseCsv(text);
      if (rows.length < 2) throw 0;

      var head0 = rows[0].map(function (h) { return h.trim().toLowerCase(); });
      function col(name) { return head0.indexOf(name); }
      var iName = col("trip"), iStart = col("start"), iEnd = col("end"),
          iPrice = col("price"), iBlurb = col("blurb"),
          iStatus = col("status"), iLink = col("link");
      if (iName < 0) throw 0;

      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var trips = [];

      rows.slice(1).forEach(function (r) {
        var name = (r[iName] || "").trim();
        if (!name) return;
        var status = ((r[iStatus] || "").trim() || "Open").toLowerCase();
        if (status === "hidden") return;

        var start = toDate(r[iStart]), end = toDate(r[iEnd]) || start;
        var done = !!(end && end < today);
        trips.push({
          name:  name,
          start: start,
          done:  done,
          full:  !done && status === "full",
          when:  start ? range(start, end) : "Your dates",
          price: done ? "" : (r[iPrice] || "").trim(),
          blurb: (r[iBlurb] || "").trim(),
          link:  (r[iLink] || "").trim()
        });
      });

      if (!trips.length) throw 0;

      trips.sort(function (a, b) {
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (!a.start) return 1;
        if (!b.start) return -1;
        return a.start - b.start;
      });

      render(trips);

      if (head) {
        var live = trips.filter(function (t) { return !t.done && t.start; }).length;
        head.textContent = live
          ? (WORDS[live] || live + " trips") + " leaving this season"
          : "Trips on the board";
      }
    })
    .catch(function () { /* sheet unreachable - the page keeps what is already there */ });
})();
