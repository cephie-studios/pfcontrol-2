import { ADMIN_SECTION_TITLE } from "./adminConstants";

export default function AdminSectionTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`${ADMIN_SECTION_TITLE} ${className}`.trim()}>{children}</h2>
  );
}