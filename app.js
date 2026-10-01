/* कालो डायरी — app logic */
(function () {
  const STATUS_CLASS = {
    "विपक्षीको आरोप": "st-allegation",
    "समाचारमा आएको": "st-reported",
    "पुष्टि भएको": "st-confirmed",
    "छानबिनमा": "st-investigation",
    "खण्डन भएको": "st-rebutted"
  };
  const CAT_COLORS = {
    "संसदीय मर्यादा": "#2e5f8a",
    "कानुनी शासन": "#8a5a17",
    "सुशासन": "#3f7a3a",
    "मानवअधिकार": "#8a2e5f",
    "परराष्ट्र / राष्ट्रियता": "#5f2e8a",
    "मन्त्रिमण्डल": "#b0653a",
    "अभिव्यक्ति स्वतन्त्रता": "#3f7a6b",
    "न्यायपालिका": "#6a5a8a"
  };

  /* Google Sheets / Form एकीकरण:
     - SHEET_CSV_URL: Responses ट्याबको publish-to-web CSV लिङ्क (सेटअप: GOOGLE_SHEETS_SETUP.md हेर्नुहोस्)
     - TIP_FORM_URL: टिप सङ्कलन गर्ने Google Form को लिङ्क
     दुवै खाली छाडेमा साइट data.js का प्रविष्टिबाट मात्र चल्छ। */
  const SHEET_CSV_URL = "";
  const TIP_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSeS6nOJSoQiZzhKWm8R2wO2Q9MroRTWBAokT_g24TKdrguzLg/viewform?usp=publish-editor";

  // Sheet का हेडर (नेपाली वा English) → प्रविष्टि फिल्ड
  const SHEET_FIELDS = {
    title: ["घटनाको शीर्षक", "title"],
    dateBS: ["मिति (वि.सं", "dateBS"],
    dateAD: ["मिति (ई.सं", "dateAD"],
    category: ["श्रेणी", "category"],
    summary: ["छोटो सारांश", "summary"],
    details: ["पूरा विवरण", "details"],
    status: ["साक्ष्य-स्तर", "status"],
    sourceLabel: ["स्रोतको नाम", "sourceLabel"],
    sourceUrl: ["स्रोतको लिङ्क", "sourceUrl"],
    tags: ["ट्यागहरू", "tags"]
  };
  const APPROVED_VALUES = ["हो", "होस्", "हुन्छ", "yes", "y", "ok"]; // "स्वीकृत" स्तम्भका मान्य मान

  const listEl = document.getElementById("entry-list");
  const noResultsEl = document.getElementById("no-results");
  const searchEl = document.getElementById("search");
  const catChipsEl = document.getElementById("cat-chips");
  const statusChipsEl = document.getElementById("status-chips");
  const modal = document.getElementById("modal");
  const modalBody = document.getElementById("modal-body");
  const diary = document.getElementById("diary");
  const hero = document.querySelector(".hero");

  let activeCat = "सबै";
  let activeStatus = "सबै";
  let ALL = []; // sheet entries (newest first) + ENTRIES

  // --- Google Sheet CSV parser (RFC4180-style: quoted fields, commas, newlines) ---
  function parseCSV(text) {
    const rows = [];
    let row = [], field = "", inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQ = false;
        } else field += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ""; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c !== '\r') field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(f => f.trim() !== ""));
  }

  function findCol(head, candidates) {
    for (const c of candidates) {
      const i = head.findIndex(h => h === c || h.indexOf(c) === 0);
      if (i >= 0) return i;
    }
    return -1;
  }

  async function loadSheetEntries() {
    if (!SHEET_CSV_URL) return [];
    try {
      const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
      if (!res.ok) return [];
      const rows = parseCSV(await res.text());
      if (rows.length < 2) return [];
      const head = rows[0].map(h => h.trim());
      const col = {};
      for (const k in SHEET_FIELDS) col[k] = findCol(head, SHEET_FIELDS[k]);
      const modIdx = findCol(head, ["स्वीकृत", "approved"]);
      if (modIdx < 0) {
        console.warn('Sheet मा "स्वीकृत" स्तम्भ भेटिएन; कुनै टिप प्रकाशन गरिएन।');
        return [];
      }
      const g = (r, k) => (col[k] >= 0 ? (r[col[k]] || "").trim() : "");
      return rows.slice(1).map((r, i) => {
        const approved = (r[modIdx] || "").trim().toLowerCase();
        if (!APPROVED_VALUES.includes(approved)) return null;
        const title = g(r, "title");
        if (!title) return null;
        const srcUrl = g(r, "sourceUrl"), srcLabel = g(r, "sourceLabel");
        const status = g(r, "status");
        return {
          id: "sheet-" + (i + 1),
          dateBS: g(r, "dateBS") || "मिति नखुलेको",
          dateAD: g(r, "dateAD") || "",
          title: title,
          category: g(r, "category") || "सुशासन",
          status: STATUS_CLASS[status] ? status : "समाचारमा आएको",
          summary: g(r, "summary") || "",
          details: g(r, "details") || g(r, "summary") || "",
          sources: srcUrl ? [{ label: srcLabel || "स्रोत", url: srcUrl }] : [],
          tags: g(r, "tags").split(/[,;]/).map(t => t.trim()).filter(Boolean),
          origin: "पाठक टिप"
        };
      }).filter(Boolean);
    } catch (err) {
      console.warn("Sheet बाट प्रविष्टि लोड हुन सकेन:", err);
      return [];
    }
  }

  // --- stats ---
  function renderStats() {
    const cats = [...new Set(ALL.map(e => e.category))];
    const srcCount = ALL.reduce((n, e) => n + (e.sources ? e.sources.length : 0), 0);
    document.getElementById("stat-total").textContent = ALL.length;
    document.getElementById("stat-cats").textContent = cats.length;
    document.getElementById("stat-sources").textContent = srcCount;
  }

  // --- chips ---
  function buildChips(el, items, getActive, setActive) {
    el.innerHTML = "";
    items.forEach(item => {
      const b = document.createElement("button");
      b.className = "chip" + (getActive() === item ? " active" : "");
      b.textContent = item;
      b.addEventListener("click", () => { setActive(item); buildChips(el, items, getActive, setActive); render(); });
      el.appendChild(b);
    });
  }
  function refreshChips() {
    const cats = [...new Set(ALL.map(e => e.category))];
    buildChips(catChipsEl, ["सबै", ...cats], () => activeCat, v => activeCat = v);
    const statuses = [...new Set(ALL.map(e => e.status))];
    buildChips(statusChipsEl, ["सबै", ...statuses], () => activeStatus, v => activeStatus = v);
  }

  // --- unfold-on-scroll observer ---
  const unfoldIO = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add("unfolded");
        unfoldIO.unobserve(en.target);
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });

  // --- render ---
  function matches(e) {
    const q = searchEl.value.trim();
    if (activeCat !== "सबै" && e.category !== activeCat) return false;
    if (activeStatus !== "सबै" && e.status !== activeStatus) return false;
    if (q) {
      const hay = (e.title + " " + e.summary + " " + e.details + " " + (e.tags || []).join(" ")).toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }

  function render() {
    const items = ALL.filter(matches);
    listEl.innerHTML = "";
    noResultsEl.classList.toggle("hidden", items.length > 0);
    items.forEach((e, i) => {
      const card = document.createElement("article");
      card.className = "page";
      card.tabIndex = 0;
      card.style.transitionDelay = ((i % 3) * 90) + "ms";
      const tabColor = CAT_COLORS[e.category] || "#555";
      card.innerHTML =
        '<span class="page-tab" style="background:' + tabColor + '">' + escapeHtml(e.category) + "</span>" +
        '<div class="page-head">' +
          '<span class="page-date">' + escapeHtml(e.dateBS) + "</span>" +
          '<span class="page-no">पाना ' + toDevDigits(i + 1) + "</span>" +
        "</div>" +
        "<h4>" + escapeHtml(e.title) + "</h4>" +
        "<p>" + escapeHtml(e.summary) + "</p>" +
        '<div class="entry-meta">' +
          '<span class="tag ' + (STATUS_CLASS[e.status] || "") + '">साक्ष्य: ' + escapeHtml(e.status) + "</span>" +
          (e.origin ? '<span class="tag origin">' + escapeHtml(e.origin) + "</span>" : "") +
          '<span class="read-more">पूरा पढ्नुहोस् &rarr;</span>' +
        "</div>";
      card.addEventListener("click", () => openModal(e));
      card.addEventListener("keydown", ev => { if (ev.key === "Enter") openModal(e); });
      listEl.appendChild(card);
      unfoldIO.observe(card);
    });
  }

  function toDevDigits(n) {
    return String(n).replace(/\d/g, d => "०१२३४५६७८९"[d]);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  // --- modal ---
  function openModal(e) {
    const srcList = (e.sources || []).map(s =>
      '<li><a href="' + escapeHtml(s.url) + '" target="_blank" rel="noopener">' + escapeHtml(s.label) + "</a></li>"
    ).join("");
    modalBody.innerHTML =
      '<span class="page-date">' + escapeHtml(e.dateBS) + " · " + escapeHtml(e.dateAD) + "</span>" +
      "<h3>" + escapeHtml(e.title) + "</h3>" +
      '<div class="entry-meta"><span class="tag ' + (STATUS_CLASS[e.status] || "") + '">साक्ष्य-स्तर: ' + escapeHtml(e.status) + "</span>" +
      (e.origin ? '<span class="tag origin">' + escapeHtml(e.origin) + "</span>" : "") + "</div>" +
      "<p>" + escapeHtml(e.details) + "</p>" +
      (srcList ? '<div class="sources"><strong>स्रोतहरू:</strong><ul>' + srcList + "</ul></div>" : "") +
      '<div class="disclaimer-box">यो प्रविष्टि नागरिक दस्तावेजीकरण हो। &lsquo;' + escapeHtml(e.status) +
      '&rsquo; स्थिति भएको दाबी प्रमाणित तथ्य होइन; सम्बन्धित पक्षको धारणा वा खण्डन भएमा यहाँ थपिनेछ।</div>';
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
  }
  document.getElementById("modal-close").addEventListener("click", closeModal);
  modal.addEventListener("click", ev => { if (ev.target === modal) closeModal(); });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape") closeModal(); });

  // --- diary opens as you scroll past the hero ---
  function syncDiary() {
    if (!diary || !hero) return;
    const r = hero.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / (r.height * 0.75)));
    diary.style.setProperty("--open", p.toFixed(3));
  }
  window.addEventListener("scroll", syncDiary, { passive: true });
  syncDiary();

  // --- events ---
  searchEl.addEventListener("input", render);

  // --- init ---
  async function init() {
    if (TIP_FORM_URL) {
      const btn = document.getElementById("tip-form-btn");
      if (btn) { btn.href = TIP_FORM_URL; btn.classList.remove("hidden"); }
    }
    const sheetEntries = await loadSheetEntries();
    ALL = [...sheetEntries, ...ENTRIES];
    renderStats();
    refreshChips();
    render();
  }
  init();
})();
