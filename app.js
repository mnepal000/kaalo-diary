/* कालो डायरी — app logic */
(function () {
  const STATUS_CLASS = {
    "विपक्षीको आरोप": "st-allegation",
    "समाचारमा आएको": "st-reported",
    "पुष्टि भएको": "st-confirmed",
    "छानबिनमा": "st-investigation",
    "खण्डन भएको": "st-rebutted"
  };

  const listEl = document.getElementById("entry-list");
  const noResultsEl = document.getElementById("no-results");
  const searchEl = document.getElementById("search");
  const catChipsEl = document.getElementById("cat-chips");
  const statusChipsEl = document.getElementById("status-chips");
  const modal = document.getElementById("modal");
  const modalBody = document.getElementById("modal-body");

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
    items.forEach(e => {
      const card = document.createElement("article");
      card.className = "entry";
      card.tabIndex = 0;
      card.innerHTML =
        '<div class="entry-top">' +
          '<span class="entry-date">🗓 ' + escapeHtml(e.dateBS) + " · " + escapeHtml(e.dateAD) + "</span>" +
          '<span class="tag cat-tag">' + escapeHtml(e.category) + "</span>" +
        "</div>" +
        "<h4>" + escapeHtml(e.title) + "</h4>" +
        "<p>" + escapeHtml(e.summary) + "</p>" +
        '<div class="entry-meta">' +
          '<span class="tag ' + (STATUS_CLASS[e.status] || "") + '">साक्ष्य: ' + escapeHtml(e.status) + "</span>" +
          '<span class="read-more">पूरा पढ्नुहोस् →</span>' +
        "</div>";
      card.addEventListener("click", () => openModal(e));
      card.addEventListener("keydown", ev => { if (ev.key === "Enter") openModal(e); });
      listEl.appendChild(card);
    });
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
    const tags = (e.tags || []).map(t => '<span class="tag">' + escapeHtml(t) + "</span>").join(" ");
    modalBody.innerHTML =
      '<span class="entry-date">🗓 ' + escapeHtml(e.dateBS) + " · " + escapeHtml(e.dateAD) + "</span>" +
      "<h3>" + escapeHtml(e.title) + "</h3>" +
      '<div class="entry-meta"><span class="tag cat-tag">' + escapeHtml(e.category) + "</span> " +
      '<span class="tag ' + (STATUS_CLASS[e.status] || "") + '">साक्ष्य-स्तर: ' + escapeHtml(e.status) + "</span></div>" +
      "<p>" + escapeHtml(e.details) + "</p>" +
      (tags ? '<div class="entry-meta">' + tags + "</div>" : "") +
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

  // --- events ---
  searchEl.addEventListener("input", render);

  // --- init ---
  refreshChips();
  render();
})();
