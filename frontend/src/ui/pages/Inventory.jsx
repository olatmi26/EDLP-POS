import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import api from "../lib/api";

// ─── helpers ──────────────────────────────────────────────────────────────────
const currency = (v) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(v || 0);

const stockColor = (qty) => {
  if (qty <= 0) return { bg: "#FDECEA", color: "#C0392B", label: "Out" };
  if (qty <= 5) return { bg: "#FEF0E6", color: "#C45A00", label: `Low · ${qty}` };
  return { bg: "#EAF5EE", color: "#1A6E3A", label: qty };
};

const CHART_COLORS = ["#0A1628", "#E8A020", "#1A6E3A", "#5B3FA6", "#0F6E6E", "#C45A00"];

const TABS = [
  { id: "stock", label: "Stock Levels" },
  { id: "movements", label: "Movements" },
  { id: "price-history", label: "Price History" },
  { id: "analytics", label: "Analytics" },
];

// ─── Stock In / Out / Transfer Modal ─────────────────────────────────────────
function StockActionModal({ open, mode, onClose, products, branches, myBranchId }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ product_id: "", branch_id: myBranchId || "", quantity: "", reason: "", notes: "", to_branch_id: "" });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const endpointMap = { "stock-in": "/inventory/stock-in", "stock-out": "/inventory/stock-out", transfer: "/inventory/transfer" };
  const titles = { "stock-in": "📦 Stock In", "stock-out": "📤 Stock Out", transfer: "⇄ Inter-Branch Transfer" };

  if (!open) return null;

  const handleSubmit = async () => {
    setSaving(true);
    setResult(null);
    try {
      const payload = { ...form };
      if (mode === "transfer") {
        payload.from_branch_id = form.branch_id;
      }
      const res = await api.post(endpointMap[mode], payload);
      setResult({ ok: true, msg: res.data.message });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setTimeout(() => { onClose(); setResult(null); setForm({ product_id: "", branch_id: myBranchId || "", quantity: "", reason: "", notes: "", to_branch_id: "" }); }, 1200);
    } catch (e) {
      setResult({ ok: false, msg: e.response?.data?.message || "Error occurred." });
    }
    setSaving(false);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>{titles[mode]}</div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={styles.form}>
          <Field label="Product">
            <select style={styles.input} value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
              <option value="">Select product…</option>
              {(products || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <div style={styles.row2}>
            <Field label={mode === "transfer" ? "From Branch" : "Branch"}>
              <select style={styles.input} value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
                <option value="">Select branch…</option>
                {(branches || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Quantity">
              <input type="number" min="1" style={styles.input} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="0" />
            </Field>
          </div>
          {mode === "transfer" && (
            <Field label="To Branch">
              <select style={styles.input} value={form.to_branch_id} onChange={(e) => setForm({ ...form, to_branch_id: e.target.value })}>
                <option value="">Select target branch…</option>
                {(branches || []).filter((b) => b.id !== Number(form.branch_id)).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
          )}
          <Field label={mode === "stock-in" ? "Notes (optional)" : "Reason *"}>
            <input style={styles.input} value={form.reason || form.notes} onChange={(e) => setForm({ ...form, reason: e.target.value, notes: e.target.value })} placeholder={mode === "stock-in" ? "e.g. Purchase order PO-001" : "e.g. Damaged goods, Expiry disposal"} />
          </Field>

          {result && (
            <div style={{ ...styles.infoBox, ...(result.ok ? { background: "#EAF5EE", color: "#1A6E3A", borderColor: "#1A6E3A" } : { background: "#FDECEA", color: "#C0392B", borderColor: "#C0392B" }) }}>
              {result.msg}
            </div>
          )}

          <div style={styles.modalFooter}>
            <button style={styles.btnSecondary} onClick={onClose}>Cancel</button>
            <button style={styles.btnPrimary} disabled={saving || !form.product_id || !form.quantity} onClick={handleSubmit}>
              {saving ? "Saving…" : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stock Levels Tab ─────────────────────────────────────────────────────────
function StockTab({ products, branches, myBranchId }) {
  const [modal, setModal] = useState(null); // 'stock-in' | 'stock-out' | 'transfer'
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["inventory", { search, page }],
    queryFn: () => api.get("/inventory", { params: { search, page, per_page: 25 } }).then((r) => r.data),
    keepPreviousData: true,
  });

  const items = data?.data || [];
  const meta = data?.meta || {};

  return (
    <>
      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button style={{ ...styles.btnAction, background: "#EAF5EE", color: "#1A6E3A", border: "1.5px solid #1A6E3A" }} onClick={() => setModal("stock-in")}>
          ↑ Stock In
        </button>
        <button style={{ ...styles.btnAction, background: "#FDECEA", color: "#C0392B", border: "1.5px solid #C0392B" }} onClick={() => setModal("stock-out")}>
          ↓ Stock Out
        </button>
        <button style={{ ...styles.btnAction, background: "#EAF0FB", color: "#1A3FA6", border: "1.5px solid #1A3FA6" }} onClick={() => setModal("transfer")}>
          ⇄ Transfer
        </button>
        <div style={{ flex: 1 }} />
        <input style={{ ...styles.input, maxWidth: 260 }} placeholder="Search products…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thead}>
              <th style={styles.th}>Product</th>
              <th style={styles.th}>Category</th>
              <th style={styles.th}>Stock Level</th>
              <th style={styles.th}>Cost Price</th>
              <th style={styles.th}>Sell Price</th>
              <th style={styles.th}>Stock Value</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} style={styles.emptyCell}>Loading inventory…</td></tr>}
            {!isLoading && items.length === 0 && <tr><td colSpan={6} style={styles.emptyCell}>No inventory records found.</td></tr>}
            {items.map((inv) => {
              const sc = stockColor(inv.quantity);
              const value = (inv.quantity || 0) * (inv.product?.cost_price || 0);
              return (
                <tr key={inv.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#1C2B3A" }}>{inv.product?.name}</div>
                    <div style={{ fontSize: 11, color: "#8A9AB5" }}>{inv.product?.sku || inv.product?.barcode || ""}</div>
                  </td>
                  <td style={styles.td}><span style={{ fontSize: 12 }}>{inv.product?.category?.name || "—"}</span></td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, background: sc.bg, color: sc.color }}>{sc.label}</span>
                  </td>
                  <td style={styles.td}><span style={{ fontSize: 13 }}>{currency(inv.product?.cost_price)}</span></td>
                  <td style={styles.td}><span style={{ fontSize: 13 }}>{currency(inv.product?.selling_price)}</span></td>
                  <td style={styles.td}><span style={{ fontSize: 13, fontWeight: 600 }}>{currency(value)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {meta.last_page > 1 && (
        <div style={styles.pagination}>
          <span style={{ fontSize: 12, color: "#8A9AB5" }}>Showing {items.length} of {meta.total}</span>
          <div style={{ display: "flex", gap: 5 }}>
            <button style={styles.pageBtn} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
            <span style={{ ...styles.pageBtn, ...styles.pageBtnActive }}>{page}</span>
            <button style={styles.pageBtn} disabled={page === meta.last_page} onClick={() => setPage((p) => p + 1)}>Next ›</button>
          </div>
        </div>
      )}

      <StockActionModal open={!!modal} mode={modal} onClose={() => setModal(null)} products={products} branches={branches} myBranchId={myBranchId} />
    </>
  );
}

// ─── Price History Tab — PAGINATED ───────────────────────────────────────────
function PriceHistoryTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["price-history", { page, search }],
    queryFn: () =>
      api.get("/price-history", { params: { page, per_page: 25, search } }).then((r) => r.data),
    keepPreviousData: true,
  });

  const rows = data?.data || [];
  const meta = data?.meta || {};

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, alignItems: "center", justifyContent: "space-between" }}>
        <input style={{ ...styles.input, maxWidth: 280 }} placeholder="Search product…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <span style={{ fontSize: 12, color: "#8A9AB5" }}>{meta.total || 0} total records</span>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thead}>
              <th style={styles.th}>Product</th>
              <th style={styles.th}>Old Price</th>
              <th style={styles.th}>New Price</th>
              <th style={styles.th}>Change</th>
              <th style={styles.th}>Changed By</th>
              <th style={styles.th}>Date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} style={styles.emptyCell}>Loading…</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={6} style={styles.emptyCell}>No price history found.</td></tr>}
            {rows.map((r, i) => {
              const diff = r.new_price - r.old_price;
              const pct = r.old_price ? ((diff / r.old_price) * 100).toFixed(1) : 0;
              return (
                <tr key={i} style={styles.tr}>
                  <td style={styles.td}><span style={{ fontWeight: 600, fontSize: 13 }}>{r.product?.name}</span></td>
                  <td style={styles.td}>{currency(r.old_price)}</td>
                  <td style={styles.td}>{currency(r.new_price)}</td>
                  <td style={styles.td}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: diff >= 0 ? "#1A6E3A" : "#C0392B" }}>
                      {diff >= 0 ? "+" : ""}{currency(diff)} ({pct}%)
                    </span>
                  </td>
                  <td style={styles.td}><span style={{ fontSize: 12 }}>{r.changed_by?.name || "—"}</span></td>
                  <td style={styles.td}>
                    <span style={{ fontSize: 12, color: "#8A9AB5" }}>
                      {r.created_at ? new Date(r.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta.last_page > 1 && (
        <div style={styles.pagination}>
          <span style={{ fontSize: 12, color: "#8A9AB5" }}>Page {page} of {meta.last_page} — {meta.total} records</span>
          <div style={{ display: "flex", gap: 5 }}>
            <button style={styles.pageBtn} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
            {Array.from({ length: Math.min(meta.last_page, 5) }, (_, i) => i + 1 + Math.max(0, page - 3)).filter((p) => p <= meta.last_page).map((pg) => (
              <button key={pg} style={{ ...styles.pageBtn, ...(pg === page ? styles.pageBtnActive : {}) }} onClick={() => setPage(pg)}>{pg}</button>
            ))}
            <button style={styles.pageBtn} disabled={page === meta.last_page} onClick={() => setPage((p) => p + 1)}>Next ›</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["inventory-analytics"],
    queryFn: () => api.get("/inventory/analytics").then((r) => r.data),
  });

  if (isLoading) return <div style={styles.emptyCell}>Loading analytics…</div>;

  const analytics = data || {};
  const stockByCategory = analytics.stock_by_category || [
    { name: "Beverages", value: 240 }, { name: "Dairy", value: 118 },
    { name: "Cereals", value: 73 }, { name: "Snacks", value: 92 },
    { name: "Personal Care", value: 45 },
  ];
  const movementTrend = analytics.movement_trend || [
    { date: "Mon", stock_in: 120, stock_out: 84 },
    { date: "Tue", stock_in: 95, stock_out: 102 },
    { date: "Wed", stock_in: 180, stock_out: 74 },
    { date: "Thu", stock_in: 60, stock_out: 130 },
    { date: "Fri", stock_in: 200, stock_out: 167 },
    { date: "Sat", stock_in: 310, stock_out: 245 },
    { date: "Sun", stock_in: 42, stock_out: 38 },
  ];
  const lowStockItems = analytics.low_stock || [];
  const kpis = analytics.kpis || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Total SKUs", value: kpis.total_skus || "—", color: "#0A1628" },
          { label: "Low Stock Alerts", value: kpis.low_stock_count || 0, color: "#C45A00" },
          { label: "Out of Stock", value: kpis.out_of_stock || 0, color: "#C0392B" },
          { label: "Total Stock Value", value: currency(kpis.total_value), color: "#1A6E3A" },
        ].map((kpi) => (
          <div key={kpi.label} style={styles.kpiCard}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8A9AB5", textTransform: "uppercase", letterSpacing: ".5px" }}>{kpi.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: kpi.color, marginTop: 6 }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Movement trend */}
        <div style={styles.chartCard}>
          <div style={styles.chartTitle}>Stock Movement — This Week</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={movementTrend} barSize={16} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8A9AB5" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8A9AB5" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,.12)", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="stock_in" fill="#1A6E3A" name="Stock In" radius={[3, 3, 0, 0]} />
              <Bar dataKey="stock_out" fill="#C0392B" name="Stock Out" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category distribution */}
        <div style={styles.chartCard}>
          <div style={styles.chartTitle}>Stock by Category</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={stockByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {stockByCategory.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,.12)", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Low stock table */}
      <div style={styles.chartCard}>
        <div style={styles.chartTitle}>Low & Out-of-Stock Products</div>
        {lowStockItems.length === 0 ? (
          <div style={{ color: "#8A9AB5", fontSize: 13, padding: "20px 0" }}>✅ No low-stock alerts at this time.</div>
        ) : (
          <table style={{ ...styles.table, marginTop: 12 }}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>Product</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Current Stock</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.map((item) => {
                const sc = stockColor(item.quantity);
                return (
                  <tr key={item.id} style={styles.tr}>
                    <td style={styles.td}><span style={{ fontWeight: 600, fontSize: 13 }}>{item.product?.name}</span></td>
                    <td style={styles.td}><span style={{ fontSize: 12 }}>{item.product?.category?.name}</span></td>
                    <td style={styles.td}><span style={{ fontWeight: 700 }}>{item.quantity}</span></td>
                    <td style={styles.td}><span style={{ ...styles.badge, background: sc.bg, color: sc.color }}>{sc.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState("stock");

  const { data: authUser } = useQuery({
    queryKey: ["auth-user"],
    queryFn: () => api.get("/me").then((r) => r.data.data || r.data),
  });
  const { data: products } = useQuery({
    queryKey: ["products-simple"],
    queryFn: () => api.get("/products", { params: { per_page: 500 } }).then((r) => r.data.data || r.data),
  });
  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get("/branches").then((r) => r.data.data || r.data),
  });

  const tabSubtitles = {
    stock: "Current stock levels across your branch",
    movements: "All stock adjustments and transfers",
    "price-history": "Historical price changes — paginated",
    analytics: "Inventory insights and stock analysis",
  };

  return (
    <div style={styles.page}>
      <div style={styles.breadcrumb}>
        <span style={styles.breadcrumbItem}>Inventory</span>
        <span style={styles.breadcrumbSep}>/</span>
        <span style={styles.breadcrumbActive}>{TABS.find((t) => t.id === activeTab)?.label}</span>
      </div>

      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Inventory Management</h1>
          <p style={styles.pageSubtitle}>{tabSubtitles[activeTab]}</p>
        </div>
      </div>

      <div style={styles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            style={{ ...styles.tabBtn, ...(activeTab === tab.id ? styles.tabBtnActive : {}) }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={styles.tabContent}>
        {activeTab === "stock" && (
          <StockTab products={products} branches={branches} myBranchId={authUser?.branch_id} />
        )}
        {activeTab === "movements" && (
          <div style={styles.emptyCell}>Movements log — wire to <code>GET /api/inventory/movements</code></div>
        )}
        {activeTab === "price-history" && <PriceHistoryTab />}
        {activeTab === "analytics" && <AnalyticsTab />}
      </div>
    </div>
  );
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = {
  page: { padding: "28px 32px", maxWidth: 1280, margin: "0 auto" },
  breadcrumb: { display: "flex", alignItems: "center", gap: 6, marginBottom: 16, fontSize: 12 },
  breadcrumbItem: { color: "#8A9AB5", fontWeight: 500 },
  breadcrumbSep: { color: "#CBD5E1" },
  breadcrumbActive: { color: "#0A1628", fontWeight: 700 },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  pageTitle: { fontSize: 22, fontWeight: 800, color: "#0A1628", letterSpacing: "-.3px" },
  pageSubtitle: { fontSize: 13, color: "#8A9AB5", marginTop: 4 },
  tabBar: { display: "flex", gap: 2, borderBottom: "1.5px solid #E4EAF0", marginBottom: 24 },
  tabBtn: { padding: "9px 20px", fontSize: 13, fontWeight: 600, border: "none", background: "transparent", color: "#8A9AB5", cursor: "pointer", borderBottom: "2px solid transparent", marginBottom: -1.5, borderRadius: "6px 6px 0 0", transition: "all .15s" },
  tabBtnActive: { color: "#0A1628", borderBottomColor: "#E8A020", background: "#FFFDF7" },
  tabContent: { background: "#fff", borderRadius: 12, border: "0.5px solid rgba(26,47,90,.12)", padding: 24, minHeight: 400 },
  tableWrap: { overflowX: "auto", borderRadius: 8, border: "0.5px solid #E4EAF0" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  thead: { background: "#F8FAFC" },
  th: { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "#8A9AB5", whiteSpace: "nowrap" },
  tr: { borderBottom: "0.5px solid #F0F4F8" },
  td: { padding: "11px 14px", verticalAlign: "middle" },
  emptyCell: { textAlign: "center", padding: 40, color: "#8A9AB5", fontSize: 13 },
  input: { width: "100%", padding: "8px 12px", borderRadius: 7, border: "1px solid #D0DAE8", fontSize: 13, color: "#1C2B3A", background: "#fff", outline: "none" },
  label: { fontSize: 12, fontWeight: 600, color: "#3A4A5C" },
  badge: { fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 5, whiteSpace: "nowrap" },
  btnPrimary: { padding: "9px 20px", background: "#0A1628", color: "#E8A020", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  btnSecondary: { padding: "9px 14px", background: "#F4F6FA", color: "#3A4A5C", border: "1px solid #D0DAE8", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  btnAction: { padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  overlay: { position: "fixed", inset: 0, background: "rgba(10,22,40,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(2px)" },
  modal: { background: "#fff", borderRadius: 14, width: "100%", margin: 20, boxShadow: "0 20px 60px rgba(10,22,40,.25)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 0" },
  modalTitle: { fontSize: 17, fontWeight: 800, color: "#0A1628" },
  closeBtn: { width: 30, height: 30, borderRadius: "50%", border: "none", background: "#F4F6FA", color: "#8A9AB5", fontSize: 13, cursor: "pointer" },
  form: { padding: 24, display: "flex", flexDirection: "column", gap: 16 },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  modalFooter: { display: "flex", gap: 10, justifyContent: "flex-end" },
  pagination: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 },
  pageBtn: { padding: "5px 12px", fontSize: 12, fontWeight: 600, background: "#F4F6FA", color: "#3A4A5C", border: "1px solid #D0DAE8", borderRadius: 6, cursor: "pointer" },
  pageBtnActive: { background: "#0A1628", color: "#E8A020", borderColor: "#0A1628" },
  kpiCard: { background: "#F8FAFC", borderRadius: 10, padding: 18, border: "0.5px solid #E4EAF0" },
  chartCard: { background: "#F8FAFC", borderRadius: 10, padding: 20, border: "0.5px solid #E4EAF0" },
  chartTitle: { fontSize: 13, fontWeight: 700, color: "#0A1628", marginBottom: 4 },
  infoBox: { padding: "12px 16px", borderRadius: 8, fontSize: 13, border: "1px solid", lineHeight: 1.5 },
};
