export function adminCardClass(extra = "") {
  return `rounded-2xl border border-zinc-800 bg-zinc-900/90 backdrop-blur-xl p-5 xl:p-7 shadow-xl ring-1 ring-zinc-700/50${extra ? ` ${extra}` : ""}`;
}

export function adminSectionClass(extra = "") {
  return `border-t border-zinc-800/80 pt-5 xl:pt-6 mt-5 xl:mt-6 first:border-t-0 first:pt-0 first:mt-0${extra ? ` ${extra}` : ""}`;
}

export function adminStatStripItemClass() {
  return "min-w-0";
}

export const ADMIN_TOOLBAR_HEIGHT = "h-10 xl:h-11";

export const ADMIN_INPUT_ICON_CLASS =
  "absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none z-10 flex items-center justify-center";

export const ADMIN_SEARCH_INPUT = `box-border ${ADMIN_TOOLBAR_HEIGHT} w-full text-sm xl:text-base font-medium pl-11 pr-4 rounded-full border-2 border-blue-600 bg-gray-800 text-white placeholder-zinc-400 focus:outline-none focus:border-blue-400 transition-colors appearance-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden`;

export const ADMIN_FIELD_INPUT = `box-border ${ADMIN_TOOLBAR_HEIGHT} w-full text-sm xl:text-base font-medium px-4 rounded-full border-2 border-blue-600 bg-gray-800 text-white placeholder-zinc-400 focus:outline-none focus:border-blue-400 transition-colors`;

export const ADMIN_FIELD_INPUT_ICON = `${ADMIN_FIELD_INPUT} pl-11`;

export const ADMIN_DATETIME_INPUT = `${ADMIN_FIELD_INPUT} pr-3 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-80`;

export const ADMIN_DATETIME_INPUT_ICON = `${ADMIN_DATETIME_INPUT} pl-11`;

export function adminTableShellClass(extra = "") {
  return `rounded-xl border border-zinc-800/60 overflow-hidden bg-zinc-900/30${extra ? ` ${extra}` : ""}`;
}

export const ADMIN_SECTION_TITLE =
  "text-sm xl:text-base font-semibold text-zinc-200 mb-3";

export function adminDownsizeButtonSize(
  size?: "icon" | "xs" | "sm" | "md" | "lg"
): "icon" | "xs" | "sm" | "md" | "lg" {
  if (!size || size === "md") return "sm";
  if (size === "sm") return "xs";
  if (size === "lg") return "md";
  return size;
}

export const ADMIN_PAGE_BG = "min-h-screen bg-zinc-950 text-white";

export const ADMIN_HEADING =
  "text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-blue-600 font-extrabold";

export type AdminPageAccent =
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "cyan"
  | "purple"
  | "rose"
  | "orange"
  | "amber"
  | "indigo";

const ACCENT_TITLE_GRADIENT: Record<AdminPageAccent, string> = {
  blue: "from-blue-400 to-blue-600",
  green: "from-green-400 to-green-600",
  yellow: "from-yellow-400 to-yellow-600",
  red: "from-red-400 to-red-600",
  cyan: "from-cyan-400 to-cyan-600",
  purple: "from-purple-400 to-purple-600",
  rose: "from-rose-400 to-rose-600",
  orange: "from-orange-400 to-orange-600",
  amber: "from-amber-400 to-amber-600",
  indigo: "from-indigo-400 to-indigo-600",
};

const ACCENT_ICON: Record<AdminPageAccent, string> = {
  blue: "text-blue-400",
  green: "text-green-400",
  yellow: "text-yellow-400",
  red: "text-red-400",
  cyan: "text-cyan-400",
  purple: "text-purple-400",
  rose: "text-rose-400",
  orange: "text-orange-400",
  amber: "text-amber-400",
  indigo: "text-indigo-400",
};

