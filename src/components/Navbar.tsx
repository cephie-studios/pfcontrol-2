import { TowerControl, Menu, X, Copy } from 'lucide-react';
import { useState, useEffect } from 'react';
import CustomUserButton from './buttons/UserButton';
import Button from './common/Button';

type NavbarProps = {
	sessionId?: string;
	accessId?: string;
};

export default function Navbar({ sessionId, accessId }: NavbarProps) {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [atTop, setAtTop] = useState(true);
	const [copied, setCopied] = useState<string | null>(null);
	const [utcTime, setUtcTime] = useState<string>(
		new Date().toISOString().slice(11, 19)
	);
	const [isCompact, setIsCompact] = useState<boolean>(
		window.innerWidth < 950
	);

	useEffect(() => {
		const handleScroll = () => {
			setAtTop(window.scrollY === 0);
		};
		window.addEventListener('scroll', handleScroll);
		handleScroll();
		return () => window.removeEventListener('scroll', handleScroll);
	}, []);

	useEffect(() => {
		const handleResize = () => {
			setIsCompact(window.innerWidth < 950);
		};
		window.addEventListener('resize', handleResize);
		handleResize();
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	useEffect(() => {
		const handleClickOutside = (event: Event) => {
			if (
				isMenuOpen &&
				!(event.target as HTMLElement).closest('.mobile-menu-container')
			) {
				setIsMenuOpen(false);
			}
		};

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setIsMenuOpen(false);
			}
		};

		if (isMenuOpen) {
			document.addEventListener('click', handleClickOutside);
			document.addEventListener('keydown', handleEscape);
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = 'unset';
		}

		return () => {
			document.removeEventListener('click', handleClickOutside);
			document.removeEventListener('keydown', handleEscape);
			document.body.style.overflow = 'unset';
		};
	}, [isMenuOpen]);

	useEffect(() => {
		if (sessionId && accessId) {
			const interval = setInterval(() => {
				setUtcTime(new Date().toISOString().slice(11, 19));
			}, 1000);
			return () => clearInterval(interval);
		}
	}, [sessionId, accessId]);

	const navClass = [
		'fixed top-0 w-full z-50 transition-all duration-300',
		atTop
			? 'bg-transparent border-none'
			: 'bg-black/30 backdrop-blur-md border-white/10'
	].join(' ');

	const submitLink = `${window.location.origin}/submit/${sessionId}`;
	const viewLink = `${window.location.origin}/submit/${sessionId}?accessId=${accessId}`;

	const handleCopy = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(text);
			setTimeout(() => setCopied(null), 2000);
		} catch {
			console.error('Failed to copy text to clipboard');
		}
	};

	return (
		<nav className={navClass}>
			<div className="max-w-7xl mx-auto px-6 lg:px-8">
				<div className="flex justify-between items-center h-16">
					<a href="/" className="flex items-center space-x-2">
						<TowerControl className="h-8 w-8 text-blue-400" />
						<span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
							PFControl
						</span>
					</a>

					{sessionId && accessId && (
						<div className="flex-1 flex justify-center items-center space-x-3">
							<span className="text-white/80 font-mono text-sm px-3 py-1.5 rounded-lg bg-white/5 hidden sm:inline backdrop-blur-sm">
								{utcTime} UTC
							</span>
							<div className="relative">
								<Button
									variant="primary"
									className={`relative overflow-hidden transition-all duration-300 ${
										copied === submitLink
											? 'bg-emerald-600 hover:bg-emerald-600 border-emerald-600'
											: ''
									}`}
									size="sm"
									onClick={() => handleCopy(submitLink)}
								>
									<div
										className={`flex items-center space-x-2 transition-transform duration-300 ${
											copied === submitLink
												? 'scale-105'
												: ''
										}`}
									>
										{isCompact ? (
											<Copy
												className={`h-4 w-4 transition-transform duration-300 ${
													copied === submitLink
														? 'rotate-12'
														: ''
												}`}
												aria-label="Copy Submit Link"
											/>
										) : (
											<>
												<Copy
													className={`h-4 w-4 transition-transform duration-300 ${
														copied === submitLink
															? 'rotate-12'
															: ''
													}`}
												/>
												<span className="font-medium">
													{copied === submitLink
														? 'Copied!'
														: 'Submit Link'}
												</span>
											</>
										)}
									</div>
									{copied === submitLink && (
										<div className="absolute inset-0 bg-emerald-400/20 animate-pulse rounded-lg"></div>
									)}
								</Button>
							</div>
							<div className="relative">
								<Button
									variant="danger"
									className={`relative overflow-hidden transition-all duration-300 ${
										copied === viewLink
											? '!bg-emerald-600 hover:!bg-emerald-600 !border-emerald-600'
											: ''
									}`}
									size="sm"
									onClick={() => handleCopy(viewLink)}
								>
									<div
										className={`flex items-center space-x-2 transition-transform duration-300 ${
											copied === viewLink
												? 'scale-105'
												: ''
										}`}
									>
										{isCompact ? (
											<Copy
												className={`h-4 w-4 transition-transform duration-300 ${
													copied === viewLink
														? 'rotate-12'
														: ''
												}`}
												aria-label="Copy View Link"
											/>
										) : (
											<>
												<Copy
													className={`h-4 w-4 transition-transform duration-300 ${
														copied === viewLink
															? 'rotate-12'
															: ''
													}`}
												/>
												<span className="font-medium">
													{copied === viewLink
														? 'Copied!'
														: 'View Link'}
												</span>
											</>
										)}
									</div>
									{copied === viewLink && (
										<div className="absolute inset-0 bg-emerald-400/20 animate-pulse rounded-lg"></div>
									)}
								</Button>
							</div>
						</div>
					)}

					{/* Desktop Navigation */}
					<div className="hidden md:flex items-center space-x-4">
						{!sessionId && (
							<div className="space-x-6">
								<a
									href="/team"
									className="text-white hover:text-blue-400 transition-colors duration-300 font-medium"
								>
									Team
								</a>
								<a
									href="/create"
									className="text-white hover:text-blue-400 transition-colors duration-300 font-medium"
								>
									Create Session
								</a>
								<a
									href="/pfatc"
									className="text-white hover:text-blue-400 transition-colors duration-300 font-medium"
								>
									PFATC Flights
								</a>
							</div>
						)}
						<CustomUserButton />
					</div>

					{/* Mobile Menu Button */}
					<div className="md:hidden">
						<button
							onClick={(e) => {
								e.stopPropagation();
								setIsMenuOpen(!isMenuOpen);
							}}
							className="text-white hover:text-blue-400 transition-colors duration-300 p-2 rounded-lg hover:bg-white/10"
							aria-label="Toggle menu"
						>
							{isMenuOpen ? (
								<X className="h-6 w-6" />
							) : (
								<Menu className="h-6 w-6" />
							)}
						</button>
					</div>
				</div>

				{/* Mobile Navigation Dropdown */}
				<div className="mobile-menu-container relative md:hidden">
					<div
						className={`
                            absolute top-2 right-0 w-80 max-w-[calc(100vw-2rem)]
                            bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50
                            rounded-2xl shadow-2xl overflow-hidden
                            transform transition-all duration-300 ease-out origin-top-right
                            ${
								isMenuOpen
									? 'opacity-100 scale-100 translate-y-0'
									: 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
							}
                        `}
					>
						<div className="py-2">
							<a
								href="/team"
								className="block px-6 py-3 text-gray-300 hover:text-white hover:bg-blue-600/20 transition-all duration-200 font-medium"
								onClick={() => setIsMenuOpen(false)}
							>
								Team
							</a>
							<a
								href="/create"
								className="block px-6 py-3 text-gray-300 hover:text-white hover:bg-blue-600/20 transition-all duration-200 font-medium"
								onClick={() => setIsMenuOpen(false)}
							>
								Create Session
							</a>
							<a
								href="/pfatc"
								className="block px-6 py-3 text-gray-300 hover:text-white hover:bg-blue-600/20 transition-all duration-200 font-medium"
								onClick={() => setIsMenuOpen(false)}
							>
								PFATC Flights
							</a>
						</div>

						<div className="border-t border-zinc-700/50 p-4">
							<CustomUserButton
								isMobile={true}
								className="w-full"
								onAction={() => setIsMenuOpen(false)}
							/>
						</div>
					</div>

					{isMenuOpen && (
						<div
							className="fixed inset-0 bg-black/20 backdrop-blur-sm -z-10"
							onClick={() => setIsMenuOpen(false)}
						/>
					)}
				</div>
			</div>
		</nav>
	);
}
