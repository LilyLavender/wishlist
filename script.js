const CATEGORIES = {
  music: "Music",
  clothes: "Clothes",
  fragrance: "Fragrance",
  tech: "Tech",
  collectibles: "Collectibles",
  snacks: "Snacks",
  giftcards: "Gift cards",
};

const RATINGS = {
  like: { label: "Like", icon: "bi-emoji-smile-fill" },
  ok: { label: "It's okay", icon: "bi-emoji-neutral-fill" },
  dislike: { label: "Don't like", icon: "bi-emoji-frown-fill" },
};

const state = {
  items: [],
  purchased: new Set(),
  justMarked: new Set(),
  search: "",
  category: "all",
  sort: "default",
};

const $ = id => document.getElementById(id);
const grid = $("grid");
const dialog = $("dialog");
let openItem = null;

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter(c => c != null && c !== false));
  return node;
}

function money(n) {
  return "$" + (Number.isInteger(n) ? n : n.toFixed(2));
}

function priceText(item) {
  if (item.price == null) return "";
  return item.price_max != null ? `${money(item.price)}–${money(item.price_max)}` : money(item.price);
}

function midPrice(item) {
  if (item.price == null) return null;
  return (item.price + (item.price_max ?? item.price)) / 2;
}

const isPurchased = item => !item.unlimited && state.purchased.has(item.id);

function priceTag(item) {
  return item.price != null ? [el("span", { className: "tag tag-price" }, priceText(item))] : [];
}

function title(item) {
  return [item.category === "music" && el("span", { className: "cd-tag" }, "CD"), item.name];
}

// Handle setting background color for cards with images
const bgCache = new Map();
function edgeColor(img) {
  const n = 24;
  const ctx = Object.assign(document.createElement("canvas"), { width: n, height: n }).getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, n, n);
  const data = ctx.getImageData(0, 0, n, n).data;
  const buckets = new Map();
  let total = 0;
  for (let i = 0; i < n; i++) {
    for (const [x, y] of [[i, 0], [i, n - 1], [0, i], [n - 1, i]]) {
      const o = (y * n + x) * 4;
      if (data[o + 3] < 200) continue;
      const px = [data[o], data[o + 1], data[o + 2]];
      const key = px.map(v => v >> 5).join();
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(px);
      total++;
    }
  }
  const top = [...buckets.values()].sort((a, b) => b.length - a.length)[0];
  if (!top || top.length < total * 0.6) return null;
  const avg = [0, 1, 2].map(k => Math.round(top.reduce((sum, px) => sum + px[k], 0) / top.length));
  return `rgb(${avg})`;
}

function matchBackground(item, img, box) {
  box.style.background = bgCache.get(item.id) || "";
  if (bgCache.has(item.id)) return;
  img.addEventListener("load", () => {
    if (!img.src.endsWith(item.image)) return;
    try { bgCache.set(item.id, edgeColor(img)); } catch { bgCache.set(item.id, null); }
    box.style.background = bgCache.get(item.id) || "";
  }, { once: true });
}

const entry = e => typeof e === "string" ? { name: e } : e;

function searchText(item) {
  const list = (item.list || []).map(e => entry(e).name);
  const tried = Object.values(item.tried || {}).flat().map(t => t.name);
  return [item.name, item.notes, ...list, ...tried].join(" ").toLowerCase();
}

function listRow(e) {
  const { name, note } = entry(e);
  return el("li", { className: "list-row" },
    el("span", { className: "list-marker" }),
    el("span", { className: "list-text" },
      el("span", { className: "list-name" }, name),
      note && el("span", { className: "list-note" }, note),
    ),
  );
}

function triedGroups(tried) {
  return Object.entries(RATINGS).filter(([key]) => tried[key]?.length).map(([key, r]) =>
    el("section", { className: "tried rated-" + key },
      el("h3", { className: "tried-title" }, el("i", { className: "bi " + r.icon }), " " + r.label),
      el("ul", { className: "tried-grid" },
        ...tried[key].map(t => el("li", { title: t.name },
          el("img", { src: t.image, alt: t.name, loading: "lazy" }),
        )),
      ),
    ),
  );
}

