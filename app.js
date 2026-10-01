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
    "परराष्ट्र / राष्ट्रियता": "#5f2e8a"
  };

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

  // --- stats ---
  const cats = [...new Set(ENTRIES.map(e => e.category))];
  const srcCount = ENTRIES.reduce((n, e) => n + (e.sources ? e.sources.length : 0), 0);
  document.getElementById("stat-total").textContent = ENTRIES.length;
  document.getElementById("stat-cats").textContent = cats.length;
  document.getElementById("stat-sources").textContent = srcCount;

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
    buildChips(catChipsEl, ["सबै", ...cats], () => activeCat, v => activeCat = v);
    const statuses = [...new Set(ENTRIES.map(e => e.status))];
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
    const items = ENTRIES.filter(matches);
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
      '<div class="entry-meta"><span class="tag ' + (STATUS_CLASS[e.status] || "") + '">साक्ष्य-स्तर: ' + escapeHtml(e.status) + "</span></div>" +
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
  refreshChips();
  render();
})();
