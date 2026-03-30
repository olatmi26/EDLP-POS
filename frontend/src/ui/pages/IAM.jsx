import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from '../../lib/api'// your axios instance

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) => (d ? new Date(d).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "—");
const fmtDuration = (loginAt) => {
  if (!loginAt) return "—";
  const secs = Math.floor((Date.now() - new Date(loginAt)) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
};

const ROLES = ["super-admin", "admin", "branch-manager", "cashier"];
const TABS = [
  { id: "users", label: "Users" },
  { id: "roles", label: "Roles" },
  { id: "permissions", label: "Permissions" },
];
const TAB_SUBTITLES = {
  users: "Manage staff accounts, branch assignments and access levels",
  roles: "View and configure role definitions",
  permissions: "Review and configure permission grants per role",
};

const addUserSchema = z.object({
  name: z.string().min(2, "Name required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Min 8 characters"),
  role: z.string().min(1, "Select a role"),
  branch_id: z.string().min(1, "Assign a branch"),
});

// ─── sub-components ───────────────────────────────────────────────────────────
function StatusDot({ online }) {
  return (
    <span
      title={online ? "Currently online" : "Offline"}
      style={{
        display: "inline-block",
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: online ? "#1A6E3A" : "#CBD5E1",
        marginRight: 6,
        flexShrink: 0,
        boxShadow: online ? "0 0 0 2px #EAF5EE" : "none",
      }}
    />
  );
}

function RoleBadge({ role }) {
  const colors = {
    "super-admin": { bg: "#F0ECFB", color: "#5B3FA6" },
    admin: { bg: "#EAF0FB", color: "#1A3FA6" },
    "branch-manager": { bg: "#FEF0E6", color: "#C45A00" },
    cashier: { bg: "#EAF5EE", color: "#1A6E3A" },
  };
  const c = colors[role] || { bg: "#F4F6FA", color: "#8A9AB5" };
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 9px",
        borderRadius: 5,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
    >
      {role}
    </span>
  );
}