const linkText = url => /ebay\./.test(url) ? "Find on eBay" : "Go to store";

function visibleItems() {
  const q = state.search.trim().toLowerCase();
  const list = state.items.filter(item =>
    (!isPurchased(item) || state.justMarked.has(item.id)) &&
    (state.category === "all" || item.category === state.category) &&
    (!q || searchText(item).includes(q))
  );

  if (state.sort === "name") return list.sort((a, b) => a.name.localeCompare(b.name));
  if (state.sort.startsWith("price")) {
    const dir = state.sort === "price-asc" ? 1 : -1;
    return list.sort((a, b) => {
      const pa = midPrice(a), pb = midPrice(b);
      if (pa == null || pb == null) return (pa == null) - (pb == null);
      return (pa - pb) * dir;
    });
  }
  return list;
}

function card(item) {
  const img = el("img", { src: item.image, alt: "", loading: "lazy" });
  const media = el("span", { className: "card-media" }, img);
  matchBackground(item, img, media);
  const purchased = isPurchased(item);
  const btn = el("button", { className: "card" + (purchased ? " is-purchased" : "") + (item.catchall ? " is-catchall" : ""), type: "button" },
    media,
    el("span", { className: "card-body" },
      el("span", { className: "card-title" }, ...title(item)),
      el("span", { className: "tags" },
        ...priceTag(item),
        item.catchall && el("span", { className: "tag tag-list" }, el("i", { className: "bi bi-list-ul" }), " See list"),
        purchased && el("span", { className: "tag tag-purchased" }, el("i", { className: "bi bi-check2" }), " Purchased"),
      ),
    ),
  );
  btn.addEventListener("click", () => openDialog(item));
  return btn;
}

function render() {
  const items = visibleItems();
  grid.replaceChildren(...items.map(card));
  $("empty").hidden = items.length > 0;
}

function renderChips() {
  const chip = (label, active, onClick, extra = {}) => {
    const b = el("button", { type: "button", className: "chip" + (active ? " active" : ""), ...extra }, ...label);
    b.setAttribute("aria-pressed", active);
    b.addEventListener("click", onClick);
    return b;
  };
  const setCategory = key => () => { state.category = key; renderChips(); render(); };

  $("chips").replaceChildren(
    chip(["All"], state.category === "all", setCategory("all")),
    ...Object.entries(CATEGORIES).map(([key, label]) => chip([label], state.category === key, setCategory(key))),
  );
}

function renderPurchased() {
  const items = state.items.filter(isPurchased);
  $("purchased-list").replaceChildren(
    ...(items.length ? items.map(item => {
      const unmark = el("button", { type: "button", className: "btn btn-ghost btn-sm" }, el("i", { className: "bi bi-x-square" }), " Unmark");
      unmark.addEventListener("click", () => setPurchased(item, false));
      return el("li", { className: "purchased-row" },
        el("img", { src: item.image, alt: "", loading: "lazy" }),
        el("span", { className: "purchased-name" }, item.name),
        unmark,
      );
    }) : [el("li", { className: "purchased-empty" }, "Nothing purchased yet!")]),
  );
}

let galleryTimer = null, galleryFade = null;
function startGallery(images) {
  const img = $("dialog-img");
  images.forEach(src => { new Image().src = src; }); 
  let i = 0;
  galleryTimer = setInterval(() => {
    i = (i + 1) % images.length;
    img.classList.add("fading");
    galleryFade = setTimeout(() => {
      img.addEventListener("load", () => img.classList.remove("fading"), { once: true });
      img.src = images[i];
    }, 250);
  }, 1800);
}
function stopGallery() {
  clearInterval(galleryTimer);
  clearTimeout(galleryFade);
  $("dialog-img").classList.remove("fading");
}

