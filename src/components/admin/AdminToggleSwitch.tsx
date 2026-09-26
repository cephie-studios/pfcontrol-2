import { Switch } from '@/components/ui/switch';

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
    <Switch
      checked={checked}
      onCheckedChange={() => onChange()}
      disabled={disabled}
      aria-label={ariaLabel}
    />
  );
}
