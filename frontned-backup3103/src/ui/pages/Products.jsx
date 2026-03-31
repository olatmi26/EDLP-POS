import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "../../lib/api";

// ─── helpers ──────────────────────────────────────────────────────────────────
const currency = (v) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(v || 0);

const stockStatus = (qty) => {
  if (qty === null || qty === undefined) return { label: "—", style: {} };
  if (qty <= 0) return { label: "Out of Stock", style: { background: "#FDECEA", color: "#C0392B" } };
  if (qty <= 5) return { label: `Low (${qty})`, style: { background: "#FEF0E6", color: "#C45A00" } };
  return { label: qty, style: { background: "#EAF5EE", color: "#1A6E3A" } };
};

const TABS = [
  { id: "list", label: "Product List" },
  { id: "import", label: "Import / Export" },
  { id: "bulk-price", label: "Bulk Price Update" },
];

const productSchema = z.object({
  name: z.string().min(2, "Product name required"),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  category_id: z.string().min(1, "Select a category"),
  supplier_id: z.string().optional(),
  cost_price: z.coerce.number().min(0, "Required"),
  selling_price: z.coerce.number().min(0, "Required"),
  initial_stock: z.coerce.number().min(0).optional(),
  vat_applicable: z.boolean().optional(),
});

// ─── Add / Edit Product Modal ─────────────────────────────────────────────────
function ProductModal({ open, onClose, product, categories, suppliers }) {
  const qc = useQueryClient();
  const isEdit = !!product;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: product || {},
  });

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit ? api.put(`/products/${product.id}`, data) : api.post("/products", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      reset();
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalTitle}>{isEdit ? "Edit Product" : "New Product"}</div>
            <div style={styles.modalSub}>
              {isEdit ? `Editing: ${product.name}` : "Add a new product to the catalogue"}
            </div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} style={styles.form}>
          {/* Row 1 */}
          <div style={styles.row2}>
            <Field label="Product Name *" error={errors.name?.message}>
              <input style={styles.input} placeholder="e.g. Golden Morn 500g" {...register("name")} />
            </Field>
            <Field label="SKU" error={errors.sku?.message}>
              <input style={styles.input} placeholder="Auto-generated if empty" {...register("sku")} />
            </Field>
          </div>
          {/* Row 2 */}
          <div style={styles.row2}>
            <Field label="Barcode" error={errors.barcode?.message}>
              <input style={styles.input} placeholder="EAN-13 / QR" {...register("barcode")} />
            </Field>
            <Field label="Category *" error={errors.category_id?.message}>
              <select style={styles.input} {...register("category_id")}>
                <option value="">Select category…</option>
                {(categories || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
          </div>
          {/* Row 3 */}
          <div style={styles.row2}>
            <Field label="Supplier" error={errors.supplier_id?.message}>
              <select style={styles.input} {...register("supplier_id")}>
                <option value="">Select supplier…</option>
                {(suppliers || []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Initial Stock (this branch)" error={errors.initial_stock?.message}>
              <input type="number" min="0" style={styles.input} placeholder="0" {...register("initial_stock")} />
            </Field>
          </div>
          {/* Row 4 */}
          <div style={styles.row2}>
            <Field label="Cost Price (₦) *" error={errors.cost_price?.message}>
              <input type="number" min="0" step="0.01" style={styles.input} placeholder="0.00" {...register("cost_price")} />
            </Field>
            <Field label="Selling Price (₦) *" error={errors.selling_price?.message}>
              <input type="number" min="0" step="0.01" style={styles.input} placeholder="0.00" {...register("selling_price")} />
            </Field>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#3A4A5C", cursor: "pointer" }}>
            <input type="checkbox" {...register("vat_applicable")} />
            VAT applicable
          </label>

          {mutation.isError && (
            <div style={styles.errBox}>
              {mutation.error?.response?.data?.message || "Failed to save product."}
            </div>
          )}

          <div style={styles.modalFooter}>
            <button type="button" style={styles.btnSecondary} onClick={onClose}>Cancel</button>
            <button type="submit" style={styles.btnPrimary} disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : isEdit ? "Update Product" : "Add Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Inline Price Edit Cell ───────────────────────────────────────────────────
function PriceCell({ product }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(product.selling_price);
  const qc = useQueryClient();
  const ref = useRef();

  const save = () => {
    if (Number(val) !== product.selling_price) {
      api.patch(`/products/${product.id}/price`, { selling_price: Number(val) }).then(() => {
        qc.invalidateQueries({ queryKey: ["products"] });
      });
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <span
        title="Click to edit price"
        style={{ cursor: "pointer", borderBottom: "1px dashed #CBD5E1", fontSize: 13 }}
        onClick={() => { setEditing(true); setTimeout(() => ref.current?.focus(), 30); }}
      >
        {currency(product.selling_price)}
      </span>
    );
  }

  return (
    <input
      ref={ref}
      type="number"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
      style={{ ...styles.input, width: 120, padding: "4px 8px", fontSize: 13 }}
    />
  );
}

// ─── Product List Tab ─────────────────────────────────────────────────────────
function ProductListTab({ categories, suppliers }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [editProduct, setEditProduct] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["products", { search, catFilter, page }],
    queryFn: () =>
      api
        .get("/products", { params: { search, category_id: catFilter || undefined, page, per_page: 25, with_stock: 1 } })
        .then((r) => r.data),
    keepPreviousData: true,
  });

  const products = data?.data || [];
  const meta = data?.meta || {};

  const qc = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  return (
    <>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={{ display: "flex", gap: 10, flex: 1, flexWrap: "wrap" }}>
          <input
            style={{ ...styles.input, maxWidth: 260 }}
            placeholder="Search name, SKU, barcode…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <select
            style={{ ...styles.input, maxWidth: 180 }}
            value={catFilter}
            onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}
          >
            <option value="">All categories</option>
            {(categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.btnOutline} onClick={() => api.get("/products/export", { responseType: "blob" }).then(downloadCSV)}>
            ↓ Export CSV
          </button>
          <button style={styles.btnPrimary} onClick={() => setShowAdd(true)}>
            + New Product
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thead}>
              <th style={styles.th}>Product</th>
              <th style={styles.th}>SKU</th>
              <th style={styles.th}>Category</th>
              <th style={styles.th}>Cost</th>
              <th style={styles.th}>Sell Price ✎</th>
              <th style={styles.th}>Stock</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} style={styles.emptyCell}>Loading products…</td></tr>}
            {!isLoading && products.length === 0 && (
              <tr><td colSpan={8} style={styles.emptyCell}>No products found.</td></tr>
            )}
            {products.map((p) => {
              const qty = p.inventory?.[0]?.quantity ?? null;
              const stock = stockStatus(qty);
              return (
                <tr key={p.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} />
                      ) : (
                        <div style={styles.productThumb}>📦</div>
                      )}
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#1C2B3A" }}>{p.name}</div>
                        {p.barcode && <div style={{ fontSize: 11, color: "#8A9AB5" }}>{p.barcode}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}><code style={styles.code}>{p.sku || "—"}</code></td>
                  <td style={styles.td}><span style={{ fontSize: 12 }}>{p.category?.name || "—"}</span></td>
                  <td style={styles.td}><span style={{ fontSize: 13 }}>{currency(p.cost_price)}</span></td>
                  <td style={styles.td}><PriceCell product={p} /></td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, ...stock.style }}>{stock.label}</span>
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, ...(p.is_active ? { background: "#EAF5EE", color: "#1A6E3A" } : { background: "#F4F6FA", color: "#8A9AB5" }) }}>
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button style={styles.actionBtn} onClick={() => setEditProduct(p)}>Edit</button>
                      <button
                        style={{ ...styles.actionBtn, color: "#C0392B", borderColor: "#FDECEA", background: "#FDECEA" }}
                        onClick={() => { if (confirm(`Delete ${p.name}?`)) deleteMutation.mutate(p.id); }}
                      >
                        Del
                      </button>
                    </div>
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
          <span style={{ fontSize: 12, color: "#8A9AB5" }}>
            Showing {products.length} of {meta.total} products
          </span>
          <div style={{ display: "flex", gap: 5 }}>
            <button
              style={styles.pageBtn}
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹ Prev
            </button>
            {Array.from({ length: Math.min(meta.last_page, 7) }, (_, i) => i + 1).map((pg) => (
              <button
                key={pg}
                style={{ ...styles.pageBtn, ...(pg === page ? styles.pageBtnActive : {}) }}
                onClick={() => setPage(pg)}
              >
                {pg}
              </button>
            ))}
            <button
              style={styles.pageBtn}
              disabled={page === meta.last_page}
              onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
            >
              Next ›
            </button>
          </div>
        </div>
      )}

      <ProductModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        categories={categories}
        suppliers={suppliers}
      />
      <ProductModal
        open={!!editProduct}
        product={editProduct}
        onClose={() => setEditProduct(null)}
        categories={categories}
        suppliers={suppliers}
      />
    </>
  );
}

