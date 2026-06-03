import { MdRefresh, MdSearch } from "react-icons/md";
import { ADMIN_INPUT_ICON_CLASS, ADMIN_SEARCH_INPUT } from "./adminConstants";

type AdminSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  className?: string;
  grow?: boolean;
};

export default function AdminSearchInput({
  value,
  onChange,
  placeholder = "Search…",
  loading = false,
  className = "",
  grow = true,
}: AdminSearchInputProps) {
  return (
    <div
      className={`relative flex items-center ${grow ? "flex-1 min-w-[12rem] max-w-md" : "w-full sm:w-56"} ${className}`}
    >
      <span className={ADMIN_INPUT_ICON_CLASS} aria-hidden>
        <MdSearch size={18} />
      </span>
      {loading && (
        <MdRefresh
          size={16}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-400 animate-spin z-10"
        />
      )}
      <input
        type="text"
        role="searchbox"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${ADMIN_SEARCH_INPUT} ${loading ? "!pr-10" : ""}`}
      />
    </div>
  );
}