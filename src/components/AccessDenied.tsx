import Navbar from './Navbar';
import { ArrowLeft } from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import { Link } from 'react-router-dom';

interface AccessDeniedProps {
	message?: string;
	description?: string;
	sessionId?: string;
	accessId?: string;
	errorType?:
		| 'access-denied'
		| 'invalid-session'
		| 'banned'
		| 'tester-required';
}

export default function AccessDenied({
	message,
	description,
	sessionId,
	accessId,
	errorType = 'access-denied'
}: AccessDeniedProps) {
	let displayMessage = message;
	let displayDescription = description;

	const bgGradient =
		errorType === 'invalid-session'
			? 'from-black via-zinc-900 to-yellow-700'
			: errorType === 'banned'
			? 'from-black via-zinc-900 to-red-900'
			: errorType === 'tester-required'
			? 'from-black via-zinc-900 to-cyan-900'
			: 'from-black via-zinc-900 to-red-950';
	const textGradient =
		errorType === 'invalid-session'
			? 'from-yellow-400 to-yellow-700'
			: errorType === 'banned'
			? 'from-red-400 to-red-700'
			: errorType === 'tester-required'
			? 'from-cyan-400 to-cyan-700'
			: 'from-red-400 to-red-900';

	if (errorType === 'invalid-session') {
		displayMessage = displayMessage || 'Invalid Session';
		displayDescription =
			displayDescription ||
			'The session you are trying to access does not exist or is no longer available.';
	} else if (errorType === 'banned') {
		displayMessage = displayMessage || 'You are banned';
		displayDescription =
			displayDescription ||
			'Your account has been banned. Please contact support for more information.';
	} else if (errorType === 'tester-required') {
		displayMessage = displayMessage || 'Tester Access Required';
		displayDescription =
			displayDescription ||
			'This application is currently in testing. Please contact an administrator if you believe you should have access.';
	} else {
		displayMessage = displayMessage || 'Access Denied';
		displayDescription =
			displayDescription ||
			"You don't have permission to access this session";
	}

	return (
		<div
			className={`min-h-screen bg-gradient-to-b ${bgGradient} text-white flex flex-col`}
		>
			<Navbar sessionId={sessionId} accessId={accessId} />
			<div className="flex flex-1 items-center justify-center">
				<div className="text-center">
					<h1
						className={`text-[10rem] font-extrabold bg-gradient-to-br ${textGradient} bg-clip-text text-transparent -mb-8`}
					>
						{errorType === 'invalid-session' ? '404' : '403'}
					</h1>
					<p className="text-2xl mb-4 text-gray-300">
						{displayMessage}
					</p>
					<p className="text-lg mb-8 text-gray-400">
						{displayDescription}
					</p>
					{errorType == 'tester-required' && (
						<Link
							to="https://discord.gg/tN3K4Ek2dE"
							className={`inline-flex items-center px-8 py-4 rounded-full ${
								'bg-[#4f62a5] hover:bg-[#384366]'
							} text-white text-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl`}
						>
							<FaDiscord className="mr-3 h-6 w-6 group-hover:-translate-x-1 transition-transform duration-300" />
							Support Server
						</Link>
					)}
					{errorType !== 'tester-required' && (
						<Link
							to="https://discord.gg/tN3K4Ek2dE"
							className={`inline-flex items-center px-8 py-4 rounded-full ${
								errorType === 'invalid-session'
									? 'bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800'
									: 'bg-[#4f62a5] hover:bg-[#384366]'
							} text-white text-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl`}
						>
							<FaDiscord className="mr-3 h-6 w-6 group-hover:-translate-x-1 transition-transform duration-300" />
							Support Server
						</Link>
					)}
				</div>
			</div>
		</div>
	);
}
