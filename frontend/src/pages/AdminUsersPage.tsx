import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createAdminUser,
  deleteAdminUser,
  fetchAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
  type AdminUser,
} from "../api/adminUsers";
import { clearAccessToken, getMe } from "../api/auth";

type UserRole = "reader" | "author" | "admin";

const ROLE_OPTIONS: UserRole[] = ["reader", "author", "admin"];

export default function AdminUsersPage() {
  const navigate = useNavigate();

  const [isAuthReady, setIsAuthReady] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currentUsername, setCurrentUsername] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [editingUsername, setEditingUsername] = useState("");
  const [editingDisplayName, setEditingDisplayName] = useState("");

  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("reader");
  const [newBio, setNewBio] = useState("");

  useEffect(() => {
    async function checkLogin() {
      try {
        const user = await getMe();

        if (user.role !== "admin") {
          navigate("/admin/login", { replace: true });
          return;
        }

        setCurrentUsername(user.username);
        setIsAuthReady(true);
      } catch {
        clearAccessToken();
        navigate("/admin/login", { replace: true });
      }
    }

    checkLogin();
  }, [navigate]);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    loadUsers();
  }, [isAuthReady]);

  async function loadUsers() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const data = await fetchAdminUsers();
      setUsers(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载用户失败");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setErrorMessage("");

    try {
      await createAdminUser({
        username: newUsername.trim(),
        displayName: newDisplayName.trim(),
        password: newPassword,
        role: newRole,
        bio: newBio,
      });

      setMessage(`已创建用户：${newUsername.trim()}`);
      setNewUsername("");
      setNewDisplayName("");
      setNewPassword("");
      setNewRole("reader");
      setNewBio("");

      await loadUsers();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "创建用户失败");
    }
  }

  async function handleChangeRole(user: AdminUser, role: UserRole) {
    if (user.username === currentUsername) {
      setErrorMessage("不能修改当前登录用户权限");
      return;
    }
    setMessage("");
    setErrorMessage("");

    try {
      await updateAdminUser(user.username, { role });
      setMessage(`已修改 ${user.username} 的权限为 ${role}`);
      await loadUsers();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "修改权限失败");
    }
  }

  function startEditDisplayName(user: AdminUser) {
      setEditingUsername(user.username);
      setEditingDisplayName(user.displayName);
      setMessage("");
      setErrorMessage("");
    }

    function cancelEditDisplayName() {
      setEditingUsername("");
      setEditingDisplayName("");
    }

    async function saveDisplayName(user: AdminUser) {
      const trimmedDisplayName = editingDisplayName.trim();

      if (!trimmedDisplayName) {
        setErrorMessage("显示名不能为空");
        return;
      }

      setMessage("");
      setErrorMessage("");

      try {
        await updateAdminUser(user.username, {
          displayName: trimmedDisplayName,
        });

        setMessage(`已修改 ${user.username} 的显示名`);
        setEditingUsername("");
        setEditingDisplayName("");
        await loadUsers();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "修改显示名失败");
      }
    }

  async function handleToggleActive(user: AdminUser) {
    if (user.username === currentUsername) {
      setErrorMessage("不能停用当前登录用户");
      return;
    }
    setMessage("");
    setErrorMessage("");

    try {
      await updateAdminUser(user.username, { isActive: !user.isActive });
      setMessage(
        user.isActive
          ? `已停用用户：${user.username}`
          : `已启用用户：${user.username}`,
      );
      await loadUsers();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "修改状态失败");
    }
  }

  async function handleResetPassword(user: AdminUser) {
    const password = window.prompt(`请输入 ${user.username} 的新密码，至少 6 位：`);

    if (!password) {
      return;
    }

    setMessage("");
    setErrorMessage("");

    try {
      await resetAdminUserPassword(user.username, { password });
      setMessage(`已重置 ${user.username} 的密码`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "重置密码失败");
    }
  }

  async function handleDeleteUser(user: AdminUser) {
    if (user.username === currentUsername) {
      setErrorMessage("不能删除当前登录用户");
      return;
    }

    const confirmUsername = window.prompt(
      `危险操作：请输入要删除的用户名：${user.username}`,
    );

    if (confirmUsername === null) {
      return;
    }

    const adminPassword = window.prompt("请输入当前管理员密码以确认删除：");

    if (adminPassword === null) {
      return;
    }

    setMessage("");
    setErrorMessage("");

    try {
      await deleteAdminUser(user.username, {
        confirmUsername,
        adminPassword,
      });

      setMessage(`已删除用户：${user.username}`);
      await loadUsers();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除用户失败");
    }
  }

  if (!isAuthReady) {
    return (
      <main className="admin-page-shell px-6 py-10">
        <section className="mx-auto max-w-6xl">
          <p className="text-sm text-soft">正在检查登录状态...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page-shell px-6 py-10">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              to="/admin"
              className="text-sm link-accent transition"
            >
              ← 返回后台
            </Link>
            <p className="mt-5 text-sm text-soft">Admin Console</p>
            <h1 className="mt-2 text-3xl font-semibold text-main">用户管理</h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              创建用户、调整权限、停用账号、重置密码或删除测试账号。
            </p>
          </div>

          <button
            type="button"
            onClick={loadUsers}
            className="admin-button-secondary px-4 py-2 text-sm font-semibold transition"
          >
            刷新列表
          </button>
        </div>

        {message && (
          <p className="admin-message-success mt-6 px-4 py-3 text-sm">
            {message}
          </p>
        )}

        {errorMessage && (
          <p className="admin-message-error mt-6 px-4 py-3 text-sm">
            {errorMessage}
          </p>
        )}

        <section className="admin-section mt-8">
          <h2 className="text-xl font-semibold text-main">创建用户</h2>

          <form
            onSubmit={handleCreateUser}
            className="mt-5 grid gap-4 md:grid-cols-2"
          >
            <label className="block">
              <span className="text-sm text-muted">用户名</span>
              <input
                value={newUsername}
                onChange={(event) => setNewUsername(event.target.value)}
                className="admin-input mt-2 w-full px-4 py-3"
                placeholder="例如 test01"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm text-muted">显示名</span>
              <input
                value={newDisplayName}
                onChange={(event) => setNewDisplayName(event.target.value)}
                className="admin-input mt-2 w-full px-4 py-3"
                placeholder="例如 测试用户"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm text-muted">初始密码</span>
              <input
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                className="admin-input mt-2 w-full px-4 py-3"
                placeholder="至少 6 位"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm text-muted">角色</span>
              <select
                value={newRole}
                onChange={(event) => setNewRole(event.target.value as UserRole)}
                className="admin-select mt-2 w-full px-4 py-3"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm text-muted">简介</span>
              <textarea
                value={newBio}
                onChange={(event) => setNewBio(event.target.value)}
                className="admin-textarea mt-2 min-h-24 w-full px-4 py-3"
                placeholder="可以先留空"
              />
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="admin-button-primary px-5 py-3 font-semibold transition"
              >
                创建用户
              </button>
            </div>
          </form>
        </section>

        <section className="admin-section mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-main">用户列表</h2>
            {isLoading && (
              <span className="text-sm text-soft">加载中...</span>
            )}
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[850px] border-separate border-spacing-y-3 text-left text-sm">
              <thead className="text-soft">
                <tr>
                  <th className="px-4 py-2 font-medium">用户名</th>
                  <th className="px-4 py-2 font-medium">显示名</th>
                  <th className="px-4 py-2 font-medium">角色</th>
                  <th className="px-4 py-2 font-medium">状态</th>
                  <th className="px-4 py-2 font-medium">简介</th>
                  <th className="px-4 py-2 font-medium">操作</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="admin-muted-panel">
                    <td className="rounded-l-2xl px-4 py-4 align-top">
                      <div className="font-semibold text-main">
                        {user.username}
                      </div>
                      {user.username === currentUsername && (
                        <div className="mt-1 text-xs text-soft">
                          当前登录
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4 align-top text-muted">
                      {editingUsername === user.username ? (
                        <div className="flex items-center gap-2">
                          <input
                              value={editingDisplayName}
                              onChange={(event) => setEditingDisplayName(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  saveDisplayName(user);
                                }

                                if (event.key === "Escape") {
                                  cancelEditDisplayName();
                                }
                              }}
                              className="admin-input w-40 px-3 py-2 text-sm"
                              autoFocus
                            />

                          <button
                            type="button"
                            onClick={() => saveDisplayName(user)}
                            className="admin-button-secondary px-2 py-1 text-xs font-semibold transition"
                            title="保存"
                          >
                            ✓
                          </button>

                          <button
                            type="button"
                            onClick={cancelEditDisplayName}
                            className="admin-button-danger px-2 py-1 text-xs font-semibold transition"
                            title="取消"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditDisplayName(user)}
                          className="group inline-flex items-center gap-2 text-left text-muted"
                          title="修改显示名"
                        >
                          <span className="group-hover:underline">{user.displayName}</span>
                          <span className="text-xs text-soft transition group-hover:text-muted">
                            ✎
                          </span>
                        </button>
                      )}
                    </td>

                    <td className="px-4 py-4 align-top">
                      <select
                        value={user.role}
                        onChange={(event) =>
                          handleChangeRole(user, event.target.value as UserRole)
                        }
                        disabled={user.username === currentUsername}
                        className="admin-select px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <span
                        className={
                          user.isActive
                            ? "message-success px-3 py-1 text-xs"
                            : "admin-muted-panel px-3 py-1 text-xs text-soft"
                        }
                      >
                        {user.isActive ? "启用" : "停用"}
                      </span>
                    </td>

                    <td className="max-w-xs px-4 py-4 align-top text-soft">
                      {user.bio || "—"}
                    </td>

                    <td className="rounded-r-2xl px-4 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(user)}
                          disabled={user.username === currentUsername}
                          className="admin-button-secondary px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {user.isActive ? "停用" : "启用"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleResetPassword(user)}
                          className="admin-button-secondary px-3 py-2 text-xs font-semibold transition"
                        >
                          重置密码
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteUser(user)}
                          disabled={user.username === currentUsername}
                          className="admin-button-danger px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {users.length === 0 && !isLoading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="admin-muted-panel px-4 py-8 text-center text-soft"
                    >
                      暂无用户
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
