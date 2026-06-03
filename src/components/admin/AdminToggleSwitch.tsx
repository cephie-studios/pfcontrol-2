import {
  ADMIN_TOGGLE_TRACK_OFF,
  ADMIN_TOGGLE_TRACK_ON,
} from './adminConstants';

type AdminToggleSwitchProps = {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  'aria-label': string;
};

export default function AdminToggleSwitch({
  checked,
  onChange,
  disabled = false,
  'aria-label': ariaLabel,
}: AdminToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      disabled={disabled}
      className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:opacity-50 ${
        checked ? ADMIN_TOGGLE_TRACK_ON : ADMIN_TOGGLE_TRACK_OFF
      }`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
