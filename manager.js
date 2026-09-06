// Headquarters/manager view: read-only visibility across locations.
// Reuses the same demo storage the employee app writes to.
Store.ensureSeeded();

const app = document.getElementById("app");

function renderDashboard() {
  const locations = Store.getLocations();
  const today = new Date().toISOString().slice(0, 10);
  const inventories = Store.getInventories();

  const rows = locations.map((loc) => {
    const record = inventories.find((r) => r.locationId === loc.id && r.date === today);
    return { loc, record };
  });

  const completeCount = rows.filter((r) => r.record).length;

  app.innerHTML = `
    <div class="topbar"><div class="brand">Manager Dashboard</div></div>
    <div class="screen">
      <h1>Today's Status</h1>
      <div class="mgr-status">
        <span class="status-chip">Inventory: ${completeCount}/${rows.length} completed</span>
      </div>

      <p class="muted">Branches</p>
      ${rows.map(({ loc, record }) => `
        <button class="branch-card" onclick="showBranch('${loc.id}')">
          <span class="branch-name">${loc.name}</span>
          <span class="badge ${record ? "green" : "red"}">${record ? "Complete" : "Missing inventory"}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function showBranch(locationId) {
  const loc = Store.getLocations().find((l) => l.id === locationId);
  const records = Store.getInventories()
    .filter((r) => r.locationId === locationId)
    .sort((a, b) => b.timestamp - a.timestamp);

  app.innerHTML = `
    <div class="topbar"><button class="back" onclick="renderDashboard()">←</button><div class="brand">${loc.name}</div></div>
    <div class="screen">
      ${records.length === 0 ? `<p class="muted">No submissions yet.</p>` : records.map((r) => `
        <div class="history-card">
          <div class="history-head"><span>${r.date}</span><span class="muted">by ${r.employee}</span></div>
          ${r.items.map((it) => `
            <div class="review-row"><span>${it.productName}</span><span>${it.totalPieces} pcs</span></div>
          `).join("")}
        </div>
      `).join("")}
    </div>
  `;
}

renderDashboard();
