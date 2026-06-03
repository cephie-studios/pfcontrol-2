import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  adminPageIconClass,
  adminPageTitleClass,
  type AdminPageAccent,
} from "./adminConstants";

type AdminPageHeaderProps = {
  title: string;
  icon?: IconType;
  accent?: AdminPageAccent;
  iconClassName?: string;
  titleClassName?: string;
  actions?: ReactNode;
  actionsClassName?: string;
};

export default function AdminPageHeader({
  title,
  icon: Icon,
  accent = "blue",
  iconClassName,
  titleClassName,
  actions,
  actionsClassName = "",
}: AdminPageHeaderProps) {
  const iconCls = iconClassName ?? adminPageIconClass(accent);
  const titleCls = titleClassName ?? adminPageTitleClass(accent);

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-5 max-md:w-full">
      {Icon && <Icon className={`shrink-0 w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 xl:w-12 xl:h-12 ${iconCls}`} />}
      <h1 className={titleCls}>{title}</h1>
      {actions && (
        <div
          className={`flex flex-wrap items-center gap-2 ml-auto ${actionsClassName}`.trim()}
        >
          {actions}
        </div>
      )}
    </div>
  );
}