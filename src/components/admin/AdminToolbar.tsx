import type { ReactNode } from "react";

type AdminToolbarProps = {
  children: ReactNode;
  className?: string;
};

export default function AdminToolbar({
  children,
  className = "",
}: AdminToolbarProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 mb-4 ${className}`.trim()}
      role="toolbar"
    >
      {children}
    </div>
  );
}
