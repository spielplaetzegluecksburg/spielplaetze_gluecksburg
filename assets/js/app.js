const elements = {
  results: document.querySelector("#results"),
  count: document.querySelector("#result-count"),
  dataStatus: document.querySelector("#data-status"),
  dialog: document.querySelector("#playground-dialog"),
  dialogContent: document.querySelector("#dialog-content"),
  closeDialog: document.querySelector("#close-dialog"),
  imageDialog: document.querySelector("#image-dialog"),
  fullSizeImage: document.querySelector("#full-size-image"),
  imageDialogTitle: document.querySelector("#image-dialog-title"),
  imageCounter: document.querySelector("#image-counter"),
  closeImageDialog: document.querySelector("#close-image-dialog"),
  previousImage: document.querySelector("#previous-image"),
  nextImage: document.querySelector("#next-image"),
  routeDialog: document.querySelector("#route-dialog"),
  routeOptions: document.querySelector("#route-options"),
  closeRouteDialog: document.querySelector("#close-route-dialog"),
};

let galleryImages = [];
let activeImageIndex = 0;

async function start() {
  try {
    const response = await fetch("assets/data/playgrounds.json");
    if (!response.ok) throw new Error(`Daten konnten nicht geladen werden (${response.status}).`);

    const data = await response.json();
    const { updatedAt } = data;
    const playgrounds = [...data.playgrounds].sort((first, second) => first.name.localeCompare(second.name, "de"));
    const map = initializeMap();
    renderMarkers(map, playgrounds);
    renderResults(map, playgrounds);
    updateDataStatus(updatedAt);
  } catch (error) {
    console.error(error);
  }
}

function initializeMap() {
  const map = L.map("map", { zoomControl: false }).setView([54.836, 9.552], 14);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap-Mitwirkende",
  }).addTo(map);
  return map;
}

function renderMarkers(map, playgrounds) {
  const bounds = [];

  playgrounds.forEach((playground) => {
    bounds.push([playground.latitude, playground.longitude]);
    const marker = L.marker([playground.latitude, playground.longitude]).addTo(map);
    marker.bindPopup(`
      <div class="map-popup">
        <h3>${playground.name}</h3>
        <p>${formatCoordinates(playground)}</p>
        <button type="button" data-playground-id="${playground.id}">Details ansehen</button>
      </div>
    `);
    marker.on("popupopen", () => {
      const button = document.querySelector(`[data-playground-id="${playground.id}"]`);
      button?.addEventListener("click", () => showDetails(playground));
    });
  });

  if (bounds.length) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
}

function renderResults(map, playgrounds) {
  elements.count.textContent = playgrounds.length;
  elements.results.innerHTML = "";

  playgrounds.forEach((playground) => {
    const card = document.createElement("button");
    card.className = "playground-card";
    card.type = "button";
    const image = playground.image
      ? `<img src="${playground.image}" alt="${playground.imageAlt || playground.imageLabel}">`
      : `<div class="image-placeholder accent-${playground.accent}" aria-hidden="true"></div>`;
    card.innerHTML = `
      <div class="playground-image">${image}</div>
      <div class="card-body">
        <h3>${playground.name}</h3>
        <p class="address">${formatCoordinates(playground)}</p>
        <p class="area">${playground.area}</p>
        <div class="tag-list">${playground.equipment.filter((item) => item.showInList !== false).sort((first, second) => first.name.localeCompare(second.name, "de")).map((item) => `<span class="tag ${getEquipmentColorClass(item.name)}">${item.name}</span>`).join("")}</div>
      </div>
    `;
    card.addEventListener("click", () => {
      map.setView([playground.latitude, playground.longitude], 16, { animate: true });
      showDetails(playground);
    });
    elements.results.append(card);
  });
}

function showDetails(playground) {
  galleryImages = getGalleryImages(playground);
  const image = playground.image
    ? `<button class="detail-image-button" type="button" data-gallery-index="0"><img src="${playground.image}" alt="${playground.imageAlt || playground.imageLabel}"></button>`
    : `<div class="image-placeholder accent-${playground.accent}" aria-label="Platzhalterbild: ${playground.imageLabel}" role="img"></div>`;
  elements.dialogContent.innerHTML = `
    <div class="detail-image">${image}</div>
    <div class="detail-content">
      <p class="eyebrow">Spielplatz</p>
      <h2 id="dialog-title">${playground.name}</h2>
      <p class="detail-address">${formatCoordinates(playground)}</p>
      <p class="detail-area">${playground.area}</p>
      <p class="detail-description">${playground.description}</p>
      ${playground.additional ? `<aside class="additional-note"><strong>Hinweis</strong>${playground.additional}</aside>` : ""}
      <h3>Geräte</h3>
      <div class="device-gallery">${playground.equipment.map((device, index) => renderDevice(device, galleryImages.findIndex((image) => image.src === device.image), index)).join("")}</div>
      <button class="route-link" type="button" data-route-latitude="${playground.latitude}" data-route-longitude="${playground.longitude}">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 22s7-5.15 7-12A7 7 0 0 0 5 10c0 6.85 7 12 7 12Z"/><circle cx="12" cy="10" r="2.25"/></svg>
        Route öffnen
      </button>
    </div>
  `;
  elements.dialog.showModal();
}

