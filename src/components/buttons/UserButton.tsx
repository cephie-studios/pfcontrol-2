import {
	SignedIn,
	SignedOut,
	SignInButton,
	UserButton,
	useUser
} from '@clerk/clerk-react';
import { dark } from '@clerk/themes';

interface CustomUserButtonProps {
	className?: string;
	isMobile?: boolean;
}

export default function CustomUserButton({
	className = '',
	isMobile = false
}: CustomUserButtonProps) {
	const { user } = useUser();

	const baseClasses = isMobile
		? 'w-full mt-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2 rounded-full font-medium transition-all duration-300'
		: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2 rounded-full font-medium transition-all duration-300 shadow-lg hover:shadow-xl';

	return (
		<>
			<SignedOut>
				<SignInButton mode="modal">
					<button className={`${baseClasses} ${className}`}>
						Get Started
					</button>
				</SignInButton>
			</SignedOut>
			<SignedIn>
				<div className="flex items-center space-x-3">
					<UserButton
						userProfileUrl="/profile"
						appearance={{
							baseTheme: dark,
							elements: {
								userButtonAvatarBox: 'w-12 h-12',
								userButtonAvatarImage: 'w-12 h-12'
							}
						}}
					/>
					{user && (
						<span className="text-white font-medium text-lg">
							{user.firstName || user.username || 'User'}
						</span>
					)}
				</div>
			</SignedIn>
		</>
	);
}