export function adminPageTitleClass(accent: AdminPageAccent = "blue") {
  return `text-2xl sm:text-3xl lg:text-4xl xl:text-5xl text-transparent bg-clip-text bg-linear-to-r ${ACCENT_TITLE_GRADIENT[accent]} font-extrabold`;
}

export function adminPageIconClass(accent: AdminPageAccent = "blue") {
  return ACCENT_ICON[accent];
}

export const ADMIN_TOGGLE_TRACK_ON = "bg-blue-600";
export const ADMIN_TOGGLE_TRACK_OFF = "bg-zinc-600";
export const ADMIN_SEGMENT_ACTIVE = "bg-blue-600 text-white";
export const ADMIN_SEGMENT_INACTIVE =
  "text-zinc-400 hover:text-white hover:bg-zinc-800/50";
export const ADMIN_TOGGLE_CHECKBOX_ON = "bg-blue-600 border-blue-600";
export const ADMIN_TOGGLE_BADGE_ACTIVE =
  "px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30";
export const ADMIN_TOGGLE_ICON_ACTIVE = "bg-blue-500/20 text-blue-400";

export const ADMIN_CHECKBOX = "rounded border-zinc-600 accent-blue-600";

export const ADMIN_TABLE_HEAD = "bg-zinc-900";

export const ADMIN_TH =
  "py-2 px-3 xl:py-3 xl:px-4 text-left text-xs xl:text-sm font-medium text-zinc-400 uppercase tracking-wider";

export const ADMIN_TD =
  "py-2 px-3 xl:py-3 xl:px-4 text-sm xl:text-base text-zinc-300";

export const NAV_ACTIVE_COLORS: Record<string, string> = {
  "green-400": "text-green-400",
  "yellow-400": "text-yellow-400",
  "cyan-400": "text-cyan-400",
  "indigo-400": "text-indigo-400",
  "red-400": "text-red-400",
  "rose-400": "text-rose-400",
  "blue-400": "text-blue-400",
  "purple-400": "text-purple-400",
  "orange-400": "text-orange-400",
  "amber-400": "text-amber-400",
};

export function navActiveClass(textColor?: string): string {
  if (!textColor) return "text-blue-400";
  return NAV_ACTIVE_COLORS[textColor] ?? "text-blue-400";
}

export function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active" || s === "approved" || s === "success") {
    return "bg-emerald-950/55 text-emerald-300 ring-1 ring-emerald-800/40";
  }
  if (s === "pending") {
    return "bg-amber-950/50 text-amber-200 ring-1 ring-amber-800/35";
  }
  if (
    s === "revoked" ||
    s === "rejected" ||
    s === "suspended" ||
    s === "banned"
  ) {
    return "bg-red-950/40 text-red-300 ring-1 ring-red-900/40";
  }
  return "bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700/50";
}

export const ADMIN_TOOLBAR_MOBILE_COL =
  "max-md:flex-col max-md:items-stretch max-md:gap-2";

export const ADMIN_TOOLBAR_MOBILE_SEARCH =
  "max-md:!w-full max-md:!max-w-none max-md:flex-none max-md:basis-full";

export const ADMIN_TOOLBAR_MOBILE_SPLIT_ROW =
  "md:contents max-md:w-full max-md:flex max-md:items-center max-md:gap-2 max-md:[&>*]:flex-1 max-md:[&>*]:min-w-0";

export const ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM = "max-md:flex-1 max-md:min-w-0";

export const ADMIN_TOOLBAR_MOBILE_PAIR =
  "md:contents max-md:flex max-md:w-full max-md:gap-2 max-md:items-center max-md:[&>*]:flex-1 max-md:[&>*]:min-w-0";

export const ADMIN_TOOLBAR_MOBILE_STACK_ITEM =
  "max-md:w-full max-md:max-w-none max-md:flex-none max-md:basis-full";

export const ADMIN_HEADER_ACTIONS_MOBILE =
  "max-md:basis-full max-md:w-full max-md:ml-0 max-md:justify-stretch max-md:[&_button]:flex-1 max-md:[&_button]:min-w-0";
