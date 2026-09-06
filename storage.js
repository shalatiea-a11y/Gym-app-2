// Deterministic calculations + localStorage-backed demo persistence.
// This stands in for a real backend/API in the MVP; the data shapes
// (company -> location -> product -> inventory) mirror the intended model.
const Store = (() => {
  const KEYS = {
    products: "rios_products",
    locations: "rios_locations",
    categories: "rios_categories",
    inventories: "rios_inventories",
    currentLocation: "rios_current_location",
  };

  function ensureSeeded() {
    if (!localStorage.getItem(KEYS.products)) {
      localStorage.setItem(KEYS.products, JSON.stringify(SEED.products));
    }
    if (!localStorage.getItem(KEYS.locations)) {
      localStorage.setItem(KEYS.locations, JSON.stringify(SEED.locations));
    }
    if (!localStorage.getItem(KEYS.categories)) {
      localStorage.setItem(KEYS.categories, JSON.stringify(SEED.categories));
    }
    if (!localStorage.getItem(KEYS.inventories)) {
      localStorage.setItem(KEYS.inventories, JSON.stringify([]));
    }
    if (!localStorage.getItem(KEYS.currentLocation)) {
      localStorage.setItem(KEYS.currentLocation, SEED.locations[0].id);
    }
  }

  function getProducts() { return JSON.parse(localStorage.getItem(KEYS.products)); }
  function getLocations() { return JSON.parse(localStorage.getItem(KEYS.locations)); }
  function getCategories() { return JSON.parse(localStorage.getItem(KEYS.categories)); }
  function getInventories() { return JSON.parse(localStorage.getItem(KEYS.inventories)); }
  function getCurrentLocation() { return localStorage.getItem(KEYS.currentLocation); }
  function setCurrentLocation(id) { localStorage.setItem(KEYS.currentLocation, id); }

  function saveInventory(record) {
    const all = getInventories();
    all.push(record);
    localStorage.setItem(KEYS.inventories, JSON.stringify(all));
  }

  function todaysInventory(locationId) {
    const today = new Date().toISOString().slice(0, 10);
    return getInventories().find(
      (r) => r.locationId === locationId && r.date === today
    );
  }

  // Deterministic normalization: full boxes + loose pieces -> total pieces.
  // Never involves AI — this is exact arithmetic on configured conversion rates.
  function normalizeQuantity(product, entry) {
    const perBox = product.unitsPerBox;
    if (entry.mode === "boxes+pieces") {
      const boxes = Number(entry.fullBoxes) || 0;
      const pieces = Number(entry.pieces) || 0;
      return boxes * perBox + pieces;
    }
    if (entry.mode === "fraction") {
      const fractions = { full: 1, "3/4": 0.75, "1/2": 0.5, "1/3": 1 / 3, "1/4": 0.25 };
      const frac = fractions[entry.fraction] ?? 0;
      return Math.round(perBox * frac);
    }
    if (entry.mode === "pieces") {
      return Number(entry.pieces) || 0;
    }
    return 0;
  }

  return {
    ensureSeeded,
    getProducts,
    getLocations,
    getCategories,
    getInventories,
    getCurrentLocation,
    setCurrentLocation,
    saveInventory,
    todaysInventory,
    normalizeQuantity,
  };
})();
