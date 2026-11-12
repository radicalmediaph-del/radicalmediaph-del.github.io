/* ==========================================================================
   Eve Wanderlust back office (eve-admin.html)
   - Edits assets/data/trips.json: places, their dates and their itineraries.
   - Saves straight into the website through the GitHub API, with an access
     key kept only in this browser. GitHub Pages republishes in about a minute.
   - Makes a Facebook post (caption + itinerary picture) for any trip date and
     posts or schedules it on the Eve Wanderlust page through the Graph API.
   ========================================================================== */
(function () {
  "use strict";

  var REPO   = { owner: "radicalmediaph-del", name: "radicalmediaph-del.github.io",
                 branch: "main", path: "assets/data/trips.json" };
  var GRAPH  = "https://graph.facebook.com/v23.0/";
  var SITE   = { messenger: "m.me/1409368902257608", phone: "0991 537 4528",
                 url: "https://radicalmediaph.com/travel" };
  // ids already used on travel.html; a new place may not take one of these
  var RESERVED = ["top", "destinations", "boardhead", "tripboard", "calendar", "calmonth",
                  "calgrid", "calpanel", "nextup", "moretrips", "van", "how", "guide", "plan",
                  "reviews", "review-list", "yr", "pkg-trips"];
  var MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
  var DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var LONG   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  var STATUS = [["open", "Open"], ["full", "Fully booked"], ["cancelled", "Cancelled"]];
  var TODAY  = (function () { var d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

  var data = { places: [] }, sha = null, dirty = false;
  var openPlaces = {}, fresh = [];
  var view = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1), selDay = null;
  var postList = [];

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function store(k, v) {
    try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {}
  }
  function read(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }

  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function parse(s) {
    var m = String(s || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function same(a, b) { return !!(a && b && a.getTime() === b.getTime()); }
  function range(a, b) {
    if (!a) return "";
    if (!b || same(a, b)) return a.getDate() + " " + MONTHS[a.getMonth()] + " " + a.getFullYear();
    if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
      return a.getDate() + "–" + b.getDate() + " " + MONTHS[a.getMonth()] + " " + a.getFullYear();
    }
    return a.getDate() + " " + MONTHS[a.getMonth()].slice(0, 3) + " – " + b.getDate() + " " +
           MONTHS[b.getMonth()].slice(0, 3) + " " + b.getFullYear();
  }
  function dEnd(d) { var s = parse(d.start), e = parse(d.end) || s; return e && s && e < s ? s : e; }

  var toastT;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("is-on");
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove("is-on"); }, 4200);
  }

  /* ---------------- unicode-safe base64 for the GitHub API ---------------- */
  function b64enc(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64dec(b64) {
    var bin = atob(String(b64).replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function gh(method, url, body) {
    var key = read("eve.ghkey");
    return fetch("https://api.github.com" + url, {
      method: method,
      headers: { "Authorization": "Bearer " + key, "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28" },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.message || ("GitHub said " + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }
  var FILE_URL = "/repos/" + REPO.owner + "/" + REPO.name + "/contents/" + REPO.path;

  /* ---------------- load and save ---------------- */
  function normalise(d) {
    d = d && typeof d === "object" ? d : {};
    d.places = Array.isArray(d.places) ? d.places : [];
    d.places.forEach(function (p) {
      p.dates = Array.isArray(p.dates) ? p.dates : [];
      p.itinerary = Array.isArray(p.itinerary) ? p.itinerary : [];
      ["name", "tag", "blurb", "price", "noteLabel"].forEach(function (k) { if (p[k] == null) p[k] = ""; });
    });
    return d;
  }

  function load() {
    var key = read("eve.ghkey");
    var p = key
      ? gh("GET", FILE_URL + "?ref=" + REPO.branch).then(function (j) { sha = j.sha; return JSON.parse(b64dec(j.content)); })
      : fetch(REPO.path + "?v=" + Date.now(), { cache: "no-store" }).then(function (r) { if (!r.ok) throw 0; return r.json(); });
    return p.then(function (j) {
      data = normalise(j);
      dirty = false;
      setSaveState();
      firstView();
      renderAll();
    }).catch(function (e) {
      data = normalise(null);
      renderAll();
      setSaveState("Could not load your trips" + (e && e.message ? " (" + e.message + ")" : "") + ". Check the website key in Settings.");
    });
  }

  function setSaveState(msg) {
    var bar = $("savebar"), st = $("savestate"), btn = $("savebtn");
    bar.classList.toggle("is-dirty", dirty);
    btn.disabled = !dirty;
    if (msg) { st.textContent = msg; return; }
    if (dirty) st.textContent = "You have changes that are not on the website yet.";
    else st.textContent = read("eve.ghkey") ? "Everything is saved. The travel page matches this page."
                                            : "Viewing only. Connect the website key in Settings to save changes.";
  }

  function markDirty() {
    dirty = true;
    setSaveState();
    renderCalendar();
    renderDayPanel();
    renderPostList(true);
  }

  function problems() {
    var out = [];
    data.places.forEach(function (p) {
      if (!String(p.name).trim()) out.push("A place has no name.");
      p.dates.forEach(function (d) {
        var s = parse(d.start), e = parse(d.end);
        if (!s) out.push(p.name + ": a date has no start day.");
        else if (e && e < s) out.push(p.name + ": a date ends before it starts.");
      });
    });
    return out;
  }

  function clean() {
    return {
      updated: iso(new Date()),
      places: data.places.map(function (p) {
        return {
          id: p.id, name: String(p.name).trim(), tag: p.tag.trim(), blurb: p.blurb.trim(),
          price: p.price.trim(), noteLabel: p.noteLabel.trim() || "Details",
          itinerary: p.itinerary.filter(function (r) { return (r.time || "").trim() || (r.text || "").trim(); })
                                .map(function (r) { return { time: (r.time || "").trim(), text: (r.text || "").trim() }; }),
          dates: p.dates.filter(function (d) { return parse(d.start); })
                        .map(function (d) {
                          var s = parse(d.start), e = parse(d.end) || s;
                          return { start: iso(s), end: iso(e < s ? s : e), status: d.status || "open", note: (d.note || "").trim() };
                        })
                        .sort(function (a, b) { return a.start < b.start ? -1 : 1; })
        };
      })
    };
  }

  function save() {
    if (!read("eve.ghkey")) {
      toast("Connect the website key in Settings first.");
      location.hash = "#settings";
      return;
    }
    var bad = problems();
    if (bad.length) { toast(bad[0]); return; }
    var btn = $("savebtn");
    btn.disabled = true;
    setSaveState("Saving to the website…");
    var out = clean();
    gh("GET", FILE_URL + "?ref=" + REPO.branch)
      .then(function (j) { return j.sha; }, function (e) { if (e.status === 404) return null; throw e; })
      .then(function (current) {
        var body = { message: "Back office: update trips (" + out.updated + ")",
                     content: b64enc(JSON.stringify(out, null, 2) + "\n"), branch: REPO.branch };
        if (current) body.sha = current;
        return gh("PUT", FILE_URL, body);
      })
      .then(function (j) {
        sha = j.content && j.content.sha;
        fresh = [];
        data = normalise(out);
        dirty = false;
        renderAll();
        setSaveState("Saved. The travel page shows the change in about a minute.");
        toast("Saved to the website.");
      })
      .catch(function (e) {
        dirty = true;
        setSaveState("Not saved: " + (e.message || "something went wrong") + ". Your changes are still here; try again.");
      });
  }

  /* ---------------- helpers on the data ---------------- */
  function slug(name) {
    var s = String(name).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
                        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "trip";
    if (/^[0-9]/.test(s)) s = "trip-" + s;
    return s;
  }
  function uniqueId(base, self) {
    var id = base, n = 2;
    while (RESERVED.indexOf(id) >= 0 || data.places.some(function (p) { return p !== self && p.id === id; })) {
      id = base + "-" + n++;
    }
    return id;
  }
  function entries() {
    var out = [];
    data.places.forEach(function (p) {
      p.dates.forEach(function (d) {
        var s = parse(d.start);
        if (s) out.push({ place: p, date: d, start: s, end: dEnd(d) });
      });
    });
    return out;
  }
  function on(day) {
    return entries().filter(function (x) { return day >= x.start && day <= x.end; });
  }

  /* ---------------- calendar ---------------- */
  function firstView() {
    var next = entries().filter(function (x) { return x.end >= TODAY; })
                        .sort(function (a, b) { return a.start - b.start; })[0];
    if (next) view = new Date(next.start.getFullYear(), next.start.getMonth(), 1);
  }

  function renderCalendar() {
    var grid = $("adgrid");
    $("admonth").textContent = MONTHS[view.getMonth()] + " " + view.getFullYear();
    grid.textContent = "";
    var head = el("div", "ad-calrow");
    head.setAttribute("role", "row");
    DAYS.forEach(function (d) { var h = el("div", "ad-dow", d); h.setAttribute("role", "columnheader"); head.appendChild(h); });
    grid.appendChild(head);

    var y = view.getFullYear(), m = view.getMonth();
    var lead = new Date(y, m, 1).getDay(), count = new Date(y, m + 1, 0).getDate(), row;
    for (var i = 0; i < lead + count; i++) {
      if (i % 7 === 0) { row = el("div", "ad-calrow"); row.setAttribute("role", "row"); grid.appendChild(row); }
      var cell = el("div");
      cell.setAttribute("role", "gridcell");
      row.appendChild(cell);
      if (i < lead) continue;
      var d = new Date(y, m, i - lead + 1), list = on(d);
      var b = el("button", "ad-day");
      b.type = "button";
      if (d < TODAY) b.classList.add("is-past");
      if (same(d, TODAY)) b.classList.add("is-today");
      if (same(d, selDay)) b.classList.add("is-selected");
      if (list.length) b.classList.add("has-trip");
      b.setAttribute("aria-label", d.getDate() + " " + MONTHS[m] +
        (list.length ? ": " + list.map(function (x) { return x.place.name; }).join(", ") : ", no trip"));
      b.appendChild(el("span", "ad-num", String(d.getDate())));
      list.forEach(function (x) {
        b.appendChild(el("span", "ad-tag" + (x.date.status === "full" ? " is-full" : x.date.status === "cancelled" ? " is-cancelled" : ""), x.place.name));
      });
      (function (dd) { b.addEventListener("click", function () { selDay = dd; renderCalendar(); renderDayPanel(); }); })(d);
      cell.appendChild(b);
    }
  }

  function statusSelect(value, onChange, label) {
    var s = el("select");
    s.setAttribute("aria-label", label || "Status");
    STATUS.forEach(function (o) {
      var opt = el("option", null, o[1]);
      opt.value = o[0];
      if (o[0] === (value || "open")) opt.selected = true;
      s.appendChild(opt);
    });
    s.addEventListener("change", function () { onChange(s.value); });
    return s;
  }

  function renderDayPanel() {
    var panel = $("daypanel");
    panel.textContent = "";
    if (!selDay) return;
    panel.appendChild(el("p", "ad-daytitle", LONG[selDay.getDay()] + ", " + range(selDay)));
    var list = on(selDay);
    if (!list.length) panel.appendChild(el("p", "ad-muted", "No trip on this day yet."));
    list.forEach(function (x) {
      var row = el("div", "ad-dayitem");
      var t = el("div");
      t.appendChild(el("b", null, x.place.name));
      t.appendChild(el("p", "ad-muted", range(x.start, x.end) + (x.date.note ? " · " + x.date.note : "")));
      row.appendChild(t);
      row.appendChild(statusSelect(x.date.status, function (v) { x.date.status = v; markDirty(); renderPlaces(); },
                                   "Status for " + x.place.name));
      var post = el("button", "ad-btn ad-btn--small", "Make a post");
      post.type = "button";
      post.addEventListener("click", function () { choosePost(x.place, x.date); });
      row.appendChild(post);
      var rm = el("button", "ad-btn ad-btn--small ad-btn--danger", "Take off the calendar");
      rm.type = "button";
      rm.addEventListener("click", function () {
        x.place.dates.splice(x.place.dates.indexOf(x.date), 1);
        markDirty(); renderPlaces();
      });
      row.appendChild(rm);
      panel.appendChild(row);
    });

    var add = el("div", "ad-adder");
    add.appendChild(el("h3", null, "Put a place on " + selDay.getDate() + " " + MONTHS[selDay.getMonth()]));
    var grid = el("div", "ad-row4");

    var f1 = el("div", "ad-field"); var l1 = el("label", null, "Place"); l1.htmlFor = "add-place";
    var sp = el("select"); sp.id = "add-place";
    data.places.forEach(function (p, i) { var o = el("option", null, p.name); o.value = String(i); sp.appendChild(o); });
    var on1 = el("option", null, "+ A new place…"); on1.value = "new"; sp.appendChild(on1);
    f1.appendChild(l1); f1.appendChild(sp);

    var f2 = el("div", "ad-field"); var l2 = el("label", null, "Last day"); l2.htmlFor = "add-end";
    var se = el("input"); se.type = "date"; se.id = "add-end"; se.value = iso(selDay); se.min = iso(selDay);
    f2.appendChild(l2); f2.appendChild(se);

    var f3 = el("div", "ad-field"); var l3 = el("label", null, "Status"); l3.htmlFor = "add-status";
    var ss = statusSelect("open", function () {}); ss.id = "add-status";
    f3.appendChild(l3); f3.appendChild(ss);

    var f4 = el("div", "ad-field"); var l4 = el("label", null, "Pickup / assembly note"); l4.htmlFor = "add-note";
    var sn = el("input"); sn.type = "text"; sn.id = "add-note"; sn.placeholder = "e.g. 3:00 AM · Cubao, Shaw Blvd or MOA";
    f4.appendChild(l4); f4.appendChild(sn);

    [f1, f2, f3, f4].forEach(function (f) { grid.appendChild(f); });
    add.appendChild(grid);
    var go = el("button", "ad-btn ad-btn--sun", "Add to the calendar");
    go.type = "button";
    go.addEventListener("click", function () {
      var p;
      if (sp.value === "new") { p = newPlace(); }
      else p = data.places[+sp.value];
      if (!p) return;
      var end = parse(se.value) || selDay;
      p.dates.push({ start: iso(selDay), end: iso(end < selDay ? selDay : end), status: ss.value, note: sn.value.trim() });
      openPlaces[p.id] = true;
      markDirty(); renderPlaces();
      toast(p.name + " added on " + range(selDay, end < selDay ? selDay : end) + ". Press Save to website when you're done.");
    });
    add.appendChild(go);
    panel.appendChild(add);
  }

  /* ---------------- places editor ---------------- */
  function newPlace() {
    var p = { id: uniqueId("new-place"), name: "New place", tag: "", blurb: "", price: "",
              noteLabel: "Pickup", itinerary: [{ time: "", text: "" }], dates: [] };
    data.places.push(p);
    fresh.push(p);
    openPlaces[p.id] = true;
    return p;
  }

  function field(labelText, value, onInput, opts) {
    opts = opts || {};
    var f = el("div", "ad-field");
    var id = "f" + Math.random().toString(36).slice(2, 9);
    var l = el("label", null, labelText); l.htmlFor = id;
    var i = el(opts.area ? "textarea" : "input");
    if (!opts.area) i.type = opts.type || "text";
    i.id = id;
    i.value = value || "";
    if (opts.placeholder) i.placeholder = opts.placeholder;
    i.addEventListener(opts.type === "date" ? "change" : "input", function () { onInput(i.value); });
    f.appendChild(l); f.appendChild(i);
    return f;
  }

  function smallBtn(text, label, fn, danger) {
    var b = el("button", "ad-btn ad-btn--small" + (danger ? " ad-btn--danger" : ""), text);
    b.type = "button";
    if (label) b.setAttribute("aria-label", label);
    b.addEventListener("click", fn);
    return b;
  }

  function renderPlaces() {
    var host = $("placelist");
    host.textContent = "";
    if (!data.places.length) host.appendChild(el("p", "ad-muted", "No places yet. Add your first one."));
    data.places.forEach(function (p, pi) {
      var box = el("details", "ad-place");
      if (openPlaces[p.id]) box.open = true;
      box.addEventListener("toggle", function () { openPlaces[p.id] = box.open; });
      var sum = el("summary");
      var title = el("b", null, p.name || "Untitled place");
      var next = p.dates.map(function (d) { return { s: parse(d.start), d: d }; })
                        .filter(function (x) { return x.s && dEnd(x.d) >= TODAY && x.d.status !== "cancelled"; })
                        .sort(function (a, b) { return a.s - b.s; })[0];
      var info = el("span", null, next ? "Next: " + range(next.s, dEnd(next.d)) : "No upcoming date");
      sum.appendChild(title); sum.appendChild(info);
      box.appendChild(sum);

      var body = el("div", "ad-placebody");
      var r1 = el("div", "ad-row2");
      r1.appendChild(field("Place name", p.name, function (v) {
        p.name = v; title.textContent = v || "Untitled place";
        if (fresh.indexOf(p) >= 0) { var old = p.id; p.id = uniqueId(slug(v), p); openPlaces[p.id] = openPlaces[old]; }
        markDirty();
      }));
      r1.appendChild(field("Short label (shown above the name)", p.tag, function (v) { p.tag = v; markDirty(); },
                           { placeholder: "e.g. Day hike" }));
      r1.appendChild(field("One-line description", p.blurb, function (v) { p.blurb = v; markDirty(); },
                           { placeholder: "e.g. 2,926 MASL · Kabayan, Benguet · sea of clouds" }));
      r1.appendChild(field("Price (leave empty to say 'ask for the rate')", p.price, function (v) { p.price = v; markDirty(); },
                           { placeholder: "e.g. ₱1,499 per head" }));
      r1.appendChild(field("Name for the date note", p.noteLabel, function (v) { p.noteLabel = v; markDirty(); },
                           { placeholder: "e.g. Pickup or Assembly" }));
      body.appendChild(r1);

      // dates
      body.appendChild(el("h3", "ad-sub", "Dates"));
      var dt = el("div", "ad-table");
      if (!p.dates.length) dt.appendChild(el("p", "ad-muted", "No dates. Add one here or tap a day on the calendar."));
      p.dates.forEach(function (d, di) {
        var row = el("div", "ad-trow ad-trow--date");
        row.appendChild(field("First day", d.start, function (v) { d.start = v; markDirty(); }, { type: "date" }));
        row.appendChild(field("Last day", d.end || d.start, function (v) { d.end = v; markDirty(); }, { type: "date" }));
        var sf = el("div", "ad-field");
        var sl = el("label", null, "Status");
        var ssel = statusSelect(d.status, function (v) { d.status = v; markDirty(); });
        ssel.id = "st-" + pi + "-" + di; sl.htmlFor = ssel.id;
        sf.appendChild(sl); sf.appendChild(ssel);
        row.appendChild(sf);
        row.appendChild(field(p.noteLabel || "Note", d.note, function (v) { d.note = v; markDirty(); },
                              { placeholder: "e.g. 3:00 AM · Cubao" }));
        var acts = el("div", "ad-acts");
        acts.appendChild(smallBtn("Post", "Make a post for this date", function () { choosePost(p, d); }));
        acts.appendChild(smallBtn("Remove", "Remove this date", function () {
          p.dates.splice(di, 1); markDirty(); renderPlaces();
        }, true));
        row.appendChild(acts);
        dt.appendChild(row);
      });
      body.appendChild(dt);
      var addD = el("div", "ad-btnrow");
      addD.appendChild(smallBtn("+ Add a date", null, function () {
        var t = iso(TODAY);
        p.dates.push({ start: t, end: t, status: "open", note: "" });
        markDirty(); renderPlaces();
      }));
      body.appendChild(addD);

      // itinerary
      body.appendChild(el("h3", "ad-sub", "Itinerary"));
      var it = el("div", "ad-table");
      p.itinerary.forEach(function (r, ri) {
        var row = el("div", "ad-trow ad-trow--itin");
        row.appendChild(field("Time", r.time, function (v) { r.time = v; markDirty(); }, { placeholder: "e.g. 3:00 AM" }));
        row.appendChild(field("What happens", r.text, function (v) { r.text = v; markDirty(); },
                              { placeholder: "e.g. Assembly and meetup" }));
        var acts = el("div", "ad-acts");
        acts.appendChild(smallBtn("↑", "Move up", function () {
          if (ri === 0) return;
          p.itinerary.splice(ri - 1, 0, p.itinerary.splice(ri, 1)[0]); markDirty(); renderPlaces();
        }));
        acts.appendChild(smallBtn("↓", "Move down", function () {
          if (ri === p.itinerary.length - 1) return;
          p.itinerary.splice(ri + 1, 0, p.itinerary.splice(ri, 1)[0]); markDirty(); renderPlaces();
        }));
        acts.appendChild(smallBtn("Remove", "Remove this row", function () {
          p.itinerary.splice(ri, 1); markDirty(); renderPlaces();
        }, true));
        row.appendChild(acts);
        it.appendChild(row);
      });
      body.appendChild(it);
      var addI = el("div", "ad-btnrow");
      addI.appendChild(smallBtn("+ Add a row", null, function () {
        p.itinerary.push({ time: "", text: "" }); markDirty(); renderPlaces();
      }));
      body.appendChild(addI);

      var del = el("div", "ad-btnrow");
      del.style.marginTop = "24px";
      del.appendChild(smallBtn("Delete this place", null, function () {
        if (!window.confirm("Delete " + (p.name || "this place") + " and all its dates from the website?")) return;
        data.places.splice(data.places.indexOf(p), 1); markDirty(); renderPlaces();
      }, true));
      body.appendChild(del);

      box.appendChild(body);
      host.appendChild(box);
    });
  }

  /* ---------------- social post ---------------- */
  function renderPostList(keep) {
    var s = $("posttrip");
    var prev = keep && postList[+s.value];
    postList = entries().sort(function (a, b) {
      var au = a.end >= TODAY, bu = b.end >= TODAY;
      if (au !== bu) return au ? -1 : 1;
      return au ? a.start - b.start : b.start - a.start;
    });
    s.textContent = "";
    if (!postList.length) { var o = el("option", null, "Add a date to a place first"); o.value = ""; s.appendChild(o); return; }
    postList.forEach(function (x, i) {
      var o = el("option", null, x.place.name + " — " + range(x.start, x.end) +
                 (x.date.status === "full" ? " (fully booked)" : x.date.status === "cancelled" ? " (cancelled)" : x.end < TODAY ? " (past)" : ""));
      o.value = String(i);
      if (prev && prev.date === x.date) o.selected = true;
      s.appendChild(o);
    });
  }

  function choosePost(p, d) {
    renderPostList();
    var i = postList.map(function (x) { return x.date; }).indexOf(d);
    if (i >= 0) $("posttrip").value = String(i);
    makePost();
    $("social").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function camel(s) {
    return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ")
      .split(/[^A-Za-z0-9]+/).filter(Boolean)
      .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join("");
  }

  function icon(p) {
    var s = (p.name + " " + p.tag + " " + p.blurb).toLowerCase();
    if (/cave|sagada|terrace|cloud/.test(s)) return "☁️";
    if (/hike|mount|mt\.|peak|trek|summit|masl/.test(s)) return "⛰️";
    if (/beach|island|surf|union|resort|coast|dive|boat|\bsea\b/.test(s)) return "🌊";
    return "🚐";
  }

  function caption(x) {
    var p = x.place, d = x.date, e = icon(p), L = [];
    if (d.status === "cancelled") {
      L.push("📢 TRIP UPDATE: " + p.name.toUpperCase() + " (" + range(x.start, x.end) + ") IS CANCELLED 📢", "");
      L.push("Pasensya na, beshies! 🙏 Paid joiners: we'll message you personally for your full refund or a transfer to another trip.", "");
    } else {
      L.push(e + " " + p.name.toUpperCase() + (p.tag ? " — " + p.tag.toUpperCase() : "") + " " + e);
      L.push([e, e, e, e, e].join(" "), "");
      L.push("📅 " + (same(x.start, x.end) ? LONG[x.start.getDay()] + ", " : "") + range(x.start, x.end));
      if (p.blurb) L.push("📍 " + p.blurb);
      L.push("💰 " + (p.price || "Message us for the rate"));
      if (d.note) L.push("🚐 " + (p.noteLabel || "Details") + ": " + d.note);
      if (d.status === "full") L.push("", "🔥 FULLY BOOKED na! Salamat po! Message us to get on the waitlist or for our next date.");
      var rows = p.itinerary.filter(function (r) { return (r.time || "").trim() || (r.text || "").trim(); });
      if (rows.length) {
        L.push("", "🕒 ITINERARY");
        rows.forEach(function (r) { L.push((r.time ? r.time + " – " : "• ") + r.text); });
        L.push("", "⚠️ Times may shift with the weather and the group's pace.");
      }
      L.push("", d.status === "full" ? "📩 MESSAGE US!" : "📩 RESERVE NA! Limited seats lang, beshy!");
    }
    L.push("💬 Messenger: " + SITE.messenger, "📱 " + SITE.phone, "🌐 " + SITE.url, "");
    if (d.status !== "cancelled") L.push("🌴 THE LEAVE CREDITS EXPIRE. THE ISLANDS DON'T. 🌴", "");
    var tags = ["#EveWanderlust", "#TravelPH", "#" + camel(p.name)];
    if (p.tag && camel(p.tag).length <= 18) tags.push("#" + camel(p.tag));
    tags.push(d.status === "cancelled" ? "#TravelUpdate" : "#JoinersPH", "#ItsMoreFunInThePhilippines");
    L.push(tags.filter(function (t, i) { return t.length > 1 && tags.indexOf(t) === i; }).join(" "));
    return L.join("\n");
  }

  /* the itinerary picture, drawn to match the Eve Wanderlust brand kit */
  function drawPicture(x) {
    var c = $("postimg"), g = c.getContext("2d"), W = 1080, H = 1350;
    var CREAM = "#F5EBDA", DEEP = "#0F3B4A", TEAL = "#3E7C83", SUN = "#E8734A", CORAL = "#C4502A", LIGHT = "#F2A98A";
    var p = x.place, d = x.date;
    function poly(pts, col) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(function (q) { g.lineTo(q[0], q[1]); }); g.closePath(); g.fillStyle = col; g.fill(); }
    function rrect(x0, y0, w, h, r) { g.beginPath(); g.moveTo(x0 + r, y0); g.arcTo(x0 + w, y0, x0 + w, y0 + h, r); g.arcTo(x0 + w, y0 + h, x0, y0 + h, r); g.arcTo(x0, y0 + h, x0, y0, r); g.arcTo(x0, y0, x0 + w, y0, r); g.closePath(); }
    function spacing(px) { if ("letterSpacing" in g) g.letterSpacing = px + "px"; }
    function wrap(text, max) {
      var words = String(text).split(/\s+/), lines = [], cur = "";
      words.forEach(function (w) {
        var t = cur ? cur + " " + w : w;
        if (g.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t;
      });
      if (cur) lines.push(cur);
      return lines;
    }
    function fit(text, max) {
      if (g.measureText(text).width <= max) return text;
      while (text.length > 1 && g.measureText(text + "…").width > max) text = text.slice(0, -1);
      return text + "…";
    }

    g.clearRect(0, 0, W, H);
    g.fillStyle = CREAM; g.fillRect(0, 0, W, H);
    g.beginPath(); g.arc(985, 175, 62, 0, Math.PI * 2); g.fillStyle = SUN; g.fill();
    poly([[620, 402], [860, 168], [1100, 402]], DEEP);
    poly([[860, 402], [1010, 250], [1160, 402]], TEAL);
    g.fillStyle = DEEP; g.fillRect(0, 400, W, H - 400);

    g.textBaseline = "alphabetic"; spacing(0);
    g.font = "700 30px Fraunces, Georgia, serif"; g.fillStyle = DEEP; g.fillText("Eve ", 80, 90);
    var ew = g.measureText("Eve ").width;
    g.font = "italic 500 30px Fraunces, Georgia, serif"; g.fillStyle = CORAL; g.fillText("Wanderlust", 80 + ew, 90);

    var status = d.status === "cancelled" ? "CANCELLED · " : d.status === "full" ? "FULLY BOOKED · " : "";
    var pill = (status + (p.tag ? p.tag + " · " : "") + range(x.start, x.end)).toUpperCase();
    g.font = "700 20px Outfit, sans-serif"; spacing(3);
    pill = fit(pill, 640);
    var pw = g.measureText(pill).width + 44;
    rrect(80, 114, pw, 44, 22); g.fillStyle = d.status === "cancelled" ? "#6d7b7e" : CORAL; g.fill();
    g.fillStyle = CREAM; g.fillText(pill, 102, 143);
    spacing(0);

    var size = 100, lines;
    g.font = "700 " + size + "px Fraunces, Georgia, serif";
    lines = wrap(p.name, 640);
    if (lines.length > 1) {
      size = 72; g.font = "700 " + size + "px Fraunces, Georgia, serif"; lines = wrap(p.name, 640);
      while ((lines.length > 2 || lines.some(function (l) { return g.measureText(l).width > 660; })) && size > 44) {
        size -= 6; g.font = "700 " + size + "px Fraunces, Georgia, serif"; lines = wrap(p.name, 640);
      }
      lines = lines.slice(0, 2);
    } else {
      while (g.measureText(lines[0]).width > 640 && size > 50) { size -= 4; g.font = "700 " + size + "px Fraunces, Georgia, serif"; }
    }
    g.fillStyle = DEEP;
    var ty = 186 + size * 0.82;
    lines.forEach(function (l, i) { g.fillText(l, 80, ty + i * size * 1.0); });
    var after = ty + (lines.length - 1) * size + 26;

    var chips = String(p.blurb || "").split(/\s*·\s*/).filter(Boolean).slice(0, 3);
    g.font = "700 19px Outfit, sans-serif";
    var cx = 80;
    chips.forEach(function (ch) {
      ch = fit(ch, 640 - (cx - 80) - 36);
      var w = g.measureText(ch).width + 36;
      if (cx + w > 760 || after + 42 > 396) return;
      rrect(cx, after, w, 42, 21); g.lineWidth = 2; g.strokeStyle = DEEP; g.stroke();
      g.fillStyle = DEEP; g.fillText(ch, cx + 18, after + 28);
      cx += w + 10;
    });

    var rows = p.itinerary.filter(function (r) { return (r.time || "").trim() || (r.text || "").trim(); });
    var more = 0;
    if (rows.length > 16) { more = rows.length - 15; rows = rows.slice(0, 15); }
    var top = 446, bottom = 1140;
    if (!rows.length) {
      g.font = "500 30px Outfit, sans-serif"; g.fillStyle = CREAM;
      g.fillText("Message us for the full itinerary.", 80, 520);
    } else {
      var n = rows.length + (more ? 1 : 0);
      var rh = Math.min(58, (bottom - top) / n);
      var fs = Math.max(16, Math.min(24, Math.floor(rh * 0.42)));
      g.font = "700 " + fs + "px Outfit, sans-serif";
      var tw = 0;
      rows.forEach(function (r) { tw = Math.max(tw, g.measureText(r.time || "").width); });
      tw = Math.min(Math.max(tw, 60), 240);
      var dotX = 80 + tw + 28, textX = dotX + 26, textW = 1000 - textX;
      g.strokeStyle = TEAL; g.lineWidth = 3;
      g.beginPath(); g.moveTo(dotX, top + rh / 2); g.lineTo(dotX, top + rh * (n - 0.5)); g.stroke();
      rows.forEach(function (r, i) {
        var cy = top + rh * i + rh / 2;
        g.font = "700 " + fs + "px Outfit, sans-serif"; g.fillStyle = LIGHT;
        g.fillText(fit(r.time || "", tw), 80, cy + fs * 0.35);
        g.beginPath(); g.arc(dotX, cy, 8, 0, Math.PI * 2); g.fillStyle = DEEP; g.fill();
        g.lineWidth = 3; g.strokeStyle = LIGHT; g.stroke();
        g.font = "500 " + fs + "px Outfit, sans-serif"; g.fillStyle = CREAM;
        g.fillText(fit(r.text || "", textW), textX, cy + fs * 0.35);
      });
      if (more) {
        g.font = "500 " + fs + "px Outfit, sans-serif"; g.fillStyle = "#C9D6D4";
        g.fillText("…and " + more + " more on radicalmediaph.com/travel", textX, top + rh * rows.length + rh / 2 + fs * 0.35);
      }
    }

    g.fillStyle = TEAL; g.fillRect(80, 1170, 920, 2);
    g.font = "700 25px Outfit, sans-serif"; g.fillStyle = CREAM;
    var lead = d.status === "cancelled" ? "Questions? " : "Book: ";
    g.fillText(lead, 80, 1222);
    var lw = g.measureText(lead).width;
    g.fillStyle = LIGHT; g.fillText("radicalmediaph.com/travel", 80 + lw, 1222);
    var lw2 = g.measureText("radicalmediaph.com/travel").width;
    g.fillStyle = CREAM; g.fillText(" · " + SITE.phone, 80 + lw + lw2, 1222);
    g.font = "500 19px Outfit, sans-serif"; g.fillStyle = "#C9D6D4";
    g.fillText("Times may shift with weather, trail conditions and the group's pace.", 80, 1262);
  }

  function current() { return postList[+$("posttrip").value] || null; }

  function makePost() {
    var x = current();
    if (!x) { $("caption").value = ""; return; }
    $("caption").value = caption(x);
    var fonts = ["700 100px Fraunces", "italic 500 30px Fraunces", "700 24px Outfit", "500 24px Outfit"];
    var ready = document.fonts && document.fonts.load
      ? Promise.all(fonts.map(function (f) { return document.fonts.load(f); })).catch(function () {})
      : Promise.resolve();
    drawPicture(x);
    ready.then(function () { drawPicture(x); });
  }

  function pictureBlob() {
    return new Promise(function (res) { $("postimg").toBlob(res, "image/png"); });
  }

  function postToFacebook() {
    var msg = $("fbmsg");
    msg.className = "ad-msg";
    var page = read("eve.fbpage"), token = read("eve.fbtoken");
    if (!page || !token) { msg.textContent = "Connect the Facebook page in Settings first."; msg.classList.add("is-bad"); return; }
    var x = current();
    if (!x) { msg.textContent = "Pick a trip first."; msg.classList.add("is-bad"); return; }
    var later = document.querySelector("input[name=when]:checked").value === "later";
    var when = null;
    if (later) {
      var v = $("schedat").value ? new Date($("schedat").value) : null;
      var mins = v ? (v - new Date()) / 60000 : 0;
      if (!v || mins < 10 || mins > 60 * 24 * 30) {
        msg.textContent = "Pick a time between 10 minutes and 30 days from now."; msg.classList.add("is-bad"); return;
      }
      when = Math.floor(v.getTime() / 1000);
    }
    var btn = $("fbpost");
    btn.disabled = true;
    msg.textContent = later ? "Scheduling on Facebook…" : "Posting to Facebook…";
    pictureBlob().then(function (blob) {
      var fd = new FormData();
      fd.append("source", blob, "eve-" + x.place.id + "-" + iso(x.start) + ".png");
      fd.append("caption", $("caption").value);
      fd.append("access_token", token);
      if (when) { fd.append("published", "false"); fd.append("scheduled_publish_time", String(when)); }
      return fetch(GRAPH + encodeURIComponent(page) + "/photos", { method: "POST", body: fd });
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.error) throw new Error(j.error.message);
      msg.textContent = "";
      if (when) msg.textContent = "Scheduled. It goes up on " + new Date(when * 1000).toLocaleString() + ". ";
      else msg.textContent = "Posted. ";
      if (j.post_id && !when) {
        var a = el("a", null, "Open the post on Facebook");
        a.href = "https://www.facebook.com/" + j.post_id; a.target = "_blank"; a.rel = "noopener";
        msg.appendChild(a);
      }
      msg.classList.add("is-ok");
    }).catch(function (e) {
      msg.textContent = "Facebook said: " + (e.message || "something went wrong") +
        ". If it mentions the token, get a new one in Settings.";
      msg.classList.add("is-bad");
    }).then(function () { btn.disabled = false; });
  }

  /* ---------------- settings ---------------- */
  function ghState(ok, text) {
    var s = $("ghstate");
    s.textContent = text || (ok ? "Connected" : "Not connected");
    s.classList.toggle("is-ok", !!ok);
  }
  function fbState(ok, text) {
    var s = $("fbstate");
    s.textContent = text || (ok ? "Connected" : "Not connected");
    s.classList.toggle("is-ok", !!ok);
  }

  function connectGitHub() {
    var key = $("ghkey").value.trim();
    if (!key) { toast("Paste the GitHub access key first."); return; }
    store("eve.ghkey", key);
    ghState(false, "Checking…");
    gh("GET", "/repos/" + REPO.owner + "/" + REPO.name).then(function (j) {
      if (j.permissions && j.permissions.push === false) throw new Error("this key can only read the website");
      ghState(true);
      $("ghkey").value = "";
      toast("Website key connected.");
      if (!dirty) load(); else setSaveState();
    }).catch(function (e) {
      store("eve.ghkey", null);
      ghState(false, "Didn't work");
      toast("That key didn't work: " + e.message);
    });
  }

  function connectFacebook() {
    var page = $("fbpage").value.trim(), token = $("fbtoken").value.trim();
    if (!page || !token) { toast("Fill in both the page ID and the token."); return; }
    fbState(false, "Checking…");
    fetch(GRAPH + encodeURIComponent(page) + "?fields=name&access_token=" + encodeURIComponent(token))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.error) throw new Error(j.error.message);
        store("eve.fbpage", page); store("eve.fbtoken", token);
        $("fbtoken").value = "";
        fbState(true, "Connected: " + (j.name || page));
        store("eve.fbname", j.name || page);
        toast("Facebook page connected.");
      })
      .catch(function (e) { fbState(false, "Didn't work"); toast("Facebook said: " + e.message); });
  }

  /* ---------------- wire up ---------------- */
  function renderAll() {
    renderCalendar();
    renderDayPanel();
    renderPlaces();
    renderPostList(true);
    makePost();
  }

  document.querySelectorAll("[data-cal]").forEach(function (b) {
    b.addEventListener("click", function () {
      view = new Date(view.getFullYear(), view.getMonth() + (b.getAttribute("data-cal") === "next" ? 1 : -1), 1);
      renderCalendar();
    });
  });
  $("savebtn").addEventListener("click", save);
  $("addplace").addEventListener("click", function () {
    newPlace(); markDirty(); renderPlaces();
    var boxes = document.querySelectorAll(".ad-place");
    var last = boxes[boxes.length - 1];
    if (last) { last.scrollIntoView({ behavior: "smooth", block: "center" }); var i = last.querySelector("input"); if (i) { i.focus({ preventScroll: true }); i.select(); } }
  });
  $("posttrip").addEventListener("change", makePost);
  $("regen").addEventListener("click", makePost);
  $("copycap").addEventListener("click", function () {
    var t = $("caption").value;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject())
      .then(function () { toast("Caption copied."); }, function () { $("caption").select(); toast("Press Ctrl+C to copy."); });
  });
  $("dlimg").addEventListener("click", function () {
    var x = current();
    pictureBlob().then(function (b) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = "eve-" + (x ? x.place.id + "-" + iso(x.start) : "post") + ".png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    });
  });
  $("fbpost").addEventListener("click", postToFacebook);
  $("ghsave").addEventListener("click", connectGitHub);
  $("ghforget").addEventListener("click", function () { store("eve.ghkey", null); ghState(false); setSaveState(); toast("Website key removed from this device."); });
  $("fbsave").addEventListener("click", connectFacebook);
  $("fbforget").addEventListener("click", function () {
    ["eve.fbpage", "eve.fbtoken", "eve.fbname"].forEach(function (k) { store(k, null); });
    fbState(false); toast("Facebook token removed from this device.");
  });
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  if (read("eve.ghkey")) ghState(true);
  if (read("eve.fbtoken")) { fbState(true, "Connected: " + (read("eve.fbname") || read("eve.fbpage"))); $("fbpage").value = read("eve.fbpage"); }
  var sd = new Date(Date.now() + 60 * 60000); sd.setMinutes(0, 0, 0);
  $("schedat").value = iso(sd) + "T" + String(sd.getHours()).padStart(2, "0") + ":00";
  load();
})();
