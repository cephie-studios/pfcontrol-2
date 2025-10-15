interface ButtonProps {
  children: React.ReactNode;
  onClick?: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  variant?:
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'danger'
    | 'success'
    | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  id?: string;
}

export default function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  type = 'button',
  id,
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-full transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary:
      'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl border-2 border-blue-600',
    secondary:
      'bg-gray-600 hover:bg-gray-700 text-white shadow-lg hover:shadow-xl border-2 border-gray-600',
    outline:
      'text-blue-600 hover:bg-blue-600 hover:text-white border-2 border-blue-600',
    success:
      'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl border-2 border-green-600',
    danger:
      'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl border-2 border-red-600',
    ghost:
      'bg-transparent hover:text-white hover:border-white border-2 border-transparent text-gray-300',
  };

  const sizes = {
    xs: 'px-3 py-1 text-xs',
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

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