// ─── Import / Export Tab ──────────────────────────────────────────────────────
function ImportExportTab() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(null);
    setResult(null);
  };

  const handlePreview = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("preview", "1");
    const res = await api.post("/products/import/preview", fd);
    setPreview(res.data);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await api.post("/products/import", fd);
    setResult(res.data);
    setImporting(false);
    setFile(null);
    setPreview(null);
  };

  const handleExport = () => {
    window.open("/api/products/export?token=" + localStorage.getItem("token"), "_blank");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Export */}
      <div style={styles.importCard}>
        <div style={styles.importCardTitle}>📥 Export Products</div>
        <p style={{ fontSize: 13, color: "#8A9AB5", marginBottom: 14 }}>
          Download the full product catalogue as a CSV file for editing or migration.
        </p>
        <button style={styles.btnOutline} onClick={handleExport}>Download CSV</button>
      </div>

      {/* Import */}
      <div style={styles.importCard}>
        <div style={styles.importCardTitle}>📤 Import Products via CSV</div>
        <p style={{ fontSize: 13, color: "#8A9AB5", marginBottom: 14 }}>
          Upload a CSV with columns: <code>name, sku, barcode, category, supplier, cost_price, selling_price</code>
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <button style={styles.btnSecondary} onClick={() => fileRef.current?.click()}>
            {file ? `✓ ${file.name}` : "Choose CSV File"}
          </button>
          {file && (
            <>
              <button style={styles.btnOutline} onClick={handlePreview}>Preview (first 10 rows)</button>
              <button style={styles.btnPrimary} onClick={handleImport} disabled={importing}>
                {importing ? "Importing…" : "Import Now"}
              </button>
            </>
          )}
        </div>

        {/* Preview table */}
        {preview && (
          <div style={{ marginTop: 16, overflowX: "auto" }}>
            <div style={{ fontSize: 12, color: "#8A9AB5", marginBottom: 8 }}>Preview — first 10 rows:</div>
            <table style={{ ...styles.table, border: "0.5px solid #E4EAF0", borderRadius: 8, overflow: "hidden" }}>
              <thead>
                <tr style={styles.thead}>
                  {(preview.headers || []).map((h) => <th key={h} style={styles.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {(preview.rows || []).map((row, i) => (
                  <tr key={i} style={styles.tr}>
                    {row.map((cell, j) => <td key={j} style={styles.td}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ ...styles.infoBox, background: "#EAF5EE", color: "#1A6E3A", borderColor: "#1A6E3A", marginTop: 14 }}>
            ✅ Import complete — {result.imported} products imported, {result.skipped} skipped.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bulk Price Update Tab ────────────────────────────────────────────────────
function BulkPriceTab({ categories }) {
  const [mode, setMode] = useState("percentage"); // percentage | fixed | csv
  const [catId, setCatId] = useState("");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();
  const qc = useQueryClient();

  const handleApply = async () => {
    if (!value) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await api.post("/products/bulk-price-update", {
        mode,
        value: Number(value),
        category_id: catId || undefined,
      });
      setResult(res.data);
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e) {
      setResult({ error: e.response?.data?.message || "Failed." });
    }
    setSubmitting(false);
  };

  return (
    <div style={{ maxWidth: 540, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={styles.importCard}>
        <div style={styles.importCardTitle}>💰 Bulk Price Adjustment</div>
        <p style={{ fontSize: 13, color: "#8A9AB5", marginBottom: 16 }}>
          Apply a percentage or fixed amount price change across a category or the entire catalogue.
          Changes above 20% will be routed through the Approval Workflow Engine.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Adjustment Type">
            <div style={{ display: "flex", gap: 8 }}>
              {["percentage", "fixed"].map((m) => (
                <button
                  key={m}
                  style={{
                    ...styles.btnSecondary,
                    ...(mode === m ? { background: "#0A1628", color: "#E8A020", borderColor: "#0A1628" } : {}),
                    flex: 1,
                  }}
                  onClick={() => setMode(m)}
                >
                  {m === "percentage" ? "% Percentage" : "₦ Fixed Amount"}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Category (leave blank for all products)">
            <select style={styles.input} value={catId} onChange={(e) => setCatId(e.target.value)}>
              <option value="">All Categories</option>
              {(categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          <Field label={mode === "percentage" ? "Percentage Change (%)" : "Fixed Amount (₦)"}>
            <input
              type="number"
              style={styles.input}
              placeholder={mode === "percentage" ? "e.g. 10 for +10%, -5 for -5%" : "e.g. 500"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>

          {Number(value) > 20 && mode === "percentage" && (
            <div style={styles.infoBox}>
              ⚠️ Changes above 20% will be sent for approval before taking effect.
            </div>
          )}

          <button style={styles.btnPrimary} disabled={submitting || !value} onClick={handleApply}>
            {submitting ? "Applying…" : "Apply Price Update"}
          </button>

          {result && !result.error && (
            <div style={{ ...styles.infoBox, background: "#EAF5EE", color: "#1A6E3A", borderColor: "#1A6E3A" }}>
              ✅ {result.message || `Updated ${result.updated} products.`}
              {result.approval_required && " — Sent for approval."}
            </div>
          )}
          {result?.error && (
            <div style={styles.errBox}>{result.error}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export function ProductsNewPage() {
  const [activeTab, setActiveTab] = useState("list");

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get("/categories").then((r) => r.data.data || r.data),
  });
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.get("/suppliers").then((r) => r.data.data || r.data),
  });

  const tabSubtitles = {
    list: "View, search and manage your full product catalogue",
    import: "Import products via CSV or export your catalogue",
    "bulk-price": "Apply price adjustments across categories",
  };

  return (
    <div style={styles.page}>
      {/* Breadcrumb */}
      <div style={styles.breadcrumb}>
        <span style={styles.breadcrumbItem}>Inventory</span>
        <span style={styles.breadcrumbSep}>/</span>
        <span style={styles.breadcrumbActive}>{TABS.find((t) => t.id === activeTab)?.label}</span>
      </div>

      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Products</h1>
          <p style={styles.pageSubtitle}>{tabSubtitles[activeTab]}</p>
        </div>
      </div>

      {/* Tab bar */}
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
        {activeTab === "list" && <ProductListTab categories={categories} suppliers={suppliers} />}
        {activeTab === "import" && <ImportExportTab />}
        {activeTab === "bulk-price" && <BulkPriceTab categories={categories} />}
      </div>
    </div>
  );
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function downloadCSV(res) {
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = "edlp-products.csv";
  a.click();
}

function Field({ label, error, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={styles.label}>{label}</label>
      {children}
      {error && <span style={styles.errText}>{error}</span>}
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
  tabBar: { display: "flex", gap: 2, borderBottom: "1.5px solid #E4EAF0", marginBottom: 24, paddingBottom: 0 },
  tabBtn: {
    padding: "9px 20px", fontSize: 13, fontWeight: 600, border: "none",
    background: "transparent", color: "#8A9AB5", cursor: "pointer",
    borderBottom: "2px solid transparent", marginBottom: -1.5,
    borderRadius: "6px 6px 0 0", transition: "all .15s",
  },
  tabBtnActive: { color: "#0A1628", borderBottomColor: "#E8A020", background: "#FFFDF7" },
  tabContent: { background: "#fff", borderRadius: 12, border: "0.5px solid rgba(26,47,90,.12)", padding: 24, minHeight: 400 },
  toolbar: { display: "flex", gap: 12, marginBottom: 18, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" },
  tableWrap: { overflowX: "auto", borderRadius: 8, border: "0.5px solid #E4EAF0" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  thead: { background: "#F8FAFC" },
  th: { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "#8A9AB5", whiteSpace: "nowrap" },
  tr: { borderBottom: "0.5px solid #F0F4F8" },
  td: { padding: "11px 14px", verticalAlign: "middle" },
  emptyCell: { textAlign: "center", padding: 40, color: "#8A9AB5", fontSize: 13 },
  input: { width: "100%", padding: "8px 12px", borderRadius: 7, border: "1px solid #D0DAE8", fontSize: 13, color: "#1C2B3A", background: "#fff", outline: "none" },
  label: { fontSize: 12, fontWeight: 600, color: "#3A4A5C" },
  errText: { fontSize: 11, color: "#C0392B" },
  errBox: { background: "#FDECEA", color: "#C0392B", padding: "10px 14px", borderRadius: 7, fontSize: 12 },
  badge: { fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 5, whiteSpace: "nowrap" },
  code: { fontSize: 11, background: "#F4F6FA", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace", color: "#3A4A5C" },
  productThumb: { width: 36, height: 36, borderRadius: 6, background: "#F4F6FA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 },
  btnPrimary: { padding: "9px 20px", background: "#0A1628", color: "#E8A020", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  btnSecondary: { padding: "9px 14px", background: "#F4F6FA", color: "#3A4A5C", border: "1px solid #D0DAE8", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  btnOutline: { padding: "8px 16px", background: "transparent", color: "#0A1628", border: "1.5px solid #0A1628", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  actionBtn: { padding: "4px 12px", fontSize: 11, fontWeight: 600, background: "#F4F6FA", color: "#3A4A5C", border: "1px solid #D0DAE8", borderRadius: 5, cursor: "pointer" },
  pagination: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, padding: "0 2px" },
  pageBtn: { padding: "5px 12px", fontSize: 12, fontWeight: 600, background: "#F4F6FA", color: "#3A4A5C", border: "1px solid #D0DAE8", borderRadius: 6, cursor: "pointer" },
  pageBtnActive: { background: "#0A1628", color: "#E8A020", borderColor: "#0A1628" },
  overlay: { position: "fixed", inset: 0, background: "rgba(10,22,40,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(2px)" },
  modal: { background: "#fff", borderRadius: 14, width: "100%", margin: 20, boxShadow: "0 20px 60px rgba(10,22,40,.25)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 24px 0" },
  modalTitle: { fontSize: 17, fontWeight: 800, color: "#0A1628" },
  modalSub: { fontSize: 12, color: "#8A9AB5", marginTop: 3 },
  closeBtn: { width: 30, height: 30, borderRadius: "50%", border: "none", background: "#F4F6FA", color: "#8A9AB5", fontSize: 13, cursor: "pointer" },
  form: { padding: 24, display: "flex", flexDirection: "column", gap: 16 },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  modalFooter: { display: "flex", gap: 10, justifyContent: "flex-end" },
  importCard: { padding: 22, borderRadius: 10, border: "0.5px solid #E4EAF0", background: "#FAFBFD" },
  importCardTitle: { fontSize: 15, fontWeight: 700, color: "#0A1628", marginBottom: 10 },
  infoBox: { padding: "12px 16px", borderRadius: 8, fontSize: 13, background: "#FEF0E6", color: "#C45A00", border: "1px solid #FAD5A0", lineHeight: 1.5 },
};
