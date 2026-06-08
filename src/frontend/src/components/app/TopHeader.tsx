import { roleLabels } from "@/types/auth";
import { useAuth } from "@/state/auth";

export function TopHeader() {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <header className="top-header">
      <div>
        <p className="eyebrow">{user.tenantName}</p>
        <h1>{roleLabels[user.role]} Workspace</h1>
      </div>

      <div className="user-block">
        <span>{user.name}</span>
        <button className="ghost-button" type="button" onClick={logout}>
          Sign out
        </button>
      </div>
    </header>
  );
}
