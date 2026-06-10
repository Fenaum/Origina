import { NotificationBell } from "@/components/app/NotificationBell";
import { roleLabels } from "@/types/auth";
import { useAuth } from "@/state/auth";

export function TopHeader() {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  const initials = user.name
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="top-header">
      <div>
        <p className="eyebrow">{user.tenantName}</p>
        <h1>{roleLabels[user.role]} Workspace</h1>
      </div>

      <div className="user-block">
        <NotificationBell />
        <div className="user-avatar" aria-label={user.name} title={user.name}>
          {initials}
        </div>
        <span className="user-name">{user.name}</span>
        <button className="ghost-button" type="button" onClick={logout}>
          Sign out
        </button>
      </div>
    </header>
  );
}
