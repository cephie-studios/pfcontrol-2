import { memo } from 'react';

interface ButtonProps {
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
}: ButtonProps) {
  const cardAccents = {
    green: 'hover:border-green-500/50 group-hover:text-green-400',
    blue: 'hover:border-blue-500/50 group-hover:text-blue-400',
    purple: 'hover:border-purple-500/50 group-hover:text-purple-400',
    gray: 'hover:border-zinc-500 group-hover:text-zinc-300',
  };

  const variants = {
    primary:
      'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl border-2 border-blue-600 rounded-full',
    secondary:
      'bg-gray-600 hover:bg-gray-700 text-white shadow-lg hover:shadow-xl border-2 border-gray-600 rounded-full',
    outline:
      'text-blue-600 hover:bg-blue-600 hover:text-white border-2 border-blue-600 rounded-full',
    success:
      'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl border-2 border-green-600 rounded-full',
    danger:
      'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl border-2 border-red-600 rounded-full',
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
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      id={id}
    >
      {children}
    </button>
  );
}

export default memo(Button);
