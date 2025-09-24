interface ButtonProps {
	children: React.ReactNode;
	onClick?: () => void;
	variant?: 'primary' | 'secondary' | 'outline' | 'danger';
	size?: 'sm' | 'md' | 'lg';
	disabled?: boolean;
	className?: string;
	type?: 'button' | 'submit' | 'reset';
}

export default function Button({
	children,
	onClick,
	variant = 'primary',
	size = 'md',
	disabled = false,
	className = '',
	type = 'button'
}: ButtonProps) {
	const baseStyles =
		'inline-flex items-center justify-center font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed';

	const variants = {
		primary:
			'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl',
		secondary:
			'bg-gray-600 hover:bg-gray-700 text-white shadow-lg hover:shadow-xl',
		outline:
			'border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white',
		success:
			'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl',
		danger: 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl',
		ghost: 'bg-transparent hover:text-white hover:border-blue-600 border-2 border-transparent text-gray-300'
	};

	const sizes = {
		sm: 'px-4 py-2 text-sm',
		md: 'px-6 py-3 text-base',
		lg: 'px-8 py-4 text-lg'
	};

	return (
		<button
			type={type}
			onClick={onClick}
			disabled={disabled}
			className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
		>
			{children}
		</button>
	);
}
