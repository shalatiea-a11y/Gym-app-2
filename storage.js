// Supabase-backed data layer. Multi-tenant isolation (which organization's
// rows you can see or write) is enforced by Postgres RLS policies in
// supabase/schema.sql — this file just issues queries scoped to whatever
// the signed-in user is authorized to see.
const Store = (() => {
  let profile = null;
  const LOCAL_KEY = "rios_current_location"; // device-local UI preference only, not business data

  async function init() {
    profile = await Auth.getProfile();
    if (!profile) {
      throw new Error("No profile linked to this account — see supabase/schema.sql for how to link a demo user.");
    }
    return profile;
  }

  function requireProfile() {
    if (!profile) throw new Error("Store.init() must be called before use");
    return profile;
  }

  async function getProducts() {
    const { data, error } = await supabaseClient
      .from("products")
      .select("*")
      .eq("active", true)
      .order("category")
      .order("name");
    if (error) throw error;
    return data.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      unit: p.package_unit,
      unitsPerBox: p.units_per_package,
    }));
  }

  async function getLocations() {
    const { data, error } = await supabaseClient
      .from("locations")
      .select("id, name")
      .eq("active", true)
      .order("name");
    if (error) throw error;
    return data;
  }

  async function getCategories() {
    const products = await getProducts();
    return [...new Set(products.map((p) => p.category))];
  }

  function getCurrentLocation() { return localStorage.getItem(LOCAL_KEY); }
  function setCurrentLocation(id) { localStorage.setItem(LOCAL_KEY, id); }

  // Deterministic normalization: full boxes + loose pieces -> total pieces.
  // Never involves AI — exact arithmetic on the configured conversion rate.
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

  const MODE_TO_DB = { "boxes+pieces": "boxes_pieces", fraction: "fraction", pieces: "pieces" };
  const MODE_FROM_DB = { boxes_pieces: "boxes+pieces", fraction: "fraction", pieces: "pieces" };

  async function todaysInventory(locationId) {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabaseClient
      .from("inventory_submissions")
      .select("id, submitted_at, inventory_date, profiles(full_name)")
      .eq("location_id", locationId)
      .eq("inventory_date", today)
      .maybeSingle();
    if (error) throw error;
    return data ? toRecord(data, locationId) : null;
  }

  async function toRecord(submission, locationId) {
    const { data: items, error } = await supabaseClient
      .from("inventory_items")
      .select("product_id, normalized_quantity, entry_mode, products(name)")
      .eq("submission_id", submission.id);
    if (error) throw error;
    return {
      id: submission.id,
      locationId,
      date: submission.inventory_date,
      timestamp: new Date(submission.submitted_at).getTime(),
      employee: submission.profiles?.full_name || "Unknown",
      items: items.map((it) => ({
        productId: it.product_id,
        productName: it.products?.name || "Unknown product",
        totalPieces: it.normalized_quantity,
      })),
    };
  }

  async function getInventories() {
    const { data, error } = await supabaseClient
      .from("inventory_submissions")
      .select("id, location_id, submitted_at, inventory_date, profiles(full_name)")
      .order("submitted_at", { ascending: false });
    if (error) throw error;
    return Promise.all(data.map((s) => toRecord(s, s.location_id)));
  }

  async function saveInventory(record) {
    const { organization_id, id: profileId } = requireProfile();
    const { data: submission, error: subError } = await supabaseClient
      .from("inventory_submissions")
      .insert({
        organization_id,
        location_id: record.locationId,
        submitted_by: profileId,
        inventory_date: record.date,
      })
      .select()
      .single();
    if (subError) throw subError;

    const rows = record.items.map((it) => ({
      submission_id: submission.id,
      product_id: it.productId,
      entry_mode: MODE_TO_DB[it.entry.mode],
      entered_full_boxes: it.entry.fullBoxes ?? null,
      entered_pieces: it.entry.pieces ?? null,
      entered_fraction: it.entry.fraction ?? null,
      units_per_package_at_entry: it.unitsPerPackageAtEntry,
      normalized_quantity: it.totalPieces,
    }));
    const { error: itemsError } = await supabaseClient.from("inventory_items").insert(rows);
    if (itemsError) throw itemsError;
  }

  return {
    init,
    getProducts,
    getLocations,
    getCategories,
    getCurrentLocation,
    setCurrentLocation,
    saveInventory,
    todaysInventory,
    getInventories,
    normalizeQuantity,
  };
})();