function openDialog(item) {
  openItem = item;
  stopGallery();
  $("dialog-media").classList.toggle("is-catchall", !!item.catchall);
  if (item.images) {
    $("dialog-img").src = item.images[0];
    $("dialog-media").style.background = "";
    startGallery(item.images);
  } else {
    $("dialog-img").src = item.image;
    matchBackground(item, $("dialog-img"), $("dialog-media"));
  }
  $("dialog-list").replaceChildren(...(item.list || []).map(listRow));
  $("dialog-list").hidden = !item.list;
  $("dialog-tried").replaceChildren(
    el("p", { className: "tried-intro" }, "Ones I've already tried, so ", el("strong", {}, "no need"), " to get me samples of these:"),
    ...triedGroups(item.tried || {}),
  );
  $("dialog-tried").hidden = !item.tried;
  $("dialog-category").textContent = CATEGORIES[item.category];
  $("dialog-title").replaceChildren(...title(item).filter(Boolean).map(t => typeof t === "string" ? t.replace(/\s*\(read description\)/i, "") : t));
  $("dialog-tags").replaceChildren(...priceTag(item));
  $("dialog-notes").textContent = item.notes;
  $("dialog-notes").hidden = !item.notes;
  $("dialog-link").hidden = !item.url;
  if (item.url) {
    $("dialog-link").href = item.url;
    $("dialog-link").replaceChildren(linkText(item.url) + " ", el("i", { className: "bi bi-box-arrow-up-right" }));
  }
  const purchased = isPurchased(item);
  $("dialog-mark").hidden = item.unlimited;
  $("dialog-mark").replaceChildren(
    el("i", { className: purchased ? "bi bi-x-square" : "bi bi-check2-square" }),
    purchased ? " Unmark as Purchased" : " Mark as Purchased",
  );
  dialog.showModal();
}

async function getIp() {
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(4000) });
    return (await res.json()).ip;
  } catch {
    return "unknown";
  }
}

async function logHistory(item, purchased) {
  try {
    await db.collection("purchase_history").add({
      item: item.id,
      name: item.name,
      action: purchased ? "marked" : "unmarked",
      ip: await getIp(),
      at: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("Couldn't save purchase history", err);
  }
}

async function setPurchased(item, purchased) {
  const verb = purchased ? "Mark" : "Unmark";
  if (!confirm(`${verb} "${item.name}" as purchased?`)) return false;
  try {
    await db.collection("purchases").doc(item.id).set({
      purchased,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error(err);
    alert(`Couldn't ${verb.toLowerCase()} that. Please try again.`);
    return false;
  }
  logHistory(item, purchased);
  if (purchased) {
    state.purchased.add(item.id);
    state.justMarked.add(item.id);
  } else {
    state.purchased.delete(item.id);
  }
  render();
  renderPurchased();
  return true;
}

async function loadPurchased() {
  const snapshot = await db.collection("purchases").get();
  state.purchased = new Set(snapshot.docs.filter(d => d.data().purchased).map(d => d.id));
}

$("search").addEventListener("input", e => { state.search = e.target.value; render(); });
$("sort").addEventListener("change", e => { state.sort = e.target.value; render(); });

$("dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", stopGallery);
dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
$("dialog-mark").addEventListener("click", async () => {
  if (await setPurchased(openItem, !isPurchased(openItem))) dialog.close();
});

$("purchased-toggle").addEventListener("click", async e => {
  const section = $("purchased");
  const opening = section.hidden;
  e.currentTarget.setAttribute("aria-expanded", opening);
  if (opening) {
    await loadPurchased().catch(console.error);
    render();
    renderPurchased();
  }
  section.hidden = !opening;
});

// Init
Promise.all([
  fetch("wishlist.json").then(r => r.json()),
  loadPurchased().catch(err => console.error("Couldn't load purchases", err)),
]).then(([items]) => {
  state.items = items;
  $("empty").textContent = "Nothing matches that. Try a different search or filter.";
  renderChips();
  render();
}).catch(err => {
  console.error(err);
  $("empty").textContent = "Couldn't load the wishlist. Try refreshing.";
  $("empty").hidden = false;
});
