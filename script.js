$(document).ready(function() {
  const $container = $("#wishlist-container");
  const $cdTab = $("#cd-tab");
  const $vinylTab = $("#vinyl-tab");
  const $purchasedTab = $("#purchased-tab");
  const $aboutTab = $("#about-tab");
  const $aboutSection = $("#about-section");
  const $sortSelect = $("#sort-select");

  let wishlist = { cd: [], vinyl: [] };
  let purchasedIds = new Set();
  let currentView = "about";

  function loadJsonFiles(callback) {
    let cdLoaded = false, vinylLoaded = false;

    $.getJSON("wishlist-cd.json", data => { wishlist.cd = data; cdLoaded = true; if(cdLoaded && vinylLoaded) callback(); })
      .fail(() => console.error("Failed to load wishlist-cd.json"));

    $.getJSON("wishlist-vinyl.json", data => { wishlist.vinyl = data; vinylLoaded = true; if(cdLoaded && vinylLoaded) callback(); })
      .fail(() => console.error("Failed to load wishlist-vinyl.json"));
  }

  function loadPurchasedIds(callback) {
    db.collection("purchases").get().then(snapshot => {
      purchasedIds.clear();
      snapshot.forEach(doc => {
        if(doc.data().purchased) purchasedIds.add(doc.id);
      });
      if(callback) callback();
    });
  }

  function sortItems(items) {
    const sortBy = $sortSelect.val();

    switch (sortBy) {
      case "price":
        return [...items].sort((a, b) => {
          const avgA = ((a.expected_cost_min ?? 0) + (a.expected_cost_max ?? 0)) / 2;
          const avgB = ((b.expected_cost_min ?? 0) + (b.expected_cost_max ?? 0)) / 2;
        
          if (avgA === 0 && avgB !== 0) return 1;
          if (avgB === 0 && avgA !== 0) return -1;
        
          return avgA - avgB;
        });
      case "year":
        return [...items].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
      case "genre":
        return [...items].sort((a, b) => (a.genre || "").localeCompare(b.genre || ""));
      case "artist":
        return [...items].sort((a, b) => (a.artist || "").localeCompare(b.artist || ""));
      default:
        return items;
    }
  }

  function renderItems(items, showUnmark = false) {
    $container.empty();
    const sortedItems = sortItems(items);

    sortedItems.forEach(album => {
      const format = album.format || "";
      const albumId = `${album.master_id}-${format.toLowerCase()}`;
      const isPurchased = purchasedIds.has(albumId);

      if(isPurchased && !showUnmark) return;

      const yearHtml = album.year ? `${album.year} • ` : "";
      const genreHtml = album.genre ? `${album.genre}` : "";
      const priceHtml =
        album.expected_cost_min !== undefined && album.expected_cost_max !== undefined
          ? ` • $${album.expected_cost_min} - $${album.expected_cost_max}`
          : "";

      const notesHtml = album.notes
        ? `<p class="notes"><i class="bi bi-exclamation-triangle"></i><span>${album.notes}</span></p>`
        : "";

      const artistClean = album.artist.replace(/["'\/]/g, "");
      const albumClean = album.album.replace(/["'\/]/g, "");
      const encodedURI = encodeURIComponent(`${artistClean} ${albumClean} ${format}`);

      const amazonHtml = album.not_on_amazon
        ? ""
        : `<a href="https://www.amazon.com/s?k=${encodedURI}" target="_blank">
            <img src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" alt="Amazon">
           </a>`;

      const ebayHtml = album.not_on_ebay
        ? ""
        : `<a href="https://www.ebay.com/sch/i.html?_nkw=${encodedURI}" target="_blank">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/EBay_logo.svg/1200px-EBay_logo.svg.png" alt="Ebay">
           </a>`;

      const discogsLink = album.no_master
        ? `<a href="https://www.discogs.com/sell/release/${album.master_id}?ships_from=United+States&sort=price%2Casc" target="_blank">
             <img src="https://upload.wikimedia.org/wikipedia/commons/c/ce/Discogs_logo_black.svg" alt="Discogs">
           </a>`
        : `<a href="https://www.discogs.com/sell/list?master_id=${album.master_id}&sort=price%2Casc&limit=100&ships_from=United+States&format=${format}" target="_blank">
             <img src="https://upload.wikimedia.org/wikipedia/commons/c/ce/Discogs_logo_black.svg" alt="Discogs">
           </a>`;

      const btnHtml = showUnmark
        ? `<button class="mark-btn unmark-purchased-btn"><i class="bi bi-x-square"></i><span>Unmark as Purchased</span></button>`
        : !isPurchased
        ? `<button class="mark-btn mark-purchased-btn"><i class="bi bi-check-square"></i><span>Mark as Purchased</span></button>`
        : "";

      const purchasedStatus = isPurchased ? "✅ Purchased" : "";

      const albumHtml = `
        <div class="album-card" data-id="${albumId}">
          <img src="${album.cover_url}" alt="${album.album} cover">
          <div class="album-info">
            <h2>${album.album}</h2>
            <h3>${album.artist}</h3>
            <p class="basic-info">${yearHtml}${genreHtml}${priceHtml}</p>
            <p>Buy on...</p>
            <div class="buy-on">
              ${discogsLink}
              ${amazonHtml}
              ${ebayHtml}
            </div>
            ${notesHtml}
            ${btnHtml}
            <p class="purchase-status">${purchasedStatus}</p>
          </div>
        </div>
      `;
      $container.append(albumHtml);
    });
  }

  function showCD() {
    currentView = "cd";
    $cdTab.addClass("active");
    $vinylTab.removeClass("active");
    $purchasedTab.removeClass("active");
    $aboutTab.removeClass("active");

    $aboutSection.addClass("hidden");
    $("#controls").show();

    renderItems(wishlist.cd.map(a => ({ ...a, format: "CD" })));
  }

  function showVinyl() {
    currentView = "vinyl";
    $vinylTab.addClass("active");
    $cdTab.removeClass("active");
    $purchasedTab.removeClass("active");
    $aboutTab.removeClass("active");

    $aboutSection.addClass("hidden");
    $("#controls").show();

    renderItems(wishlist.vinyl.map(a => ({ ...a, format: "Vinyl" })));
  }

  function showPurchased() {
    currentView = "purchased";
    $purchasedTab.addClass("active");
    $cdTab.removeClass("active");
    $vinylTab.removeClass("active");
    $aboutTab.removeClass("active");

    $aboutSection.addClass("hidden");
    $("#controls").show();

    const allItems = [
      ...wishlist.cd.map(a => ({ ...a, format: "CD" })),
      ...wishlist.vinyl.map(a => ({ ...a, format: "Vinyl" })),
    ];
    const purchasedItems = allItems.filter(a =>
      purchasedIds.has(`${a.master_id}-${a.format.toLowerCase()}`)
    );

    if (purchasedItems.length === 0) {
      $container.html('<p id="empty-message">Nothing purchased yet!</p>');
    } else {
      renderItems(purchasedItems, true);
    }
  }

  function showAbout() {
    currentView = "about";
    $aboutTab.addClass("active");
    $cdTab.removeClass("active");
    $vinylTab.removeClass("active");
    $purchasedTab.removeClass("active");

    $aboutSection.removeClass("hidden");
    $container.empty();
    $("#controls").hide();
  }

  $cdTab.on("click", () => showCD());
  $vinylTab.on("click", () => showVinyl());
  $purchasedTab.on("click", () => loadPurchasedIds(showPurchased));
  $aboutTab.on("click", () => showAbout());

  $sortSelect.on("change", () => {
    if (currentView === "cd") showCD();
    else if (currentView === "vinyl") showVinyl();
    else if (currentView === "purchased") showPurchased();
  });

  $container.on("click", ".mark-purchased-btn", function() {
    const $card = $(this).closest(".album-card");
    const albumId = $card.data("id");
    const albumName = $card.find("h2").text();

    if (!confirm(`Mark "${albumName}" as purchased?`)) {
      return;
    }

    db.collection("purchases").doc(albumId).set({
      purchased: true,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    }).then(() => {
      purchasedIds.add(albumId);
      $card.find(".purchase-status").text("✅ Purchased");
      $card.find(".mark-purchased-btn").remove();
    }).catch(err => {
      alert("Error marking as purchased. Please try again.");
      console.error(err);
    });
  });

  $container.on("click", ".unmark-purchased-btn", function() {
    const $card = $(this).closest(".album-card");
    const albumId = $card.data("id");
    const albumName = $card.find("h2").text();

    if (!confirm(`Unmark "${albumName}" as purchased?`)) {
      return;
    }

    db.collection("purchases").doc(albumId).set({
      purchased: false,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    }).then(() => {
      purchasedIds.delete(albumId);
      $card.remove();
    }).catch(err => {
      alert("Error unmarking purchase. Please try again.");
      console.error(err);
    });
  });

  loadJsonFiles(() => loadPurchasedIds(showAbout));
});