function formatCoordinates(playground) {
  return `${playground.latitude.toFixed(4)}, ${playground.longitude.toFixed(4)}`;
}

function getEquipmentColorClass(name) {
  const colors = {
    "Balancierbalken": "tag-azure",
    "Balancierstrecke": "tag-blue",
    "Drehender Kletterturm": "tag-violet",
    "Kletterwand": "tag-coral",
    "Kran-Kletterwand": "tag-rose",
    "Rutsche": "tag-sun",
    "Sandkasten": "tag-amber",
    "Schaukel": "tag-green",
    "Schaukel am Spielturm": "tag-mint",
    "Sitzgelegenheit": "tag-slate",
    "Spielturm": "tag-violet",
    "Spielturm mit Rutsche": "tag-violet",
    "Turnstangen": "tag-azure",
    "Wippe": "tag-amber",
  };
  return colors[name] || "tag-green";
}

function updateDataStatus(updatedAt) {
  const date = new Date(`${updatedAt}T12:00:00`);
  elements.dataStatus.dateTime = updatedAt;
  elements.dataStatus.textContent = `Stand: ${date.toLocaleDateString("de-DE")}`;
}

function getGalleryImages(playground) {
  return [
    playground.image && { src: playground.image, alt: playground.imageAlt || playground.imageLabel },
    ...playground.equipment.filter((device) => device.image).map((device) => ({ src: device.image, alt: device.imageAlt || device.name })),
  ].filter(Boolean);
}

function renderDevice(device, galleryIndex, index) {
  if (!device.image) {
    return `
      <article class="device-card">
        <div class="device-image"><div class="device-placeholder" aria-hidden="true"></div></div>
        <div class="device-card-body"><h4>${device.name}</h4><p>Foto ergänzen</p></div>
      </article>
    `;
  }

  return `
    <button class="device-card device-card-button" type="button" data-gallery-index="${galleryIndex}">
      <div class="device-image"><img src="${device.image}" alt="${device.imageAlt}"></div>
      <div class="device-card-body"><h4>${device.name}</h4><p>Foto vergrößern</p></div>
    </button>
  `;
}

elements.closeDialog.addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) elements.dialog.close();
});
elements.dialogContent.addEventListener("click", (event) => {
  const routeButton = event.target.closest("[data-route-latitude]");
  if (routeButton) {
    showRouteOptions(routeButton.dataset.routeLatitude, routeButton.dataset.routeLongitude);
    return;
  }

  const button = event.target.closest("[data-gallery-index]");
  if (!button) return;
  openGallery(Number(button.dataset.galleryIndex));
});
elements.closeImageDialog.addEventListener("click", () => elements.imageDialog.close());
elements.previousImage.addEventListener("click", () => showGalleryImage(activeImageIndex - 1));
elements.nextImage.addEventListener("click", () => showGalleryImage(activeImageIndex + 1));
elements.imageDialog.addEventListener("click", (event) => {
  if (event.target === elements.imageDialog) elements.imageDialog.close();
});
document.addEventListener("keydown", (event) => {
  if (!elements.imageDialog.open) return;
  if (event.key === "ArrowLeft") showGalleryImage(activeImageIndex - 1);
  if (event.key === "ArrowRight") showGalleryImage(activeImageIndex + 1);
});
elements.closeRouteDialog.addEventListener("click", () => elements.routeDialog.close());
elements.routeDialog.addEventListener("click", (event) => {
  if (event.target === elements.routeDialog) elements.routeDialog.close();
});

function showRouteOptions(latitude, longitude) {
  const coordinates = `${latitude},${longitude}`;
  const options = [
    { name: "Google Maps", detail: "Navigation in Google Maps", url: `https://www.google.com/maps/dir/?api=1&destination=${coordinates}` },
    { name: "Apple Karten", detail: "Navigation in Apple Karten", url: `https://maps.apple.com/?daddr=${coordinates}&dirflg=d` },
    { name: "OpenStreetMap", detail: "Route in OpenStreetMap", url: `https://www.openstreetmap.org/directions?to=${latitude}%2C${longitude}` },
  ];
  elements.routeOptions.innerHTML = options.map((option) => `
    <a class="route-option" href="${option.url}" target="_blank" rel="noopener noreferrer">
      <strong>${option.name}</strong><span>${option.detail}</span>
    </a>
  `).join("");
  elements.routeDialog.showModal();
}

function openGallery(index) {
  activeImageIndex = index;
  showGalleryImage(activeImageIndex);
  elements.imageDialog.showModal();
}

function showGalleryImage(index) {
  activeImageIndex = (index + galleryImages.length) % galleryImages.length;
  const image = galleryImages[activeImageIndex];
  elements.fullSizeImage.src = image.src;
  elements.fullSizeImage.alt = image.alt;
  elements.imageDialogTitle.textContent = image.alt;
  elements.imageCounter.textContent = `${activeImageIndex + 1} / ${galleryImages.length}`;
  const hasMultipleImages = galleryImages.length > 1;
  elements.previousImage.hidden = !hasMultipleImages;
  elements.nextImage.hidden = !hasMultipleImages;
}

start();
