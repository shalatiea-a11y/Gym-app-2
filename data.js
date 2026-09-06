// Demo seed data — illustrates the shape of the platform's config model.
// Real customers will configure their own company/locations/products.
const SEED = {
  company: { id: "demo-co", name: "Demo Restaurant Group" },
  locations: [
    { id: "loc-1", name: "Downtown" },
    { id: "loc-2", name: "Airport Road" },
    { id: "loc-3", name: "Mall Branch" },
  ],
  categories: [
    "Meat", "Cheese", "Bread", "Vegetables", "Sauces",
    "Drinks", "Packaging", "Frozen", "Dry Goods", "Other",
  ],
  products: [
    { id: "p1", name: "Big Meat", category: "Meat", unit: "box", unitsPerBox: 24 },
    { id: "p2", name: "Small Meat", category: "Meat", unit: "box", unitsPerBox: 60 },
    { id: "p3", name: "Cheese Slices", category: "Cheese", unit: "box", unitsPerBox: 100 },
    { id: "p4", name: "Burger Buns", category: "Bread", unit: "box", unitsPerBox: 48 },
    { id: "p5", name: "Lettuce", category: "Vegetables", unit: "box", unitsPerBox: 12 },
    { id: "p6", name: "Tomatoes", category: "Vegetables", unit: "box", unitsPerBox: 20 },
    { id: "p7", name: "Ketchup Sachets", category: "Sauces", unit: "box", unitsPerBox: 200 },
    { id: "p8", name: "Cola Cans", category: "Drinks", unit: "box", unitsPerBox: 24 },
    { id: "p9", name: "Fry Boxes", category: "Packaging", unit: "box", unitsPerBox: 250 },
    { id: "p10", name: "Frozen Fries", category: "Frozen", unit: "box", unitsPerBox: 10 },
  ],
};
