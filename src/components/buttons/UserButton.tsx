interface CustomUserButtonProps {
	className?: string;
	isMobile?: boolean;
}

export default function CustomUserButton({
	className = '',
	isMobile = false
}: CustomUserButtonProps) {
	const baseClasses = isMobile
		? 'w-full mt-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2 rounded-full font-medium transition-all duration-300'
		: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2 rounded-full font-medium transition-all duration-300 shadow-lg hover:shadow-xl';

	return (
		<>
			<button className={`${baseClasses} ${className}`}>Sign In</button>
		</>
	);
}
