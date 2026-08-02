"use client";

import { useEffect, useState, useMemo } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import toast from "react-hot-toast";
import styles from "./UserManagement.module.css";
import config from "@/data/ui/userManagementConfig.json";
import { TableSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const money = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);

  const loadUsers = async (currentUser) => {
    try {
      setLoading(true);
      const token = currentUser
        ? await currentUser.getIdToken()
        : await auth.currentUser?.getIdToken();
      const res = await fetch("/api/team", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal memuat data pengguna.");
      setUsers(result.users || []);
    } catch (err) {
      console.error("Gagal memuat user:", err);
      toast.error(config.toasts.fetchError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) await loadUsers(currentUser);
      else setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const updateUser = async (userId, payload) => {
    try {
      setUpdatingId(userId);
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/team", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, ...payload }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal menyimpan perubahan.");

      // Update state lokal
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, ...payload } : u,
        ),
      );

      if (payload.status === "blocked") {
        toast.success(config.toasts.blockSuccess);
      } else if (payload.status === "active") {
        toast.success(config.toasts.activateSuccess);
      } else {
        toast.success(config.toasts.updateSuccess);
      }
      return true;
    } catch (err) {
      console.error("Gagal update user:", err);
      toast.error(err.message || config.toasts.updateError);
      return false;
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRoleChange = async (user, newRole) => {
    if (user.role === newRole) return;
    await updateUser(user.id, { role: newRole });
  };

  const handleToggleStatus = async (user) => {
    const isBlocking = user.status !== "blocked";
    setConfirmTarget({ user, isBlocking });
  };

  const confirmToggleStatus = async () => {
    if (!confirmTarget) return;
    const { user, isBlocking } = confirmTarget;
    const success = await updateUser(user.id, {
      status: isBlocking ? "blocked" : "active",
    });
    if (success) setConfirmTarget(null);
  };

  const filteredUsers = useMemo(() => {
    let result = users;
    if (statusFilter !== "all") {
      result = result.filter((u) => u.status === statusFilter);
    }
    if (roleFilter !== "all") {
      result = result.filter((u) => u.role === roleFilter);
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          (u.name || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [users, statusFilter, roleFilter, searchQuery]);

  const summary = useMemo(() => {
    const safeStatus = (u) => u.status || "active";
    return {
      total: users.length,
      active: users.filter((u) => safeStatus(u) === "active").length,
      blocked: users.filter((u) => safeStatus(u) === "blocked").length,
      customers: users.filter((u) => (u.role || "customer") === "customer").length,
    };
  }, [users]);

  return (
    <div className={styles.wrapper}>
      {/* Confirmation Modal */}
      {confirmTarget && (
        <div
          className={styles.modalOverlay}
          onClick={() => setConfirmTarget(null)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {confirmTarget.isBlocking
                  ? config.confirm.blockTitle
                  : config.confirm.activateTitle}
              </h3>
              <button
                onClick={() => setConfirmTarget(null)}
                className={styles.modalCloseBtn}
              >
                ✕
              </button>
            </div>
            <p className={styles.modalMessage}>
              {(confirmTarget.isBlocking
                ? config.confirm.blockMessage
                : config.confirm.activateMessage
              ).replace("{name}", confirmTarget.user.name)}
            </p>
            <div className={styles.modalFooter}>
              <button
                onClick={() => setConfirmTarget(null)}
                className={styles.cancelBtn}
              >
                {config.confirm.cancel}
              </button>
              <button
                onClick={confirmToggleStatus}
                disabled={updatingId === confirmTarget.user.id}
                className={
                  confirmTarget.isBlocking ? styles.dangerBtn : styles.confirmBtn
                }
              >
                {updatingId === confirmTarget.user.id
                  ? config.actions.saving
                  : config.confirm.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`card ${styles.cardHeader}`}>
        <div className={styles.headerRow}>
          <div>
            <h3 className={styles.headerTitle}>{config.header.title}</h3>
            <p className={styles.headerSubtitle}>{config.header.subtitle}</p>
          </div>
          <div className={styles.summaryRow}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{summary.total}</span>
              <span className={styles.summaryLabel}>{config.summary.total}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValueSuccess}>{summary.active}</span>
              <span className={styles.summaryLabel}>{config.summary.active}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValueDanger}>{summary.blocked}</span>
              <span className={styles.summaryLabel}>{config.summary.blocked}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{summary.customers}</span>
              <span className={styles.summaryLabel}>{config.summary.customers}</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.controlsRow}>
          <input
            type="text"
            placeholder={config.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">{config.filters.all}</option>
            <option value="active">{config.filters.active}</option>
            <option value="blocked">{config.filters.blocked}</option>
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">{config.filters.roleAll}</option>
            <option value="admin">{config.filters.roleAdmin}</option>
            <option value="staff">{config.filters.roleStaff}</option>
            <option value="customer">{config.filters.roleCustomer}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className={`card ${styles.tableCard}`}>
        {loading ? (
          <div style={{ padding: "1rem 0.25rem" }}>
            <TableSkeleton headers={8} rows={6} />
          </div>
        ) : filteredUsers.length === 0 ? (
          <p className={styles.stateText}>{config.emptyText}</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{config.tableHeaders.customer}</th>
                  <th>{config.tableHeaders.contact}</th>
                  <th>{config.tableHeaders.role}</th>
                  <th>{config.tableHeaders.status}</th>
                  <th>{config.tableHeaders.orders}</th>
                  <th>{config.tableHeaders.points}</th>
                  <th>{config.tableHeaders.joined}</th>
                  <th>{config.tableHeaders.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className={styles.customerCell}>
                        <div className={styles.avatar}>
                          {user.name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div>
                          <span className={styles.customerName}>{user.name}</span>
                          <span className={styles.customerMeta}>
                            @{user.id?.substring(0, 8)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={styles.contactText}>{user.email || "-"}</span>
                      <span className={styles.contactMeta}>{user.phone || "-"}</span>
                    </td>
                    <td>
                      <select
                        className={styles.roleSelect}
                        value={user.role}
                        disabled={updatingId === user.id}
                        onChange={(e) => handleRoleChange(user, e.target.value)}
                      >
                        {config.roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          (user.status || "active") === "blocked"
                            ? styles.statusBlocked
                            : styles.statusActive
                        }`}
                      >
                        {config.statusBadges[user.status || "active"] ||
                          (user.status || "active")}
                      </span>
                    </td>
                    <td>
                      <span className={styles.spendText}>
                        {money(user.totalSpent)}
                      </span>
                    </td>
                    <td>
                      <span className={styles.pointsText}>
                        {Number(user.points || 0).toLocaleString("id-ID")}
                      </span>
                    </td>
                    <td>
                      <span className={styles.joinDate}>
                        {formatDate(user.createdAt)}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionButtons}>
                        {(user.status || "active") === "blocked" ? (
                          <button
                            onClick={() => handleToggleStatus(user)}
                            disabled={updatingId === user.id}
                            className={styles.activateBtn}
                          >
                            {config.actions.activate}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(user)}
                            disabled={updatingId === user.id}
                            className={styles.blockBtn}
                          >
                            {config.actions.block}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

