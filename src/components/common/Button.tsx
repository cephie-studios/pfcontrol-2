import { memo } from 'react';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick' | 'type' | 'disabled' | 'className' | 'id'
> {
  children: React.ReactNode;
  onClick?: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  variant?:
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'danger'
    | 'success'
    | 'ghost'
    | 'card';
  size?: 'icon' | 'xs' | 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  id?: string;
  accentColor?: 'green' | 'blue' | 'purple' | 'gray';
}

function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  type = 'button',
  id,
  accentColor = 'blue',
  ...rest
}: ButtonProps) {
  const cardAccents = {
    green: 'hover:border-green-500/50 group-hover:text-green-400',
    blue: 'hover:border-blue-500/50 group-hover:text-blue-400',
    purple: 'hover:border-purple-500/50 group-hover:text-purple-400',
    gray: 'hover:border-zinc-500 group-hover:text-zinc-300',
  };

  const variants = {
    primary:
      'bg-linear-to-b from-blue-500 to-blue-700 border-none hover:bg-linear-to-b hover:from-blue-600 hover:to-blue-800 text-white shadow-lg hover:shadow-xl border-1 border-blue-600 hover:border-blue-700 rounded-full',
    secondary:
      'bg-gray-600 hover:bg-gray-700 text-white shadow-lg hover:shadow-xl border-2 border-gray-600 rounded-full',
    outline:
      'text-blue-600 hover:bg-linear-to-b hover:from-blue-500 hover:to-blue-700 hover:text-white ring-2 ring-inset ring-blue-600 hover:ring-transparent rounded-full',
    success:
      'bg-green-600 hover:bg-green-700 border-none text-white shadow-lg hover:shadow-xl border-2 border-green-600 rounded-full',
    danger:
      'bg-linear-to-b from-red-500 to-red-700 border-none hover:bg-linear-to-b hover:from-red-600 hover:to-red-800 text-white shadow-lg hover:shadow-xl border-1 border-red-600 hover:border-red-700 rounded-full',
    ghost:
      'bg-transparent hover:text-white hover:border-white border-2 border-transparent text-gray-300 rounded-full',
    card: `group bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 ${cardAccents[accentColor]} rounded-lg text-left`,
  };

  const sizes = {
    icon: 'w-8 h-8 p-0',
    xs: 'px-3 py-1 text-xs',
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={twMerge(baseStyles, variants[variant], sizes[size], className)}
      id={id}
      {...rest}
    >
      {children}
    </button>
  );
}

export default memo(Button);
