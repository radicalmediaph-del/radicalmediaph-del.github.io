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

  function saveNow() {
    if (!dirty) { toast("Nothing new to save. Everything is already on the website."); return; }
    save();
  }

  function setSaveState(msg) {
    var bar = $("savebar"), st = $("savestate"), btn = $("savebtn");
    bar.classList.toggle("is-dirty", dirty);
    $("floatsave").hidden = !dirty;
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

      var sv = el("div", "ad-btnrow ad-placesave");
      var svb = el("button", "ad-btn ad-btn--sun", "Save changes to website");
      svb.type = "button";
      svb.addEventListener("click", saveNow);
      sv.appendChild(svb);
      sv.appendChild(el("span", "ad-muted", "Saves every change on this page, not only this place."));
      body.appendChild(sv);

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
    $("xcap").value = xText(x);
    countX();
    if (video && video.key !== videoKey(x)) {
      video = null;
      var pv = $("postvid");
      if (pv.src) { URL.revokeObjectURL(pv.src); pv.removeAttribute("src"); pv.load(); }
      $("dlvid").disabled = true;
      $("vidmsg").textContent = "";
    }
    var fonts = ["700 100px Fraunces", "italic 500 30px Fraunces", "700 24px Outfit", "500 24px Outfit"];
    var ready = document.fonts && document.fonts.load
      ? Promise.all(fonts.map(function (f) { return document.fonts.load(f); })).catch(function () {})
      : Promise.resolve();
    drawPicture(x);
    ready.then(function () { drawPicture(x); });
  }

  function pictureBlob(type) {
    return new Promise(function (res) { $("postimg").toBlob(res, type || "image/png", 0.92); });
  }

  /* ---------------- trip video (YouTube Shorts and TikTok) ---------------- */
  var VID_W = 1080, VID_H = 1920, VID_SECONDS = 15;
  var video = null;            // { blob, type, ext, key }

  function videoKey(x) { return x ? JSON.stringify([x.place, x.date]) : ""; }

  function drawVideo(g, x, t) {
    var CREAM = "#F5EBDA", DEEP = "#0F3B4A", TEAL = "#3E7C83", SUN = "#E8734A", CORAL = "#C4502A", LIGHT = "#F2A98A";
    var p = x.place, d = x.date;
    function clamp(v) { return Math.max(0, Math.min(1, v)); }
    function ease(v) { v = clamp(v); return 1 - Math.pow(1 - v, 3); }
    function poly(pts, col) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(function (q) { g.lineTo(q[0], q[1]); }); g.closePath(); g.fillStyle = col; g.fill(); }
    function rrect(x0, y0, w, h, r) { g.beginPath(); g.moveTo(x0 + r, y0); g.arcTo(x0 + w, y0, x0 + w, y0 + h, r); g.arcTo(x0 + w, y0 + h, x0, y0 + h, r); g.arcTo(x0, y0 + h, x0, y0, r); g.arcTo(x0, y0, x0 + w, y0, r); g.closePath(); }
    function fit(text, max) {
      text = String(text || "");
      if (g.measureText(text).width <= max) return text;
      while (text.length > 1 && g.measureText(text + "…").width > max) text = text.slice(0, -1);
      return text + "…";
    }
    function spacing(px) { if ("letterSpacing" in g) g.letterSpacing = px + "px"; }

    g.globalAlpha = 1; spacing(0); g.textBaseline = "alphabetic";
    g.fillStyle = CREAM; g.fillRect(0, 0, VID_W, VID_H);
    g.beginPath(); g.arc(930, 520 - ease(t / 1.6) * 230, 84, 0, Math.PI * 2); g.fillStyle = SUN; g.fill();
    poly([[540, 622], [800, 330], [1060, 622]], DEEP);
    poly([[820, 622], [1000, 420], [1180, 622]], TEAL);
    g.fillStyle = DEEP; g.fillRect(0, 620, VID_W, VID_H - 620);

    // header
    g.globalAlpha = ease(t / 0.8);
    var dy = (1 - ease(t / 0.8)) * 24;
    g.font = "700 40px Fraunces, Georgia, serif"; g.fillStyle = DEEP; g.fillText("Eve ", 80, 150 + dy);
    var ew = g.measureText("Eve ").width;
    g.font = "italic 500 40px Fraunces, Georgia, serif"; g.fillStyle = CORAL; g.fillText("Wanderlust", 80 + ew, 150 + dy);

    var status = d.status === "cancelled" ? "CANCELLED · " : d.status === "full" ? "FULLY BOOKED · " : "";
    g.font = "700 26px Outfit, sans-serif"; spacing(3);
    var pill = fit((status + (p.tag ? p.tag + " · " : "") + range(x.start, x.end)).toUpperCase(), 760);
    rrect(80, 184 + dy, g.measureText(pill).width + 52, 56, 28);
    g.fillStyle = d.status === "cancelled" ? "#6d7b7e" : CORAL; g.fill();
    g.fillStyle = CREAM; g.fillText(pill, 106, 222 + dy);
    spacing(0);

    var size = 120;
    g.font = "700 " + size + "px Fraunces, Georgia, serif";
    var words = String(p.name).split(/\s+/), lines = [], cur = "";
    function wrapAt(max) {
      lines = []; cur = "";
      words.forEach(function (w) {
        var tt = cur ? cur + " " + w : w;
        if (g.measureText(tt).width > max && cur) { lines.push(cur); cur = w; } else cur = tt;
      });
      if (cur) lines.push(cur);
    }
    wrapAt(640);
    while ((lines.length > 2 || lines.some(function (l) { return g.measureText(l).width > 660; })) && size > 50) {
      size -= 6; g.font = "700 " + size + "px Fraunces, Georgia, serif"; wrapAt(640);
    }
    if (lines.length > 1 && size > 84) { size = 84; g.font = "700 " + size + "px Fraunces, Georgia, serif"; wrapAt(640); }
    lines = lines.slice(0, 2);
    g.fillStyle = DEEP;
    var base = 290 + size * 0.82 + dy;
    lines.forEach(function (l, i) { g.fillText(l, 80, base + i * size); });
    var chipY = base + (lines.length - 1) * size + 34;
    g.font = "700 26px Outfit, sans-serif";
    var cx = 80;
    String(p.blurb || "").split(/\s*·\s*/).filter(Boolean).slice(0, 3).forEach(function (ch) {
      ch = fit(ch, 600 - (cx - 80));
      var w = g.measureText(ch).width + 44;
      if (cx + w > 720 || chipY + 54 > 600) return;
      rrect(cx, chipY, w, 54, 27); g.lineWidth = 2.5; g.strokeStyle = DEEP; g.stroke();
      g.fillStyle = DEEP; g.fillText(ch, cx + 22, chipY + 36);
      cx += w + 12;
    });

    // itinerary, one stop at a time
    var rows = (p.itinerary || []).filter(function (r) { return (r.time || "").trim() || (r.text || "").trim(); }).slice(0, 16);
    var top = 700, bottom = 1540;
    if (rows.length) {
      var n = rows.length, rh = Math.min(66, (bottom - top) / n);
      var fs = Math.max(20, Math.min(32, Math.floor(rh * 0.46)));
      g.globalAlpha = 1;
      g.font = "700 " + fs + "px Outfit, sans-serif";
      var tw = 0;
      rows.forEach(function (r) { tw = Math.max(tw, g.measureText(r.time || "").width); });
      tw = Math.min(Math.max(tw, 70), 300);
      var dotX = 80 + tw + 30, textX = dotX + 30, textW = 1030 - textX;
      rows.forEach(function (r, i) {
        var a = ease((t - (1.0 + i * (8 / n))) / 0.45);
        if (a <= 0) return;
        var cy = top + rh * i + rh / 2, sx = (1 - a) * 36;
        g.globalAlpha = a;
        if (i > 0) { g.strokeStyle = TEAL; g.lineWidth = 3; g.beginPath(); g.moveTo(dotX, cy - rh); g.lineTo(dotX, cy); g.stroke(); }
        g.font = "700 " + fs + "px Outfit, sans-serif"; g.fillStyle = LIGHT;
        g.fillText(fit(r.time, tw), 80 + sx, cy + fs * 0.35);
        g.beginPath(); g.arc(dotX, cy, 9, 0, Math.PI * 2); g.fillStyle = DEEP; g.fill();
        g.lineWidth = 3.5; g.strokeStyle = LIGHT; g.stroke();
        g.font = "500 " + fs + "px Outfit, sans-serif"; g.fillStyle = CREAM;
        g.fillText(fit(r.text, textW), textX + sx, cy + fs * 0.35);
      });
    } else {
      g.globalAlpha = ease((t - 1) / 0.6);
      g.font = "500 40px Outfit, sans-serif"; g.fillStyle = CREAM;
      g.fillText("Message us for the full itinerary.", 80, 820);
    }

    // call to action
    var ca = ease((t - 10.2) / 0.6);
    if (ca > 0) {
      g.globalAlpha = ca;
      g.fillStyle = TEAL; g.fillRect(80, 1600, 920, 3);
      var pulse = 1 + Math.sin(Math.max(0, t - 10.8) * 4) * 0.025;
      g.save(); g.translate(80, 1700); g.scale(pulse, pulse);
      g.font = "700 72px Fraunces, Georgia, serif"; g.fillStyle = LIGHT;
      g.fillText(d.status === "cancelled" ? "Message us" : d.status === "full" ? "Fully booked!" : "Reserve na!", 0, 0);
      g.restore();
      g.font = "700 42px Outfit, sans-serif"; g.fillStyle = CREAM;
      g.fillText("radicalmediaph.com/travel", 80, 1780);
      g.font = "500 36px Outfit, sans-serif"; g.fillStyle = "#C9D6D4";
      g.fillText(SITE.phone + " · Messenger: Eve Wanderlust", 80, 1838);
    }
    g.globalAlpha = 1;
  }

  function videoType() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return null;
    var list = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    for (var i = 0; i < list.length; i++) if (MediaRecorder.isTypeSupported(list[i])) return list[i];
    return null;
  }

  function makeVideo() {
    var x = current(), msg = $("vidmsg");
    msg.className = "ad-msg";
    if (!x) { msg.textContent = "Pick a trip first."; return Promise.reject(new Error("no trip")); }
    var key = videoKey(x);
    if (video && video.key === key) return Promise.resolve(video);
    var type = videoType();
    var c = document.createElement("canvas");
    if (!type || !c.captureStream) {
      msg.textContent = "This browser can't make videos. Open the back office in Chrome on a computer.";
      msg.classList.add("is-bad");
      return Promise.reject(new Error("no recorder"));
    }
    c.width = VID_W; c.height = VID_H;
    c.style.cssText = "position:fixed;left:-99999px;top:0;width:10px;height:10px";
    document.body.appendChild(c);
    var g = c.getContext("2d");
    $("mkvid").disabled = true; $("dlvid").disabled = true;
    return (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () {
      return new Promise(function (resolve, reject) {
        var stream = c.captureStream(30), chunks = [];
        var rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6000000 });
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onerror = function (e) { reject(e.error || new Error("recording failed")); };
        rec.onstop = function () {
          var mime = type.split(";")[0];
          resolve({ blob: new Blob(chunks, { type: mime }), type: mime, ext: mime === "video/mp4" ? "mp4" : "webm", key: key });
        };
        drawVideo(g, x, 0);
        rec.start(250);
        var t0 = performance.now();
        (function tick() {
          var t = (performance.now() - t0) / 1000;
          drawVideo(g, x, Math.min(t, VID_SECONDS));
          msg.textContent = "Recording the video… " + Math.min(VID_SECONDS, Math.floor(t)) + " of " + VID_SECONDS + " seconds";
          if (t < VID_SECONDS) requestAnimationFrame(tick);
          else setTimeout(function () { rec.stop(); stream.getTracks().forEach(function (k) { k.stop(); }); }, 120);
        })();
      });
    }).then(function (v) {
      video = v;
      var el2 = $("postvid");
      if (el2.src) URL.revokeObjectURL(el2.src);
      el2.src = URL.createObjectURL(v.blob);
      msg.textContent = "Video ready (" + Math.round(v.blob.size / 1024 / 102.4) / 10 + " MB).";
      msg.classList.add("is-ok");
      return v;
    }, function (e) {
      msg.textContent = "Couldn't make the video: " + (e.message || e) + ".";
      msg.classList.add("is-bad");
      throw e;
    }).then(function (v) {
      c.remove(); $("mkvid").disabled = false; $("dlvid").disabled = false; return v;
    }, function (e) { c.remove(); $("mkvid").disabled = false; throw e; });
  }

  function download(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function fileName(x, ext) { return "eve-" + (x ? x.place.id + "-" + iso(x.start) : "post") + "." + ext; }

  /* ---------------- YouTube Shorts ---------------- */
  var ytTok = null, ytExp = 0, ytClient = null, ytWaiting = null;
  var YT_SCOPE = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";

  function loadGis() {
    if (window.google && google.accounts && google.accounts.oauth2) return;
    if (document.getElementById("gis")) return;
    var s = document.createElement("script");
    s.id = "gis"; s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    document.head.appendChild(s);
  }

  // must be called straight from a click, so the Google sign-in window isn't blocked
  function ytToken() {
    if (ytTok && Date.now() < ytExp - 60000) return Promise.resolve(ytTok);
    var id = read("eve.ytclient");
    if (!id) return Promise.reject(new Error("Connect YouTube in Settings first"));
    if (!(window.google && google.accounts && google.accounts.oauth2)) {
      loadGis();
      return Promise.reject(new Error("Google sign-in is still loading; press the button again"));
    }
    if (!ytClient) {
      ytClient = google.accounts.oauth2.initTokenClient({
        client_id: id, scope: YT_SCOPE,
        callback: function (r) {
          var w = ytWaiting; ytWaiting = null;
          if (!w) return;
          if (r.error) w.reject(new Error(r.error_description || r.error));
          else { ytTok = r.access_token; ytExp = Date.now() + (r.expires_in || 3600) * 1000; w.resolve(ytTok); }
        },
        error_callback: function (e) {
          var w = ytWaiting; ytWaiting = null;
          if (w) w.reject(new Error(e && e.type === "popup_closed" ? "the Google window was closed" : "Google sign-in was blocked"));
        }
      });
    }
    return new Promise(function (resolve, reject) {
      ytWaiting = { resolve: resolve, reject: reject };
      ytClient.requestAccessToken({ prompt: ytTok ? "" : "select_account" });
    });
  }

  function ytFetch(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ "Authorization": "Bearer " + ytTok }, opts.headers || {});
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || j.error) throw new Error((j.error && j.error.message) || ("YouTube said " + r.status));
        return j;
      });
    });
  }

  function uploadShort(v, x, text, when) {
    var p = x.place;
    var title = (p.name + " — " + range(x.start, x.end) + " #Shorts").slice(0, 100);
    var meta = {
      snippet: {
        title: title.replace(/[<>]/g, ""),
        description: (text + "\n\n#Shorts").replace(/[<>]/g, "").slice(0, 4900),
        tags: ["Eve Wanderlust", "Philippines travel", p.name, "joiners"].filter(Boolean),
        categoryId: "19"
      },
      status: { privacyStatus: when ? "private" : "public", selfDeclaredMadeForKids: false }
    };
    if (when) meta.status.publishAt = new Date(when * 1000).toISOString();
    var B = "eve" + Date.now();
    var body = new Blob([
      "--" + B + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(meta) +
      "\r\n--" + B + "\r\nContent-Type: " + v.type + "\r\n\r\n", v.blob, "\r\n--" + B + "--\r\n"]);
    return ytFetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
                   { method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + B }, body: body });
  }

  function ytState() {
    var s = $("ytstate"), id = read("eve.ytclient");
    s.textContent = id ? "Connected" + (read("eve.ytname") ? ": " + read("eve.ytname") : "") : "Not connected";
    s.classList.toggle("is-ok", !!id);
    $("to-yt").disabled = !id;
    $("to-yt").checked = !!id;
    $("ytnote").hidden = !!id;
    if (id) loadGis();
  }

  function connectYouTube() {
    var id = $("ytclient").value.trim() || read("eve.ytclient");
    if (!/\.apps\.googleusercontent\.com$/.test(id)) { toast("Paste the client ID; it ends in .apps.googleusercontent.com"); return; }
    if (id !== read("eve.ytclient")) { ytClient = null; ytTok = null; }
    store("eve.ytclient", id);
    if (!(window.google && google.accounts && google.accounts.oauth2)) {
      loadGis();
      toast("Loading Google sign-in… press Connect again in a moment.");
      return;
    }
    ytToken().then(function () {
      return ytFetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true");
    }).then(function (j) {
      var ch = j.items && j.items[0];
      store("eve.ytname", ch ? ch.snippet.title : "");
      $("ytclient").value = "";
      ytState();
      toast(ch ? "YouTube connected: " + ch.snippet.title : "Signed in, but that Google account has no YouTube channel yet.");
    }).catch(function (e) { toast("YouTube didn't connect: " + e.message); ytState(); });
  }

  /* ---------------- X and TikTok, one tap ---------------- */
  function xText(x) {
    var p = x.place, d = x.date, e = icon(p), L = [];
    if (d.status === "cancelled") {
      L.push("📢 " + p.name + " (" + range(x.start, x.end) + ") is cancelled. Paid joiners: we'll message you about your refund.");
    } else {
      L.push(e + " " + p.name + " — " + range(x.start, x.end));
      if (p.blurb) L.push("📍 " + p.blurb);
      if (p.price) L.push("💰 " + p.price);
      L.push(d.status === "full" ? "🔥 Fully booked! Message us for the next date." : "Reserve na! 👉 radicalmediaph.com/travel");
    }
    var tags = "#EveWanderlust #TravelPH #" + camel(p.name);
    var out = L.concat(["", tags]).join("\n");
    if (out.length > 270 && p.blurb) out = L.filter(function (l) { return l.indexOf("📍") !== 0; }).concat(["", tags]).join("\n");
    return out.slice(0, 280);
  }

  function countX() {
    var n = $("xcap").value.replace(/https?:\/\/\S+|\b[\w.-]+\.(com|ph|net|org)(\/\S*)?/g, "xxxxxxxxxxxxxxxxxxxxxxx").length;
    $("xcount").textContent = n + " of 280 characters" + (n > 280 ? " — too long for X" : "");
  }

  function phone() { return window.matchMedia && matchMedia("(pointer: coarse)").matches; }
  function canShareFile(type) {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File(["x"], "a", { type: type })] })); }
    catch (e) { return false; }
  }

  function shareX() {
    var x = current(), msg = $("sharemsg");
    msg.className = "ad-msg";
    if (!x) { msg.textContent = "Pick a trip first."; return; }
    var text = $("xcap").value;
    if (phone() && canShareFile("image/jpeg")) {
      pictureBlob("image/jpeg").then(function (b) {
        return navigator.share({ files: [new File([b], fileName(x, "jpg"), { type: "image/jpeg" })], text: text });
      }).then(function () { msg.textContent = "Pick X in the share menu, then press Post."; },
              function () { window.open("https://x.com/intent/post?text=" + encodeURIComponent(text), "_blank", "noopener"); });
      return;
    }
    window.open("https://x.com/intent/post?text=" + encodeURIComponent(text), "_blank", "noopener");
    pictureBlob("image/jpeg").then(function (b) { download(b, fileName(x, "jpg")); });
    msg.textContent = "X is open in a new tab with the caption. The picture just downloaded; add it with the picture button in X, then press Post.";
    msg.classList.add("is-ok");
  }

  function shareTikTok() {
    var x = current(), msg = $("sharemsg");
    msg.className = "ad-msg";
    if (!x) { msg.textContent = "Pick a trip first."; return; }
    var text = $("caption").value;
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {});
    var ready = video && video.key === videoKey(x);
    if (phone() && canShareFile(ready ? video.type : "video/mp4")) {
      if (!ready) {
        msg.textContent = "Making the video first (about 15 seconds). Then tap Post on TikTok again.";
        makeVideo().then(function () { msg.textContent = "Video ready. Tap Post on TikTok again to send it to the TikTok app."; }, function () {});
        return;
      }
      navigator.share({ files: [new File([video.blob], fileName(x, video.ext), { type: video.type })], text: text })
        .then(function () { msg.textContent = "Pick TikTok in the share menu. The caption is copied; paste it in TikTok."; msg.classList.add("is-ok"); },
              function () {});
      return;
    }
    window.open("https://www.tiktok.com/tiktokstudio/upload", "_blank", "noopener");
    msg.textContent = ready ? "" : "Making the video (about 15 seconds)…";
    (ready ? Promise.resolve(video) : makeVideo()).then(function (v) {
      download(v.blob, fileName(x, v.ext));
      msg.textContent = "TikTok is open in a new tab. The video downloaded and the caption is copied: upload the video there and paste the caption.";
      msg.classList.add("is-ok");
    }, function () {});
  }

  function graph(path, params, method) {
    var token = read("eve.fbtoken");
    if (method === "POST") {
      var fd = params instanceof FormData ? params : new FormData();
      if (!(params instanceof FormData)) Object.keys(params || {}).forEach(function (k) { fd.append(k, params[k]); });
      fd.append("access_token", token);
      return fetch(GRAPH + path, { method: "POST", body: fd }).then(unwrap);
    }
    var q = Object.keys(params || {}).map(function (k) { return k + "=" + encodeURIComponent(params[k]); });
    q.push("access_token=" + encodeURIComponent(token));
    return fetch(GRAPH + path + "?" + q.join("&")).then(unwrap);
  }
  function unwrap(r) {
    return r.json().then(function (j) { if (j.error) throw new Error(j.error.message); return j; });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // Instagram needs the picture at a public web address, so it is first put on
  // the Facebook page (as the post itself, or hidden if only Instagram is
  // ticked) and Instagram takes it from there.
  function photoUrl(photoId) {
    return graph(encodeURIComponent(photoId), { fields: "images" }).then(function (j) {
      var img = (j.images || []).sort(function (a, b) { return b.width - a.width; })[0];
      if (!img) throw new Error("Facebook did not return the picture");
      return img.source;
    });
  }

  function postInstagram(url, text) {
    var ig = read("eve.igid");
    return graph(encodeURIComponent(ig) + "/media", { image_url: url, caption: text }, "POST")
      .then(function (c) {
        var tries = 0;
        function check() {
          return graph(encodeURIComponent(c.id), { fields: "status_code" }).then(function (s) {
            if (s.status_code === "FINISHED") return c.id;
            if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error("Instagram could not use the picture");
            if (++tries > 15) throw new Error("Instagram is taking too long; try again in a minute");
            return wait(2000).then(check);
          });
        }
        return check();
      })
      .then(function (id) { return graph(encodeURIComponent(ig) + "/media_publish", { creation_id: id }, "POST"); })
      .then(function (m) {
        return graph(encodeURIComponent(m.id), { fields: "permalink" }).catch(function () { return {}; });
      });
  }

  function link(text, href) {
    var a = el("a", null, text);
    a.href = href; a.target = "_blank"; a.rel = "noopener";
    return a;
  }

  function postSocial() {
    var msg = $("fbmsg");
    msg.className = "ad-msg";
    msg.textContent = "";
    function bad(t) { msg.textContent = t; msg.classList.add("is-bad"); }
    var x = current();
    if (!x) return bad("Pick a trip first.");
    var hasFb = !!(read("eve.fbpage") && read("eve.fbtoken"));
    var toFb = $("to-fb").checked && hasFb, toIg = $("to-ig").checked && !!read("eve.igid") && hasFb;
    var toYt = $("to-yt").checked && !!read("eve.ytclient");
    if ($("to-fb").checked && !hasFb) return bad("Connect the Facebook page in Settings first, or untick Facebook.");
    if (!toFb && !toIg && !toYt) return bad("Tick at least one place to post to.");
    var later = document.querySelector("input[name=when]:checked").value === "later";
    var when = null;
    if (later) {
      if (toIg) return bad("Instagram posts go up straight away. Untick Instagram to schedule, or choose Post now.");
      var v = $("schedat").value ? new Date($("schedat").value) : null;
      var mins = v ? (v - new Date()) / 60000 : 0;
      if (!v || mins < 10 || mins > 60 * 24 * 30) return bad("Pick a time between 10 minutes and 30 days from now.");
      when = Math.floor(v.getTime() / 1000);
    }

    var text = $("caption").value, btn = $("fbpost"), done = [], fails = [];
    var ytAuth = toYt ? ytToken() : Promise.resolve(null);   // asks Google now, while the click counts
    btn.disabled = true;
    msg.textContent = "Posting…";

    var chain = Promise.resolve();
    if (toFb || toIg) {
      chain = pictureBlob("image/jpeg").then(function (blob) {
        var fd = new FormData();
        fd.append("source", blob, fileName(x, "jpg"));
        if (toFb) {
          fd.append("caption", text);
          if (when) { fd.append("published", "false"); fd.append("scheduled_publish_time", String(when)); }
        } else {
          fd.append("published", "false");
          fd.append("temporary", "true");
        }
        return graph(encodeURIComponent(read("eve.fbpage")) + "/photos", fd, "POST").then(function (j) {
          if (toFb) done.push(when ? ["Facebook: scheduled for " + new Date(when * 1000).toLocaleString()]
                                   : ["Facebook: posted", j.post_id ? "https://www.facebook.com/" + j.post_id : ""]);
          return j.id;
        }, function (e) { fails.push("Facebook said: " + e.message); throw e; });
      }).then(function (photoId) {
        if (!toIg) return;
        msg.textContent = "Posting to Instagram…";
        return photoUrl(photoId)
          .then(function (url) { return postInstagram(url, text); })
          .then(function (m) { done.push(["Instagram: posted", m.permalink || ""]); },
                function (e) { fails.push("Instagram said: " + e.message); });
      }).catch(function () {});
    }
    if (toYt) {
      chain = chain.then(function () {
        return ytAuth.then(function () {
          msg.textContent = "Making the YouTube video…";
          return makeVideo();
        }).then(function (v) {
          msg.textContent = "Uploading to YouTube…";
          return uploadShort(v, x, text, when);
        }).then(function (j) {
          done.push([when ? "YouTube: scheduled for " + new Date(when * 1000).toLocaleString() : "YouTube Shorts: posted",
                     j.id ? "https://www.youtube.com/shorts/" + j.id : ""]);
        }, function (e) { fails.push("YouTube said: " + (e.message || e)); });
      });
    }
    chain.then(function () {
      msg.textContent = "";
      done.forEach(function (d) {
        var line = el("span", null, d[0] + ". ");
        if (d[1]) line.appendChild(link("Open it", d[1]));
        msg.appendChild(line);
        msg.appendChild(el("br"));
      });
      fails.forEach(function (f) { msg.appendChild(el("span", null, f + " ")); msg.appendChild(el("br")); });
      if (fails.length) msg.appendChild(el("span", null, "If it mentions a token, sign-in or permission, reconnect in Settings."));
      msg.classList.add(fails.length ? "is-bad" : "is-ok");
      btn.disabled = false;
    });
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

  function igState() {
    var s = $("igstate"), ok = !!read("eve.igid");
    s.textContent = ok ? "Connected: " + read("eve.igname") : (read("eve.fbtoken") ? "Not linked to the page" : "Not connected");
    s.classList.toggle("is-ok", ok);
    $("to-ig").disabled = !ok;
    $("to-ig").checked = ok;
    $("ignote").hidden = ok;
  }

  function connectFacebook() {
    var page = $("fbpage").value.trim(), token = $("fbtoken").value.trim();
    if (!page || !token) { toast("Fill in both the page ID and the token."); return; }
    fbState(false, "Checking…");
    fetch(GRAPH + encodeURIComponent(page) + "?fields=name,instagram_business_account%7Bid,username%7D&access_token=" + encodeURIComponent(token))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.error) throw new Error(j.error.message);
        store("eve.fbpage", page); store("eve.fbtoken", token);
        $("fbtoken").value = "";
        fbState(true, "Connected: " + (j.name || page));
        store("eve.fbname", j.name || page);
        var ig = j.instagram_business_account;
        store("eve.igid", ig ? ig.id : null);
        store("eve.igname", ig ? "@" + (ig.username || ig.id) : null);
        igState();
        toast(ig ? "Facebook and Instagram connected." : "Facebook connected. No Instagram account is linked to this page yet.");
      })
      .catch(function (e) { fbState(false, "Didn't work"); toast("Facebook said: " + e.message); });
  }

  /* ---------------- password lock ----------------
     The page stays hidden until the password matches the hash in
     assets/data/admin.json. Saving and posting still need the keys kept on
     this device, so the lock keeps visitors out of the screens while the
     keys keep them from changing anything.                                */
  var ADMIN_FILE = "assets/data/admin.json";
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  function unhex(h) { var a = new Uint8Array(h.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
  function derive(pw, salt, iter) {
    return crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"])
      .then(function (k) { return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(salt), iterations: iter }, k, 256); })
      .then(hex);
  }
  function readSession(k) { try { return sessionStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function writeSession(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} }

  function gate(start) {
    var form = $("lockform"), msg = $("lockmsg"), started = false;
    function open() {
      document.body.classList.remove("is-locked");
      if (!started) { started = true; start(); }
    }
    fetch(ADMIN_FILE + "?v=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (cfg) {
      var saved = readSession("eve.unlock") || read("eve.unlock");
      if (saved && saved === cfg.hash) return open();
      $("lockpw").focus();
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        msg.className = "ad-msg"; msg.textContent = "Checking…";
        $("lockbtn").disabled = true;
        derive($("lockpw").value, cfg.salt, cfg.iter).then(function (h) {
          $("lockbtn").disabled = false;
          if (h !== cfg.hash) { msg.textContent = "That password is not right."; msg.classList.add("is-bad"); $("lockpw").select(); return; }
          writeSession("eve.unlock", h);
          if ($("lockremember").checked) store("eve.unlock", h);
          $("lockpw").value = ""; msg.textContent = "";
          open();
        });
      });
    }).catch(function () {
      msg.textContent = "Couldn't check the password right now. Refresh the page.";
      msg.classList.add("is-bad");
    });
  }

  function changePassword() {
    var a = $("pwnew").value, b = $("pwnew2").value;
    if (a.length < 8) { toast("Use at least 8 characters."); return; }
    if (a !== b) { toast("The two passwords don't match."); return; }
    if (!read("eve.ghkey")) { toast("Connect the website key first; the password is saved to the website."); return; }
    var salt = hex(crypto.getRandomValues(new Uint8Array(16))), iter = 150000;
    derive(a, salt, iter).then(function (h) {
      var body = JSON.stringify({ salt: salt, iter: iter, hash: h }, null, 2) + "\n";
      var url = "/repos/" + REPO.owner + "/" + REPO.name + "/contents/" + ADMIN_FILE;
      return gh("GET", url + "?ref=" + REPO.branch).then(function (j) { return j.sha; }, function () { return null; })
        .then(function (cur) {
          var req = { message: "Back office: change password", content: b64enc(body), branch: REPO.branch };
          if (cur) req.sha = cur;
          return gh("PUT", url, req);
        }).then(function () {
          writeSession("eve.unlock", h);
          if (read("eve.unlock")) store("eve.unlock", h);
          $("pwnew").value = ""; $("pwnew2").value = "";
          toast("Password changed. It works everywhere in about a minute.");
        });
    }).catch(function (e) { toast("Password not changed: " + e.message); });
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
  $("floatsave").addEventListener("click", save);
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
  $("fbpost").addEventListener("click", postSocial);
  $("pwsave").addEventListener("click", changePassword);
  $("lockout").addEventListener("click", function () {
    if (dirty && !window.confirm("You have changes that are not saved. Lock anyway?")) return;
    dirty = false; writeSession("eve.unlock", null); store("eve.unlock", null); location.reload();
  });
  $("mkvid").addEventListener("click", function () { makeVideo().catch(function () {}); });
  $("dlvid").addEventListener("click", function () { if (video) download(video.blob, fileName(current(), video.ext)); });
  $("xshare").addEventListener("click", shareX);
  $("ttshare").addEventListener("click", shareTikTok);
  $("xcap").addEventListener("input", countX);
  $("ytsave").addEventListener("click", connectYouTube);
  $("ytforget").addEventListener("click", function () {
    ["eve.ytclient", "eve.ytname"].forEach(function (k) { store(k, null); });
    ytTok = null; ytClient = null; ytState(); toast("YouTube removed from this device.");
  });
  $("ghsave").addEventListener("click", connectGitHub);
  $("ghforget").addEventListener("click", function () { store("eve.ghkey", null); ghState(false); setSaveState(); toast("Website key removed from this device."); });
  $("fbsave").addEventListener("click", connectFacebook);
  $("fbforget").addEventListener("click", function () {
    ["eve.fbpage", "eve.fbtoken", "eve.fbname", "eve.igid", "eve.igname"].forEach(function (k) { store(k, null); });
    fbState(false); igState(); toast("Facebook and Instagram removed from this device.");
  });
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  if (read("eve.ghkey")) ghState(true);
  if (read("eve.fbtoken")) { fbState(true, "Connected: " + (read("eve.fbname") || read("eve.fbpage"))); $("fbpage").value = read("eve.fbpage"); }
  igState();
  ytState();
  var sd = new Date(Date.now() + 60 * 60000); sd.setMinutes(0, 0, 0);
  $("schedat").value = iso(sd) + "T" + String(sd.getHours()).padStart(2, "0") + ":00";
  gate(load);
})();
