// Employee-facing mobile inventory workflow.
Store.ensureSeeded();

const app = document.getElementById("app");
let session = {
  categoryId: null,
  entries: {}, // productId -> { mode, fullBoxes, pieces, fraction }
  productIds: [], // products touched, in order, for the review screen
};

function currentLocation() {
  const id = Store.getCurrentLocation();
  return Store.getLocations().find((l) => l.id === id);
}

function render(html) {
  app.innerHTML = html;
}

function go(view, ...args) {
  views[view](...args);
  window.scrollTo(0, 0);
}

const views = {
  home() {
    const loc = currentLocation();
    const existing = Store.todaysInventory(loc.id);
    render(`
      <div class="topbar">
        <div class="brand">Restaurant Ops</div>
        <button class="pill" onclick="go('locationPicker')">${loc.name} ▾</button>
      </div>
      <div class="screen">
        <h1>Good morning</h1>
        <p class="muted">Today's tasks</p>
        <div class="tasklist">
          <button class="task-card ${existing ? "done" : "pending"}" onclick="go('categories')">
            <span class="dot ${existing ? "green" : "yellow"}"></span>
            <span class="task-label">Morning Inventory</span>
            <span class="task-status">${existing ? "Completed" : "Start"}</span>
          </button>
          <button class="task-card disabled">
            <span class="dot blue"></span>
            <span class="task-label">Delivery Receiving</span>
            <span class="task-status">Coming soon</span>
          </button>
          <button class="task-card" onclick="go('history')">
            <span class="dot blue"></span>
            <span class="task-label">Review Previous Inventory</span>
            <span class="task-status">View</span>
          </button>
        </div>
      </div>
    `);
  },

  locationPicker() {
    const locs = Store.getLocations();
    render(`
      <div class="topbar"><button class="back" onclick="go('home')">←</button><div class="brand">Select Location</div></div>
      <div class="screen">
        ${locs.map((l) => `
          <button class="list-row" onclick="Store.setCurrentLocation('${l.id}'); go('home')">
            ${l.name}
          </button>
        `).join("")}
      </div>
    `);
  },

  categories() {
    const cats = Store.getCategories();
    const products = Store.getProducts();
    render(`
      <div class="topbar"><button class="back" onclick="go('home')">←</button><div class="brand">Morning Inventory</div></div>
      <div class="screen">
        <p class="muted">Select category</p>
        <div class="grid">
          ${cats.map((c) => {
            const count = products.filter((p) => p.category === c).length;
            if (!count) return "";
            const done = products.filter((p) => p.category === c && session.entries[p.id]).length;
            return `
              <button class="category-tile" onclick="go('productList','${c}')">
                <div class="cat-name">${c}</div>
                <div class="cat-count">${done}/${count}</div>
              </button>
            `;
          }).join("")}
        </div>
        ${session.productIds.length ? `<button class="primary sticky" onclick="go('review')">Review & Submit (${session.productIds.length})</button>` : ""}
      </div>
    `);
  },

  productList(category) {
    session.categoryId = category;
    const products = Store.getProducts().filter((p) => p.category === category);
    render(`
      <div class="topbar"><button class="back" onclick="go('categories')">←</button><div class="brand">${category}</div></div>
      <div class="screen">
        ${products.map((p) => {
          const entry = session.entries[p.id];
          const total = entry ? Store.normalizeQuantity(p, entry) : null;
          return `
            <button class="list-row" onclick="go('productEntry','${p.id}')">
              <span>${p.name}</span>
              <span class="row-right">${total !== null ? total + " pcs ✓" : "Enter →"}</span>
            </button>
          `;
        }).join("")}
      </div>
    `);
  },

  productEntry(productId) {
    const p = Store.getProducts().find((x) => x.id === productId);
    const entry = session.entries[productId] || { mode: "boxes+pieces", fullBoxes: 0, pieces: 0, fraction: "full" };
    session.entries[productId] = entry;

    function total() {
      return Store.normalizeQuantity(p, entry);
    }

    render(`
      <div class="topbar"><button class="back" onclick="go('productList','${p.category}')">←</button><div class="brand">${p.name}</div></div>
      <div class="screen">
        <p class="muted">1 box = ${p.unitsPerBox} pieces</p>

        <div class="tabs">
          <button class="tab ${entry.mode === "boxes+pieces" ? "active" : ""}" data-mode="boxes+pieces">Boxes + pieces</button>
          <button class="tab ${entry.mode === "fraction" ? "active" : ""}" data-mode="fraction">Fraction</button>
          <button class="tab ${entry.mode === "pieces" ? "active" : ""}" data-mode="pieces">Pieces only</button>
        </div>

        <div id="entryBody"></div>

        <div class="total-card">
          <span>Total</span>
          <span id="totalVal" class="total-val">${total()} pieces</span>
        </div>

        <button class="primary sticky" onclick="commitEntry('${productId}')">Save</button>
      </div>
    `);

    function renderBody() {
      const body = document.getElementById("entryBody");
      if (entry.mode === "boxes+pieces") {
        body.innerHTML = `
          <div class="stepper-row">
            <label>Full boxes</label>
            <div class="stepper">
              <button onclick="stepField('${productId}','fullBoxes',-1)">−</button>
              <span id="val-fullBoxes">${entry.fullBoxes}</span>
              <button onclick="stepField('${productId}','fullBoxes',1)">+</button>
            </div>
          </div>
          <div class="stepper-row">
            <label>Individual pieces</label>
            <div class="stepper">
              <button onclick="stepField('${productId}','pieces',-1)">−</button>
              <span id="val-pieces">${entry.pieces}</span>
              <button onclick="stepField('${productId}','pieces',1)">+</button>
            </div>
          </div>
        `;
      } else if (entry.mode === "fraction") {
        const options = ["full", "3/4", "1/2", "1/3", "1/4"];
        body.innerHTML = `
          <div class="fraction-grid">
            ${options.map((f) => `
              <button class="fraction-btn ${entry.fraction === f ? "active" : ""}" onclick="setFraction('${productId}','${f}')">${f}</button>
            `).join("")}
          </div>
        `;
      } else if (entry.mode === "pieces") {
        body.innerHTML = `
          <div class="stepper-row">
            <label>Pieces counted</label>
            <div class="stepper">
              <button onclick="stepField('${productId}','pieces',-1)">−</button>
              <span id="val-pieces">${entry.pieces}</span>
              <button onclick="stepField('${productId}','pieces',1)">+</button>
            </div>
          </div>
        `;
      }
    }
    renderBody();

    document.querySelectorAll(".tab").forEach((btn) => {
      btn.onclick = () => {
        entry.mode = btn.dataset.mode;
        renderBody();
        updateTotal();
        document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === btn));
      };
    });

    window.stepField = (id, field, delta) => {
      const e = session.entries[id];
      e[field] = Math.max(0, (Number(e[field]) || 0) + delta);
      document.getElementById("val-" + field).textContent = e[field];
      updateTotal();
    };

    window.setFraction = (id, frac) => {
      session.entries[id].fraction = frac;
      renderBody();
      updateTotal();
    };

    function updateTotal() {
      document.getElementById("totalVal").textContent = total() + " pieces";
    }
  },

  review() {
    const products = Store.getProducts();
    const rows = Object.keys(session.entries).map((pid) => {
      const p = products.find((x) => x.id === pid);
      const total = Store.normalizeQuantity(p, session.entries[pid]);
      return { p, total };
    });
    render(`
      <div class="topbar"><button class="back" onclick="go('categories')">←</button><div class="brand">Review</div></div>
      <div class="screen">
        ${rows.length === 0 ? `<p class="muted">No products entered yet.</p>` : rows.map((r) => `
          <div class="review-row">
            <span>${r.p.name}</span>
            <span>${r.total} pcs</span>
          </div>
        `).join("")}
        <button class="primary sticky" ${rows.length === 0 ? "disabled" : ""} onclick="submitInventory()">Submit Inventory</button>
      </div>
    `);
  },

  done(count) {
    render(`
      <div class="screen center">
        <div class="check">✓</div>
        <h1>Inventory submitted</h1>
        <p class="muted">${count} products recorded for ${currentLocation().name}</p>
        <button class="primary" onclick="resetSession(); go('home')">Back to Home</button>
      </div>
    `);
  },

  history() {
    const loc = currentLocation();
    const records = Store.getInventories()
      .filter((r) => r.locationId === loc.id)
      .sort((a, b) => b.timestamp - a.timestamp);
    render(`
      <div class="topbar"><button class="back" onclick="go('home')">←</button><div class="brand">Previous Inventory</div></div>
      <div class="screen">
        ${records.length === 0 ? `<p class="muted">No submissions yet.</p>` : records.map((r) => `
          <div class="history-card">
            <div class="history-head">
              <span>${r.date}</span>
              <span class="muted">${r.items.length} products</span>
            </div>
            <div class="muted">By ${r.employee}</div>
          </div>
        `).join("")}
      </div>
    `);
  },
};

function commitEntry(productId) {
  if (!session.productIds.includes(productId)) {
    session.productIds.push(productId);
  }
  const p = Store.getProducts().find((x) => x.id === productId);
  go("productList", p.category);
}

function submitInventory() {
  const products = Store.getProducts();
  const items = Object.keys(session.entries).map((pid) => {
    const p = products.find((x) => x.id === pid);
    return {
      productId: pid,
      productName: p.name,
      entry: session.entries[pid],
      totalPieces: Store.normalizeQuantity(p, session.entries[pid]),
    };
  });
  const loc = currentLocation();
  Store.saveInventory({
    locationId: loc.id,
    date: new Date().toISOString().slice(0, 10),
    timestamp: Date.now(),
    employee: "Demo Employee",
    items,
  });
  go("done", items.length);
}

function resetSession() {
  session = { categoryId: null, entries: {}, productIds: [] };
}

go("home");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
