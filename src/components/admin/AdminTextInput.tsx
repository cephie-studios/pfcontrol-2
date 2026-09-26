import { useId, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type AdminTextInputProps = {
  label?: string;
  icon?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'datetime-local' | 'date' | 'search' | 'number' | 'url';
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  required?: boolean;
  'aria-label'?: string;
};

export default function AdminTextInput({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  className,
  inputClassName,
  required = false,
  'aria-label': ariaLabel,
}: AdminTextInputProps) {
  const id = useId();
  const isDate = type === 'datetime-local' || type === 'date';

  const input = (
    <Input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      aria-label={ariaLabel ?? label}
      className={cn(
        icon && 'pl-8',
        isDate && '[color-scheme:dark]',
        inputClassName
      )}
    />
  );

  return (
    <div className={cn('grid gap-2', className)}>
      {label ? (
        <Label htmlFor={id}>
          {label}
          {required ? <span className="text-destructive">*</span> : null}
        </Label>
      ) : null}
      {icon ? (
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-2.5 flex -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
            {icon}
          </span>
          {input}
        </div>
      ) : (
        input
      )}
    </div>
  );
}
