/* ==========================================================================
   RadicalMediaPh — shared behaviour
   Header + footer are injected here so every page stays in sync.
   ========================================================================== */
(function () {
  "use strict";

  /* ----- 1. Site-wide details. Edit these in ONE place. ------------------ */
  var SITE = {
    email: "radicalmediaph@gmail.com",
    phone: "09915374528",
    phoneIntl: "+639915374528",
    whatsapp: "09156479771",
    whatsappIntl: "639156479771",
    // ---- Social profiles -------------------------------------------------
    // Paste your real profile links here. Anything left as "" is simply not
    // shown anywhere on the site, so you can add platforms as you go.
    // These feed the footer on every page AND the Follow Me row on Contact.
    facebook:  "https://www.facebook.com/profile.php?id=61591158385146",
    instagram: "https://www.instagram.com/radicalmediaph",
    tiktok:    "",
    youtube:   "",
    linkedin:  "https://www.linkedin.com/in/ramduculan",
    x:         "",
    threads:   "",
    telegram:  "",
    viber:     "",

    // ---- Google Sheet ----------------------------------------------------
    // Every form submission is saved as a row in your spreadsheet:
    // https://docs.google.com/spreadsheets/d/1OviCHauAha6LI62U3LDcrs6Oj8WPeEKchpxtzKVyyUY/edit
    //
    // Paste the Apps Script web-app URL below (it ends in /exec).
    // Setup instructions: google-sheet/SETUP.md
    // Until this is filled in, forms still work — they just fall back to
    // email / WhatsApp instead of saving a row.
    // ---- Payment details -------------------------------------------------
    // Fill these in and they appear on payment.html automatically.
    // A method with an empty "number" is hidden, so you can add them one at
    // a time. QR: drop a photo in assets/img/ and put the filename here,
    // e.g. qr: "assets/img/gcash-qr.jpg". Leave "" for no QR.
    payment: {
      currency:   "PHP",
      ebookPrice: "249",
      gcash: { label: "GCash",         name: "Ramuel D.",       number: "0915 647 9771",  qr: "assets/img/gcash-qr.jpg" },
      maya:  { label: "Maya",          name: "Ramuel Duculan",  number: "0915 647 9771",  qr: "assets/img/maya-qr.jpg" },
      bank:  { label: "Bank Transfer", name: "Ramuel Duculan",  number: "0108 6004 1611", bank: "BDO" }
    },

    sheetEndpoint: "https://script.google.com/macros/s/AKfycbxLVRllqXiSZi6I5LkUnVzlfoM1I6uI3DE-esFeosN-wP6lk5lZj0Sjm4WBHZVFudhy/exec",
    sheetToken: "rmph-2026-web"
  };
  window.SITE = SITE;

  var NAV = [
    { id: "about",       label: "About",       href: "about.html" },
    { id: "services",    label: "Services",    href: "services.html" },
    { id: "portfolio",   label: "Portfolio",   href: "portfolio.html" },
    { id: "ebook",       label: "Ebook",       href: "ebook.html" }
  ];

  var ICON = {
    menu:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    up:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'
  };

  // Every platform the site knows how to show. Order here = order on screen.
  // A platform with no URL in SITE above is skipped entirely.
  var SOCIALS = [
    { key: "facebook",  label: "Facebook",
      svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5H16.7V3.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.3V13h2.7v8z"/></svg>' },
    { key: "instagram", label: "Instagram",
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/></svg>' },
    { key: "tiktok",    label: "TikTok",
      svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3c.3 2.2 1.6 3.6 3.8 3.8v2.5c-1.3.1-2.5-.2-3.8-1v6.4c0 4.1-3.4 6.6-6.9 5.6-3-.8-4.6-4-3.8-7 .6-2.3 2.6-4 5-4.1v2.6c-.4.1-.8.2-1.2.4-1.1.5-1.7 1.7-1.4 2.9.3 1.1 1.3 1.9 2.5 1.8 1.4-.1 2.3-1.1 2.3-2.6V3z"/></svg>' },
    { key: "youtube",   label: "YouTube",
      svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12s0-3-.4-4.4a2.7 2.7 0 0 0-1.9-1.9C18.2 5.3 12 5.3 12 5.3s-6.2 0-7.7.4a2.7 2.7 0 0 0-1.9 1.9C2 9 2 12 2 12s0 3 .4 4.4c.2.9.9 1.6 1.9 1.9 1.5.4 7.7.4 7.7.4s6.2 0 7.7-.4a2.7 2.7 0 0 0 1.9-1.9C22 15 22 12 22 12zM10 15.1V8.9l5.2 3.1z"/></svg>' },
    { key: "linkedin",  label: "LinkedIn",
      svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.76-2.05C20.4 8.65 21 11.1 21 14.2V21h-4v-6c0-1.43-.03-3.27-2-3.27-2 0-2.3 1.56-2.3 3.17V21H9z"/></svg>' },
    { key: "x",         label: "X",
      svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 3h3.2l-7 8 8.2 10h-6.4l-5-6.1L4.7 21H1.5l7.5-8.6L1.2 3h6.6l4.5 5.6zm-1.1 16h1.8L7.7 4.8H5.8z"/></svg>' },
    { key: "threads",   label: "Threads",
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-5 0-8-3.4-8-9s3-9 8-9c3.6 0 6 1.7 7.1 4.3"/><path d="M8.8 14.3c.4 1.4 1.8 2.2 3.4 2.1 2-.1 3.2-1.3 3.2-3.2 0-2.3-2-3.5-4.4-3.3-1.8.2-2.9 1-2.9 2.1"/><path d="M15.4 13.2c0-2.6-1.4-4.2-3.6-4.2"/></svg>' },
    { key: "telegram",  label: "Telegram",
      svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 18.8 19c-.2 1-.9 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-.9.5l.3-4.7 8.6-7.8c.4-.3-.1-.5-.6-.2L6.9 13.1 2.3 11.7c-1-.3-1-1 .2-1.5l18-7c.8-.3 1.6.2 1.4 1.1z"/></svg>' },
    { key: "viber",     label: "Viber",
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c5 0 8 2.8 8 7.4 0 4.3-2.6 7-7 7.3l-3.4 3.1v-3.4C6 15.7 4 13.3 4 9.4 4 4.8 7 2 12 2z"/><path d="M9.5 7.2c.9.2 1.4.8 1.6 1.7M9.5 5c2 .3 3.3 1.6 3.6 3.6"/></svg>' }
  ];

  function socialsHtml() {
    var out = SOCIALS.filter(function (s) {
      return SITE[s.key] && String(SITE[s.key]).trim();
    }).map(function (s) {
      return '<a href="' + SITE[s.key] + '" target="_blank" rel="noopener" ' +
             'aria-label="' + s.label + '" title="' + s.label + '">' + s.svg + "</a>";
    }).join("");
    return out;
  }

  /* ----- Payment methods ------------------------------------------------- */
  var PAY_ICON = {
    gcash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19"/><path d="M6 15h4"/></svg>',
    maya:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2.5" width="14" height="19" rx="3"/><path d="M10.5 18.5h3"/></svg>',
    bank:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 4l9 5.5"/><path d="M5 10v8M9.7 10v8M14.3 10v8M19 10v8"/><path d="M3 21h18"/></svg>'
  };

  function renderPayment() {
    var mount = document.querySelector("[data-payment-methods]");
    var pay = SITE.payment || {};

    document.querySelectorAll("[data-text=price]").forEach(function (el) {
      el.textContent = pay.ebookPrice
        ? (pay.currency === "PHP" ? "₱" : "") + pay.ebookPrice
        : "(price not set)";
    });

    if (!mount) return;

    var keys = ["gcash", "maya", "bank"];
    var cards = keys.filter(function (k) {
      return pay[k] && String(pay[k].number || "").trim();
    }).map(function (k) {
      var m = pay[k];
      var rows = "";
      if (m.bank)   rows += payRow("Bank", m.bank);
      if (m.name)   rows += payRow("Account name", m.name);
      rows += payRow(k === "bank" ? "Account number" : "Number", m.number, true);

      var qr = m.qr
        ? '<div class="pay-qr"><img src="' + m.qr + '" alt="' + m.label + ' QR code" loading="lazy"></div>'
        : "";

      return '<div class="card pay-card">' +
               '<div class="pay-head"><span class="card-icon">' + (PAY_ICON[k] || "") + "</span>" +
               "<h3>" + m.label + "</h3></div>" +
               '<dl class="pay-rows">' + rows + "</dl>" + qr +
             "</div>";
    });

    if (!cards.length) {
      mount.innerHTML =
        '<div class="card" style="border-color:rgba(227,166,47,.45)">' +
          "<h3>Payment details not set yet</h3>" +
          '<p style="margin:0">Open <code>assets/js/main.js</code> and fill in the <code>payment</code> ' +
          "block near the top with your GCash / Maya / bank details. They will appear here " +
          "automatically. Until then, this page tells visitors to message you instead.</p>" +
        "</div>";
      document.querySelectorAll("[data-payment-pending]").forEach(function (el) {
        el.hidden = false;
      });
      return;
    }

    mount.innerHTML = cards.join("");
    mount.classList.add("grid", "grid-3");

    mount.querySelectorAll("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        copyText(btn.getAttribute("data-copy"), btn);
      });
    });
  }

  function payRow(label, value, copyable) {
    return "<dt>" + escapeHtml(label) + "</dt><dd>" + escapeHtml(value) +
      (copyable ? ' <button type="button" class="pay-copy" data-copy="' + escapeHtml(value) + '">Copy</button>' : "") +
      "</dd>";
  }

  function renderSocials() {
    var html = socialsHtml();
    document.querySelectorAll("[data-socials]").forEach(function (el) {
      if (!html) { el.remove(); return; }
      el.classList.add("socials");
      el.innerHTML = html;
    });
  }

  /* ----- 2. Header ------------------------------------------------------- */
  function buildHeader() {
    var mount = document.querySelector("[data-header]");
    if (!mount) return;
    var current = document.body.getAttribute("data-page") || "";

    var links = NAV.map(function (item) {
      var active = item.id === current ? ' class="is-active" aria-current="page"' : "";
      return '<li><a href="' + item.href + '"' + active + ">" + item.label + "</a></li>";
    }).join("");

    mount.outerHTML =
      '<header class="site-header" id="top">' +
        '<div class="container nav">' +
          '<a class="brand" href="index.html">RadicalMediaPh<span>.</span></a>' +
          '<nav aria-label="Main"><ul class="nav-links" id="navLinks">' + links + "</ul></nav>" +
          '<div class="nav-cta">' +
            '<a class="btn btn--gold" href="contact.html">Let\'s Talk</a>' +
            '<button class="nav-toggle" id="navToggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="navLinks">' + ICON.menu + "</button>" +
          "</div>" +
        "</div>" +
      "</header>";

    var toggle = document.getElementById("navToggle");
    var list = document.getElementById("navLinks");
    if (toggle && list) {
      toggle.addEventListener("click", function () {
        var open = list.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        toggle.innerHTML = open ? ICON.close : ICON.menu;
      });
      list.addEventListener("click", function (e) {
        if (e.target.tagName === "A") {
          list.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
          toggle.innerHTML = ICON.menu;
        }
      });
    }

    var header = document.querySelector(".site-header");
    var onScroll = function () {
      header.classList.toggle("is-stuck", window.scrollY > 10);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ----- 3. Footer ------------------------------------------------------- */
  function buildFooter() {
    var mount = document.querySelector("[data-footer]");
    if (!mount) return;
    mount.outerHTML =
      '<footer class="site-footer">' +
        '<div class="container">' +
          '<a class="brand" href="index.html">RadicalMediaPh<span>.</span></a>' +
          '<div class="socials socials--footer" data-socials></div>' +
          '<ul class="footer-links">' +
            '<li><a href="privacy.html">Privacy Policy</a></li>' +
            '<li><a href="terms.html">Terms of Service</a></li>' +
            '<li><a href="blog.html">Blog</a></li>' +
            '<li><a href="contact.html">Contact</a></li>' +
          "</ul>" +
          '<p class="copyright">&copy; ' + new Date().getFullYear() + " Radical Media PH. All rights reserved.</p>" +
        "</div>" +
      "</footer>" +
      '<button class="to-top" id="toTop" type="button" aria-label="Back to top">' + ICON.up + "</button>";

    var btn = document.getElementById("toTop");
    window.addEventListener("scroll", function () {
      btn.classList.toggle("is-visible", window.scrollY > 500);
    }, { passive: true });
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ----- 4. Contact links resolved from SITE ----------------------------- */
  function wireContactLinks() {
    document.querySelectorAll("[data-link]").forEach(function (el) {
      var kind = el.getAttribute("data-link");
      if (kind === "email") el.href = "mailto:" + SITE.email;
      if (kind === "phone") el.href = "tel:" + SITE.phoneIntl;
      if (kind === "whatsapp") {
        el.href = "https://wa.me/" + SITE.whatsappIntl;
        el.target = "_blank";
        el.rel = "noopener";
      }
    });
    document.querySelectorAll("[data-text=email]").forEach(function (el) { el.textContent = SITE.email; });
    document.querySelectorAll("[data-text=phone]").forEach(function (el) { el.textContent = SITE.phone; });
    document.querySelectorAll("[data-text=whatsapp]").forEach(function (el) { el.textContent = SITE.whatsapp; });
  }

  /* ----- 5. Portfolio filters ------------------------------------------- */
  function wireFilters() {
    var buttons = document.querySelectorAll("[data-filter]");
    if (!buttons.length) return;
    var items = document.querySelectorAll("[data-category]");
    var empty = document.getElementById("noResults");

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var want = btn.getAttribute("data-filter");
        buttons.forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        var shown = 0;
        items.forEach(function (item) {
          var match = want === "all" || item.getAttribute("data-category") === want;
          item.classList.toggle("is-hidden", !match);
          if (match) shown++;
        });
        if (empty) empty.classList.toggle("is-hidden", shown > 0);
      });
    });
  }

  /* ----- 6. Forms -------------------------------------------------------- */
  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim());
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function copyText(text, btn) {
    var done = function () {
      var was = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(function () { btn.textContent = was; }, 1800);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else {
      fallback();
    }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;top:-1000px;left:-1000px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (err) { /* nothing else to try */ }
      document.body.removeChild(ta);
    }
  }

  function labelise(key) {
    return key.replace(/_/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  // Flatten whichever form was submitted into the fixed set of columns the
  // Google Sheet expects.
  function buildRow(form, data, subject, body) {
    var get = function (k) { return String(data.get(k) || "").trim(); };
    var extras = [];
    if (get("copies")) extras.push("Copies: " + get("copies"));
    if (get("payment_method")) extras.push("Paid via: " + get("payment_method"));
    if (get("reference")) extras.push("Reference: " + get("reference"));
    if (get("amount")) extras.push("Amount: " + get("amount"));

    return {
      token: SITE.sheetToken,
      form: form.getAttribute("data-subject") || "Website form",
      name: get("name") || get("full_name"),
      email: get("email"),
      phone: get("phone"),
      company: get("company"),
      subject: subject,
      message: get("message") || get("primary_goal") || get("goal") || get("note") || "",
      extra: extras.join(" | "),
      page: (window.location.pathname.split("/").pop() || "index.html")
    };
  }

  // POST the row to the Apps Script web app attached to the spreadsheet.
  // Resolves true if it went out, false if it could not be sent at all.
  function saveToSheet(payload) {
    if (!SITE.sheetEndpoint || typeof fetch !== "function") {
      return Promise.resolve(false);
    }
    var body = JSON.stringify(payload);

    // text/plain keeps this a "simple" request, so there is no CORS preflight
    // for Apps Script to fail.
    return fetch(SITE.sheetEndpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: body
    })
      .then(function (res) { return res.ok; })
      .catch(function () {
        // Page opened from a file:// path, or the response was blocked.
        // Fire it off opaquely — the row still lands, we just can't read
        // the reply.
        return fetch(SITE.sheetEndpoint, { method: "POST", mode: "no-cors", body: body })
          .then(function () { return true; })
          .catch(function () { return false; });
      });
  }

  function showSuccess(success, name, subject, body, saved) {
    if (!success) return;
    success.innerHTML = "";

    var first = name ? String(name).split(" ")[0] : "";
    var head = document.createElement("p");
    head.style.margin = "0 0 12px";
    head.innerHTML = saved
      ? "<strong>Thanks" + (first ? ", " + escapeHtml(first) : "") +
        "!</strong> Your message has been received — I'll get back to you shortly."
      : "<strong>Thanks" + (first ? ", " + escapeHtml(first) : "") +
        "!</strong> Your message is ready — choose how to send it:";
    success.appendChild(head);

    var mailHref = "mailto:" + SITE.email +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
    var waHref = "https://wa.me/" + SITE.whatsappIntl +
      "?text=" + encodeURIComponent(subject + "\n\n" + body);

    var row = document.createElement("div");
    row.className = "send-row";

    var mail = document.createElement("a");
    mail.className = saved ? "btn btn--ghost" : "btn btn--gold";
    mail.href = mailHref;
    mail.textContent = saved ? "Also email it" : "Send by email";
    row.appendChild(mail);

    var wa = document.createElement("a");
    wa.className = "btn btn--ghost";
    wa.href = waHref;
    wa.target = "_blank";
    wa.rel = "noopener";
    wa.textContent = saved ? "Chat on WhatsApp" : "Send on WhatsApp";
    row.appendChild(wa);

    if (!saved) {
      var copy = document.createElement("button");
      copy.className = "btn btn--ghost";
      copy.type = "button";
      copy.textContent = "Copy message";
      copy.addEventListener("click", function () {
        copyText(subject + "\n\n" + body + "\n\nSend to: " + SITE.email, copy);
      });
      row.appendChild(copy);
    }

    success.appendChild(row);

    var note = document.createElement("p");
    note.style.cssText = "margin:12px 0 0;font-size:.84rem;opacity:.85";
    note.textContent = saved
      ? "Prefer to talk sooner? Either button above reaches me directly."
      : "Or email " + SITE.email + " directly.";
    success.appendChild(note);

    success.classList.add("is-visible");
    success.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function wireForms() {
    document.querySelectorAll("form[data-form]").forEach(function (form) {
      var success = form.querySelector(".form-success");

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var ok = true;

        form.querySelectorAll("input, textarea, select").forEach(function (input) {
          var field = input.closest(".field");
          if (!field) return;
          var msg = field.querySelector(".error");
          var value = (input.value || "").trim();
          var problem = "";

          if (input.required && !value) {
            problem = "This field is required.";
          } else if (input.type === "email" && value && !validEmail(value)) {
            problem = "Please enter a valid email address.";
          } else if (input.type === "tel" && value && value.replace(/[^\d]/g, "").length < 7) {
            problem = "Please enter a valid phone number.";
          }

          field.classList.toggle("has-error", !!problem);
          if (msg) msg.textContent = problem;
          if (problem) ok = false;
        });

        if (!ok) {
          var firstBad = form.querySelector(".has-error input, .has-error textarea");
          if (firstBad) firstBad.focus();
          return;
        }

        var data = new FormData(form);
        var lines = [];
        data.forEach(function (value, key) {
          if (value && key !== "token") lines.push(labelise(key) + ": " + value);
        });

        var name = data.get("name") || data.get("full_name") || "";
        var subject = data.get("subject") || form.getAttribute("data-subject") || "Website enquiry";
        var body = lines.join("\n");

        var btn = form.querySelector("button[type=submit]");
        var btnHtml = btn ? btn.innerHTML : "";
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Sending…";
        }

        saveToSheet(buildRow(form, data, subject, body)).then(function (saved) {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = btnHtml;
          }
          showSuccess(success, name, subject, body, saved);
          if (saved) form.reset();
        });
      });

      form.querySelectorAll("input, textarea").forEach(function (input) {
        input.addEventListener("input", function () {
          var field = input.closest(".field");
          if (field) field.classList.remove("has-error");
          if (success) success.classList.remove("is-visible");
        });
      });
    });
  }

  /* ----- 7. Reveal on scroll -------------------------------------------- */
  function wireReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ----- 8. Go -------------------------------------------------------- */
  function init() {
    buildHeader();
    buildFooter();
    renderSocials();
    renderPayment();
    wireContactLinks();
    wireFilters();
    wireForms();
    wireReveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
