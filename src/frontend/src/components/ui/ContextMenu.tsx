import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type ContextMenuItemDef =
  | {
      id: string;
      label: string;
      icon?: string;
      destructive?: boolean;
      disabled?: boolean;
      disabledReason?: string;
      // Modal/popover actions can keep the parent mounted after the click.
      closeOnClick?: boolean;
      onClick: () => void;
    }
  | { id: string; separator: true };

type Props = {
  x: number;
  y: number;
  items: ContextMenuItemDef[];
  onClose: () => void;
};

export function ContextMenu({ x, y, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  // Clamp to viewport so menu never renders off-screen
  const adjustedX = Math.min(x, window.innerWidth  - 220);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 36 - 16);

  const menu = (
    <div
      ref={menuRef}
      className="ctx-menu"
      role="menu"
      style={{ left: adjustedX, top: adjustedY }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => {
        if ("separator" in item) {
          return <div key={item.id} className="ctx-menu-sep" role="separator" />;
        }
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className={[
              "ctx-menu-item",
              item.destructive  ? "ctx-menu-item--destructive" : "",
              item.disabled     ? "ctx-menu-item--disabled"    : "",
            ].filter(Boolean).join(" ")}
            disabled={item.disabled}
            title={item.disabled ? item.disabledReason : undefined}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                if (item.closeOnClick !== false) {
                  onClose();
                }
              }
            }}
          >
            {item.icon && <span className="ctx-menu-item-icon" aria-hidden>{item.icon}</span>}
            <span className="ctx-menu-item-label">{item.label}</span>
            {item.disabled && item.disabledReason && (
              <span className="ctx-menu-item-reason">{item.disabledReason}</span>
            )}
          </button>
        );
      })}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(menu, document.body);
}
