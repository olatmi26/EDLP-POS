import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from '../../lib/api'// your axios instance
import { UserCog, Camera, BarChart2, Power } from "lucide-react";

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) => (d ? new Date(d).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "—");
const fmtDuration = (loginAt) => {
  if (!loginAt) return "—";
  const secs = Math.floor((Date.now() - new Date(loginAt)) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
};

const ROLES = ["super-admin", "admin", "branch-manager", "accountant", "cashier"];
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

function EditUserModal({ user, branches, onClose }) {
  const qc = useQueryClient();

  const schema = z.object({
    name: z.string().min(2, "Name required"),
    email: z.string().email("Valid email required"),
    role: z.string().min(1, "Select a role"),
    branch_id: z.string().optional().or(z.literal("")),
    pin_login_enabled: z.boolean().optional(),
    pin: z.string().optional().or(z.literal("")),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user.name || "",
      email: user.email || "",
      role: (typeof user.roles?.[0] === "string" ? user.roles?.[0] : user.roles?.[0]?.name) || "",
      branch_id: user.branch?.id ? String(user.branch.id) : "",
      pin_login_enabled: Boolean(user.pin_login_enabled),
      pin: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data) => {
      const payload = { ...data };
      if (!payload.pin) delete payload.pin;
      if (!payload.branch_id) payload.branch_id = null;
      return api.put(`/users/${user.id}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-users"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      reset();
      onClose();
    },
  });

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalTitle}>Edit User</div>
            <div style={styles.modalSub}>Update account info and PIN access</div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form
          onSubmit={handleSubmit((d) => mutation.mutate(d))}
          style={styles.form}
        >
          <div style={styles.row2}>
            <Field label="Full Name" error={errors.name?.message}>
              <input
                style={styles.input}
                placeholder="Full name"
                {...register("name")}
              />
            </Field>
            <Field label="Email Address" error={errors.email?.message}>
              <input
                style={styles.input}
                type="email"
                placeholder="Email"
                {...register("email")}
              />
            </Field>
          </div>

          <div style={styles.row2}>
            <Field label="Role" error={errors.role?.message}>
              <select style={styles.input} {...register("role")}>
                <option value="">Select role…</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Branch">
              <select style={styles.input} {...register("branch_id")}>
                <option value="">All branches</option>
                {(branches || []).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="PIN Login (6 digits)">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  {...register("pin_login_enabled")}
                />
                <span style={{ fontSize: 13 }}>Enable PIN login</span>
              </label>
              {watch("pin_login_enabled") && (
                <input
                  style={{ ...styles.input, maxWidth: 120 }}
                  type="password"
                  maxLength={6}
                  placeholder="New 6-digit PIN"
                  {...register("pin")}
                />
              )}
            </div>
          </Field>

          {mutation.isError && (
            <div style={styles.errBox}>
              {mutation.error?.response?.data?.message || "Failed to update user."}
            </div>
          )}

          <div style={styles.modalFooter}>
            <button
              type="button"
              style={styles.btnSecondary}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={styles.btnPrimary}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UploadAvatarModal({ user, onClose }) {
  const qc = useQueryClient();
  const [file, setFile] = useState(null);

  const mutation = useMutation({
    mutationFn: () => {
      const form = new FormData();
      if (file) form.append("avatar", file);
      return api.post(`/users/${user.id}/avatar`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-users"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
  });

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalTitle}>Upload Avatar</div>
            <div style={styles.modalSub}>Update profile photo for {user.name}</div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (file) mutation.mutate();
          }}
          style={styles.form}
        >
          <Field label="Avatar image">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>

          {mutation.isError && (
            <div style={styles.errBox}>
              {mutation.error?.response?.data?.message || "Failed to upload avatar."}
            </div>
          )}

          <div style={styles.modalFooter}>
            <button
              type="button"
              style={styles.btnSecondary}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={styles.btnPrimary}
              disabled={mutation.isPending || !file}
            >
              {mutation.isPending ? "Uploading…" : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CashierStatsModal({ user, onClose }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["cashier-stats", user.id],
    queryFn: () => api.get(`/users/${user.id}/sales-stats`).then((r) => r.data.data || r.data),
    staleTime: 10_000,
  });

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={{
          ...styles.modal,
          maxWidth: 900,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalTitle}>Cashier Performance</div>
            <div style={styles.modalSub}>Sales statistics for {user.name}</div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {isLoading && (
            <div style={styles.emptyState}>Loading cashier stats…</div>
          )}

          {isError && !isLoading && (
            <div style={styles.errBox}>
              Failed to load stats. Check network or permissions.
            </div>
          )}

          {!isLoading && !isError && data && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                {[
                  { key: "today", label: "Today" },
                  { key: "week", label: "This Week" },
                  { key: "month", label: "This Month" },
                  { key: "lifetime", label: "Lifetime" },
                ].map(({ key, label }) => (
                  <div
                    key={key}
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      border: "1px solid #E5EBF2",
                      background: "#F9FAFB",
                    }}
                  >
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "#8A9AB5", marginBottom: 6 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>
                      ₦{Number(data[key]?.total ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                      {data[key]?.count ?? 0} sales
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
function UsersTab({ onAdd, branches }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [avatarUser, setAvatarUser] = useState(null);
  const [statsUser, setStatsUser] = useState(null);

  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["iam-users"],
    queryFn: () => api.get("/users", { params: { active_only: false, per_page: 200 } }).then((r) => r.data.data || r.data),
  });

  const users = (data || []).filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole = !roleFilter || (typeof u.roles?.[0] === "string" ? u.roles?.[0] : u.roles?.[0]?.name) === roleFilter;
    return matchSearch && matchRole;
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/toggle-active`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-users"] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
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
              const role = (typeof u.roles?.[0] === "string" ? u.roles?.[0] : u.roles?.[0]?.name) || "—";
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
                      {/* Edit */}
                      <button
                        type="button"
                        style={styles.iconBtn}
                        title="Edit user"
                        onClick={() => setEditingUser(u)}
                      >
                        <UserCog size={14} />
                      </button>

                      {/* Avatar */}
                      <button
                        type="button"
                        style={styles.iconBtn}
                        title="Upload avatar"
                        onClick={() => setAvatarUser(u)}
                      >
                        <Camera size={14} />
                      </button>

                      {/* Cashier stats */}
                      {role === "cashier" && (
                        <button
                          type="button"
                          style={styles.iconBtn}
                          title="View cashier sales stats"
                          onClick={() => setStatsUser(u)}
                        >
                          <BarChart2 size={14} />
                        </button>
                      )}

                      {/* Activate / Deactivate */}
                      <button
                        type="button"
                        style={{
                          ...styles.iconBtn,
                          color: u.is_active ? "#C0392B" : "#1A6E3A",
                          borderColor: u.is_active ? "#FDECEA" : "#EAF5EE",
                          background: u.is_active ? "#FDECEA" : "#EAF5EE",
                        }}
                        title={u.is_active ? "Deactivate" : "Activate"}
                        onClick={() => toggleActiveMutation.mutate(u.id)}
                      >
                        <Power size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editingUser && (
        <EditUserModal
          user={editingUser}
          branches={branches}
          onClose={() => setEditingUser(null)}
        />
      )}
      {avatarUser && (
        <UploadAvatarModal
          user={avatarUser}
          onClose={() => setAvatarUser(null)}
        />
      )}
      {statsUser && (
        <CashierStatsModal
          user={statsUser}
          onClose={() => setStatsUser(null)}
        />
      )}
    </div>
  );
}

function RolesTab() {
  const [page, setPage] = useState(1)
  const pageSize = 4
  const [showAddRole, setShowAddRole] = useState(false)
  const [roleSearch, setRoleSearch] = useState("")

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["iam-roles"],
    queryFn: () => api.get("/roles").then((r) => r.data.data || r.data),
    retry: 1,
  });

  if (isLoading) return <div style={styles.emptyState}>Loading roles…</div>;
  if (isError) {
    const status = error?.response?.status
    const backendMessage = error?.response?.data?.message
    const hint =
      status === 403
        ? "Your account needs role `admin`, `super-admin`, or `branch-manager` to view roles/permissions."
        : "Check that `GET /api/roles` returns data and your auth token is attached.";

    return (
      <div style={styles.errorBox}>
        Failed to load roles. {hint}
        {backendMessage ? <div style={{ marginTop: 6, fontSize: 12, opacity: 0.95 }}>{backendMessage}</div> : null}
      </div>
    );
  }

  const roles = data || [];
  const filteredRoles = roles.filter((r) =>
    r.name.toLowerCase().includes(roleSearch.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filteredRoles.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedRoles = filteredRoles.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <input
            style={{ ...styles.input, maxWidth: 260 }}
            placeholder="Search roles…"
            value={roleSearch}
            onChange={(e) => { setRoleSearch(e.target.value); setPage(1); }}
          />
          <span style={{ fontSize: 13, color: "#8A9AB5" }}>
            {filteredRoles.length} roles
          </span>
        </div>
        <button
          type="button"
          style={styles.btnPrimary}
          onClick={() => setShowAddRole(true)}
        >
          + Add Role
        </button>
      </div>

      {roles.length === 0 && (
        <div style={styles.emptyState}>No roles found. Run <code>php artisan db:seed --class=RoleSeeder</code> or add a role.</div>
      )}
      {pagedRoles.map((role) => (
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
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8, alignItems: "center" }}>
          <button
            type="button"
            style={styles.btnSecondary}
            disabled={currentPage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span style={{ fontSize: 12, color: "#8A9AB5" }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            style={styles.btnSecondary}
            disabled={currentPage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}

      {showAddRole && (
        <AddRoleModal onClose={() => setShowAddRole(false)} />
      )}
    </div>
  );
}

function PermissionsTab({ authUser }) {
  const queryClient = useQueryClient()
  const [selectedRole, setSelectedRole] = useState(null)
  const [localPerms, setLocalPerms] = useState(null) // Set<string>
  const [dirty, setDirty] = useState(false)

  const isSuperAdmin = authUser?.roles?.some((r) => (typeof r === "string" ? r : r?.name) === "super-admin");

  const rolesQuery = useQuery({
    queryKey: ["iam-roles"],
    queryFn: () => api.get("/roles").then((r) => r.data.data || r.data),
    staleTime: 60_000,
  });

  const permsQuery = useQuery({
    queryKey: ["iam-permissions-all"],
    queryFn: () => api.get("/permissions").then((r) => r.data.data || r.data),
    staleTime: 300_000,
  });

  const rolePermsQuery = useQuery({
    queryKey: ["iam-role-permissions", selectedRole],
    enabled: Boolean(selectedRole),
    queryFn: async () => {
      const r = await api.get(`/roles/${selectedRole}/permissions`)
      const payload = r.data.data || r.data
      if (Array.isArray(payload)) return payload
      return payload?.permissions ?? []
    },
    staleTime: 30_000,
    onSuccess: (perms) => {
      setLocalPerms(new Set(perms))
      setDirty(false)
    },
  })

  const [saveError, setSaveError] = useState(null)
  const syncMutation = useMutation({
    mutationFn: ({ role, permissions }) => api.put(`/roles/${role}/permissions`, { permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iam-role-permissions", selectedRole] })
      setDirty(false)
      setSaveError(null)
    },
    onError: (e) => setSaveError(e?.response?.data?.message ?? "Save failed"),
  })

  const grouped = permsQuery.data?.grouped ?? {}
  const isLocked = selectedRole === "super-admin"
  const canEdit = Boolean(isSuperAdmin && !isLocked)

  function togglePerm(perm) {
    if (!canEdit) return
    setLocalPerms((prev) => {
      const next = new Set(prev ?? [])
      next.has(perm) ? next.delete(perm) : next.add(perm)
      return next
    })
    setDirty(true)
  }

  if (rolesQuery.isLoading || permsQuery.isLoading) {
    return <div style={styles.emptyState}>Loading permissions…</div>
  }

  if (rolesQuery.isError) {
    const status = rolesQuery.error?.response?.status
    const backendMessage = rolesQuery.error?.response?.data?.message
    return (
      <div style={styles.errorBox}>
        Failed to load roles. {status === 403 ? "Not allowed to view roles." : "Please try again."}
        {backendMessage ? <div style={{ marginTop: 6, fontSize: 12, opacity: 0.95 }}>{backendMessage}</div> : null}
      </div>
    )
  }

  if (permsQuery.isError) {
    const status = permsQuery.error?.response?.status
    const backendMessage = permsQuery.error?.response?.data?.message
    return (
      <div style={styles.errorBox}>
        Failed to load permission definitions. {status === 403 ? "Not allowed to view permissions." : "Please try again."}
        {backendMessage ? <div style={{ marginTop: 6, fontSize: 12, opacity: 0.95 }}>{backendMessage}</div> : null}
      </div>
    )
  }

  const roles = rolesQuery.data ?? []

  return (
    <div>
      {!isSuperAdmin && (
        <div style={styles.infoBox}>
          🔒 Only Super Admin can modify role permissions. You can view but not edit.
        </div>
      )}
      {isSuperAdmin && !isLocked && (
        <div style={{ ...styles.infoBox, background: "#EAF5EE", borderColor: "#1A6E3A", color: "#1A6E3A" }}>
          ✅ You can edit role permissions.
        </div>
      )}
      {isLocked && (
        <div style={styles.infoBox}>
          ⚑ Super Admin permissions are managed automatically (read-only).
        </div>
      )}

      {/* Role selector */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
        {roles.map((r) => (
          <button
            key={r.name}
            type="button"
            onClick={() => {
              setSelectedRole(r.name)
              setLocalPerms(null)
              setDirty(false)
              setSaveError(null)
            }}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: `2px solid ${selectedRole === r.name ? "#1A6E3A" : "#D0DAE8"}`,
              background: selectedRole === r.name ? "#EAF5EE" : "#fff",
              color: selectedRole === r.name ? "#1A6E3A" : "#3A4A5C",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {r.name}
          </button>
        ))}
      </div>

      {!selectedRole ? (
        <div style={{ ...styles.emptyState, padding: "24px 20px" }}>
          Select a role to view its current permissions.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0A1628" }}>
              Editing: <span style={{ color: "#1A3FA6" }}>{selectedRole}</span>
            </div>
            <div style={{ fontSize: 12, color: "#8A9AB5" }}>
              {rolePermsQuery.isLoading || !localPerms ? "Loading current grants…" : `${localPerms.size} permissions granted`}
            </div>
            {canEdit && dirty && (
              <button
                type="button"
                style={styles.btnPrimary}
                disabled={syncMutation.isPending}
                onClick={() => {
                  if (!localPerms) return
                  syncMutation.mutate({ role: selectedRole, permissions: [...localPerms] })
                }}
              >
                {syncMutation.isPending ? "Saving…" : "Save Changes"}
              </button>
            )}
          </div>

          {saveError && (
            <div style={{ ...styles.errorBox, marginTop: 12, fontSize: 12 }}>
              {saveError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
            {rolePermsQuery.isLoading && (
              <div style={styles.emptyState}>Loading permission matrix…</div>
            )}
            {!rolePermsQuery.isLoading && !localPerms && (
              <div style={styles.emptyState}>No permissions found for this role.</div>
            )}
            {!rolePermsQuery.isLoading && localPerms && (
              Object.entries(grouped)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([module, perms]) => (
                  <div key={module} style={styles.roleCard}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", color: "#8A9AB5", marginBottom: 10 }}>
                      {module}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {(Array.isArray(perms) ? perms : []).map((perm) => {
                        const granted = isLocked || localPerms.has(perm)
                        const action = String(perm).split(".").slice(1).join(".") || perm
                        return (
                          <button
                            key={perm}
                            type="button"
                            disabled={!canEdit}
                            onClick={() => togglePerm(perm)}
                            style={{
                              padding: "7px 10px",
                              borderRadius: 10,
                              border: `1px solid ${granted ? "#1A6E3A" : "#D0DAE8"}`,
                              background: granted ? "#EAF5EE" : "#F4F6FA",
                              color: granted ? "#1A6E3A" : "#3A4A5C",
                              cursor: canEdit ? "pointer" : "not-allowed",
                              fontSize: 11,
                              fontWeight: 800,
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span style={{ fontSize: 12 }}>{granted ? "✓" : "×"}</span>
                            <span>{action}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

function AddRoleModal({ onClose }) {
  const qc = useQueryClient();

  const schema = z.object({
    name: z.string().min(2, "Role name required"),
    description: z.string().optional().or(z.literal("")),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "" },
  });

  const mutation = useMutation({
    mutationFn: (data) => api.post("/roles", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-roles"] });
      reset();
      onClose();
    },
  });

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalTitle}>Add New Role</div>
            <div style={styles.modalSub}>Define a new access role for IAM</div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form
          onSubmit={handleSubmit((d) => mutation.mutate(d))}
          style={styles.form}
        >
          <Field label="Role Name (slug)" error={errors.name?.message}>
            <input
              style={styles.input}
              placeholder="e.g. warehouse-manager"
              {...register("name")}
            />
          </Field>

          <Field label="Description" error={errors.description?.message}>
            <textarea
              style={{ ...styles.input, minHeight: 60, resize: "vertical" }}
              placeholder="Short description of what this role can do"
              {...register("description")}
            />
          </Field>

          {mutation.isError && (
            <div style={styles.errBox}>
              {mutation.error?.response?.data?.message || "Failed to create role."}
            </div>
          )}

          <div style={styles.modalFooter}>
            <button
              type="button"
              style={styles.btnSecondary}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={styles.btnPrimary}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Creating…" : "Create Role"}
            </button>
          </div>
        </form>
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
        {activeTab === "users" && <UsersTab onAdd={() => setShowAddUser(true)} branches={branches} />}
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
  page: { padding: "20px 24px 28px", maxWidth: "100%", margin: 0 },
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
    padding: "9px 20px", fontSize: 13, fontWeight: 600,
    background: "transparent", color: "#8A9AB5", cursor: "pointer",
    border: "none",
    borderBottomWidth: 2, borderBottomStyle: "solid", borderBottomColor: "transparent",
    marginBottom: -1.5,
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
  iconBtn: {
    width: 30, height: 30, borderRadius: 6,
    border: "1px solid #D0DAE8",
    background: "#F4F6FA",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", color: "#3A4A5C",
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