function AddUserModal({ open, onClose, branches }) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(addUserSchema) });

  const mutation = useMutation({
    mutationFn: (data) => api.post("/users", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-users"] });
      reset();
      onClose();
    },
  });

  if (!open) return null;
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalTitle}>Add New User</div>
            <div style={styles.modalSub}>Create staff account and assign access</div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} style={styles.form}>
          <div style={styles.row2}>
            <Field label="Full Name" error={errors.name?.message}>
              <input style={styles.input} placeholder="e.g. Amaka Osei" {...register("name")} />
            </Field>
            <Field label="Email Address" error={errors.email?.message}>
              <input style={styles.input} type="email" placeholder="staff@edlp.ng" {...register("email")} />
            </Field>
          </div>
          <div style={styles.row2}>
            <Field label="Password" error={errors.password?.message}>
              <input style={styles.input} type="password" placeholder="Min. 8 characters" {...register("password")} />
            </Field>
            <Field label="Role" error={errors.role?.message}>
              <select style={styles.input} {...register("role")}>
                <option value="">Select role…</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Assign Branch" error={errors.branch_id?.message}>
            <select style={styles.input} {...register("branch_id")}>
              <option value="">Select branch…</option>
              {(branches || []).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </Field>

          {mutation.isError && (
            <div style={styles.errBox}>
              {mutation.error?.response?.data?.message || "Failed to create user."}
            </div>
          )}

          <div style={styles.modalFooter}>
            <button type="button" style={styles.btnSecondary} onClick={onClose}>Cancel</button>
            <button type="submit" style={styles.btnPrimary} disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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

// ─── TABS ─────────────────────────────────────────────────────────────────────
function UsersTab({ onAdd, branches }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["iam-users"],
    queryFn: () => api.get("/users").then((r) => r.data.data || r.data),
  });

  const users = (data || []).filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole = !roleFilter || u.roles?.[0]?.name === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={{ display: "flex", gap: 10, flex: 1 }}>
          <input
            style={{ ...styles.input, maxWidth: 280 }}
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select style={{ ...styles.input, maxWidth: 180 }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button style={styles.btnPrimary} onClick={onAdd}>
          + Add User
        </button>
      </div>

      {/* Table */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thead}>
              <th style={styles.th}>User</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Branch</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Last Login</th>
              <th style={styles.th}>Session Duration</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} style={styles.emptyCell}>Loading users…</td></tr>
            )}
            {!isLoading && users.length === 0 && (
              <tr><td colSpan={7} style={styles.emptyCell}>No users found.</td></tr>
            )}
            {users.map((u) => {
              const isOnline = u.is_online || false;
              const role = u.roles?.[0]?.name || "—";
              return (
                <tr key={u.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={styles.avatar}>{u.name?.[0]?.toUpperCase()}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#1C2B3A" }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: "#8A9AB5" }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}><RoleBadge role={role} /></td>
                  <td style={styles.td}>
                    <span style={{ fontSize: 13 }}>{u.branch?.name || "—"}</span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <StatusDot online={isOnline} />
                      <span style={{ fontSize: 12, color: isOnline ? "#1A6E3A" : "#8A9AB5" }}>
                        {isOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={{ fontSize: 12, color: "#3A4A5C" }}>{fmtDate(u.last_login_at)}</span>
                  </td>
                  <td style={styles.td}>
                    <span style={{ fontSize: 12, color: "#3A4A5C" }}>
                      {isOnline ? fmtDuration(u.last_login_at) : "—"}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={styles.actionBtn}>Edit</button>
                      <button style={{ ...styles.actionBtn, color: "#C0392B", borderColor: "#FDECEA", background: "#FDECEA" }}>
                        Disable
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RolesTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["iam-roles"],
    queryFn: () => api.get("/roles").then((r) => r.data.data || r.data),
    retry: 1,
  });

  if (isLoading) return <div style={styles.emptyState}>Loading roles…</div>;
  if (isError) return (
    <div style={styles.errorBox}>
      Failed to load roles. Check that <code>GET /api/roles</code> returns data and your Sanctum token is attached.
    </div>
  );

  const roles = data || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {roles.length === 0 && (
        <div style={styles.emptyState}>No roles found. Run <code>php artisan db:seed --class=RoleSeeder</code></div>
      )}
      {roles.map((role) => (
        <div key={role.id} style={styles.roleCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1C2B3A", textTransform: "capitalize" }}>
                {role.name}
              </div>
              <div style={{ fontSize: 12, color: "#8A9AB5", marginTop: 3 }}>
                {role.permissions?.length ?? 0} permissions assigned
              </div>
            </div>
            <RoleBadge role={role.name} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
            {(role.permissions || []).slice(0, 12).map((p) => (
              <span key={p.id} style={styles.permChip}>{p.name}</span>
            ))}
            {(role.permissions?.length || 0) > 12 && (
              <span style={{ ...styles.permChip, background: "#F4F6FA", color: "#8A9AB5" }}>
                +{role.permissions.length - 12} more
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PermissionsTab({ authUser }) {
  const isSuperAdmin = authUser?.roles?.some((r) => r.name === "super-admin");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["iam-permissions"],
    queryFn: () => api.get("/permissions").then((r) => r.data),
    retry: 1,
  });

  if (isLoading) return <div style={styles.emptyState}>Loading permissions…</div>;
  if (isError) return (
    <div style={styles.errorBox}>
      Failed to load permissions. Check <code>GET /api/permissions</code> and ensure you are authenticated as Super Admin.
    </div>
  );

  const canEdit = data?.can_edit ?? isSuperAdmin;
  const groups = data?.permissions || data || {};

  return (
    <div>
      {!canEdit && (
        <div style={styles.infoBox}>
          🔒 Only Super Admin can modify role permissions. You can view but not edit.
        </div>
      )}
      {canEdit && (
        <div style={{ ...styles.infoBox, background: "#EAF5EE", borderColor: "#1A6E3A", color: "#1A6E3A" }}>
          ✅ You have full permission management access as Super Admin.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
        {Object.entries(groups).map(([group, perms]) => (
          <div key={group} style={styles.roleCard}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", color: "#8A9AB5", marginBottom: 10 }}>
              {group}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
              {(Array.isArray(perms) ? perms : []).map((perm) => (
                <div key={perm.id || perm} style={styles.permRow}>
                  <span style={styles.permChip}>{perm.name || perm}</span>
                  {canEdit && (
                    <button style={styles.actionBtn}>Manage</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export  function IAMPage() {
  const [activeTab, setActiveTab] = useState("users");
  const [showAddUser, setShowAddUser] = useState(false);

  const { data: authUser } = useQuery({
    queryKey: ["auth-user"],
    queryFn: () => api.get("/me").then((r) => r.data.data || r.data),
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get("/branches").then((r) => r.data.data || r.data),
  });

  return (
    <div style={styles.page}>
      {/* Breadcrumb + dynamic title */}
      <div style={styles.breadcrumb}>
        <span style={styles.breadcrumbItem}>Settings</span>
        <span style={styles.breadcrumbSep}>/</span>
        <span style={styles.breadcrumbItem}>Identity & Access Management</span>
        <span style={styles.breadcrumbSep}>/</span>
        <span style={styles.breadcrumbActive}>{TABS.find((t) => t.id === activeTab)?.label}</span>
      </div>

      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Identity & Access Management</h1>
          <p style={styles.pageSubtitle}>{TAB_SUBTITLES[activeTab]}</p>
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

      {/* Tab content */}
      <div style={styles.tabContent}>
        {activeTab === "users" && (
          <UsersTab onAdd={() => setShowAddUser(true)} branches={branches} />
        )}
        {activeTab === "roles" && <RolesTab />}
        {activeTab === "permissions" && <PermissionsTab authUser={authUser} />}
      </div>

      <AddUserModal
        open={showAddUser}
        onClose={() => setShowAddUser(false)}
        branches={branches}
      />
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = {
  page: { padding: "28px 32px", maxWidth: 1200, margin: "0 auto" },
  breadcrumb: { display: "flex", alignItems: "center", gap: 6, marginBottom: 16, fontSize: 12 },
  breadcrumbItem: { color: "#8A9AB5", fontWeight: 500 },
  breadcrumbSep: { color: "#CBD5E1" },
  breadcrumbActive: { color: "#0A1628", fontWeight: 700 },

  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  pageTitle: { fontSize: 22, fontWeight: 800, color: "#0A1628", letterSpacing: "-.3px" },
  pageSubtitle: { fontSize: 13, color: "#8A9AB5", marginTop: 4 },

  tabBar: {
    display: "flex", gap: 2, borderBottom: "1.5px solid #E4EAF0",
    marginBottom: 24, paddingBottom: 0,
  },
  tabBtn: {
    padding: "9px 20px", fontSize: 13, fontWeight: 600, border: "none",
    background: "transparent", color: "#8A9AB5", cursor: "pointer",
    borderBottom: "2px solid transparent", marginBottom: -1.5,
    borderRadius: "6px 6px 0 0", transition: "all .15s",
  },
  tabBtnActive: { color: "#0A1628", borderBottomColor: "#E8A020", background: "#FFFDF7" },

  tabContent: {
    background: "#fff", borderRadius: 12, border: "0.5px solid rgba(26,47,90,.12)",
    padding: 24, minHeight: 400,
  },

  toolbar: { display: "flex", gap: 12, marginBottom: 18, alignItems: "center", justifyContent: "space-between" },

  tableWrap: { overflowX: "auto", borderRadius: 8, border: "0.5px solid #E4EAF0" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  thead: { background: "#F8FAFC" },
  th: { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "#8A9AB5", whiteSpace: "nowrap" },
  tr: { borderBottom: "0.5px solid #F0F4F8", transition: "background .1s" },
  td: { padding: "12px 14px", verticalAlign: "middle" },

  avatar: {
    width: 34, height: 34, borderRadius: "50%",
    background: "linear-gradient(135deg, #0A1628, #1A2F5A)",
    color: "#E8A020", fontSize: 13, fontWeight: 800,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },

  input: {
    width: "100%", padding: "8px 12px", borderRadius: 7,
    border: "1px solid #D0DAE8", fontSize: 13, color: "#1C2B3A",
    background: "#fff", outline: "none",
  },
  label: { fontSize: 12, fontWeight: 600, color: "#3A4A5C" },
  errText: { fontSize: 11, color: "#C0392B" },
  errBox: { background: "#FDECEA", color: "#C0392B", padding: "10px 14px", borderRadius: 7, fontSize: 12 },
  errorBox: { background: "#FDECEA", color: "#C0392B", padding: 16, borderRadius: 8, fontSize: 13, lineHeight: 1.6 },

  btnPrimary: {
    padding: "9px 20px", background: "#0A1628", color: "#E8A020",
    border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
    cursor: "pointer", whiteSpace: "nowrap",
  },
  btnSecondary: {
    padding: "9px 20px", background: "#F4F6FA", color: "#3A4A5C",
    border: "1px solid #D0DAE8", borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: "pointer",
  },
  actionBtn: {
    padding: "4px 12px", fontSize: 11, fontWeight: 600,
    background: "#F4F6FA", color: "#3A4A5C",
    border: "1px solid #D0DAE8", borderRadius: 5, cursor: "pointer",
  },

  overlay: {
    position: "fixed", inset: 0, background: "rgba(10,22,40,.55)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    backdropFilter: "blur(2px)",
  },
  modal: {
    background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560,
    margin: 20, boxShadow: "0 20px 60px rgba(10,22,40,.25)",
  },
  modalHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    padding: "20px 24px 0",
  },
  modalTitle: { fontSize: 17, fontWeight: 800, color: "#0A1628" },
  modalSub: { fontSize: 12, color: "#8A9AB5", marginTop: 3 },
  closeBtn: {
    width: 30, height: 30, borderRadius: "50%", border: "none",
    background: "#F4F6FA", color: "#8A9AB5", fontSize: 13,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  },
  form: { padding: 24, display: "flex", flexDirection: "column", gap: 16 },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  modalFooter: { display: "flex", gap: 10, justifyContent: "flex-end" },

  emptyState: { textAlign: "center", padding: "40px 20px", color: "#8A9AB5", fontSize: 14 },
  infoBox: {
    padding: "12px 16px", borderRadius: 8, fontSize: 13,
    background: "#EAF0FB", color: "#1A3FA6", border: "1px solid #B8CFF5",
    lineHeight: 1.5,
  },
  roleCard: {
    padding: 18, borderRadius: 10, border: "0.5px solid #E4EAF0",
    background: "#fff",
  },
  permChip: {
    fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 5,
    background: "#EAF0FB", color: "#1A3FA6", whiteSpace: "nowrap",
  },
  permRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  emptyCell: { textAlign: "center", padding: 40, color: "#8A9AB5", fontSize: 13 },
};
