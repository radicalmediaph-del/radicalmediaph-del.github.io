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
    sheetToken:    "rmph-2026-web"
  };

  var LABELS = {
    full_name: "Name", email: "Email", phone: "Mobile", destination: "Destination",
    event_date: "Travel date", nights: "Nights", guests: "Travellers",
    budget: "Budget per person", note: "Notes"
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

  function init() {
    var yr = document.getElementById("yr");
    if (yr) yr.textContent = new Date().getFullYear();
    slideshow();
    rail();
    reveals();
    forms();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
