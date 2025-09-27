import { TowerControl, Menu, X, ClipboardCopy } from 'lucide-react';
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

	useEffect(() => {
		const handleScroll = () => {
			setAtTop(window.scrollY === 0);
		};
		window.addEventListener('scroll', handleScroll);
		handleScroll();
		return () => window.removeEventListener('scroll', handleScroll);
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

	const navClass = [
		'fixed top-0 w-full z-50 transition-all duration-300',
		atTop
			? 'bg-transparent border-none'
			: 'bg-black/30 backdrop-blur-md border-white/10'
	].join(' ');

	const handleCopy = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(text);
			setTimeout(() => setCopied(null), 1200);
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
						<div className="flex-1 flex justify-center items-center space-x-4">
							<Button
								variant="primary"
								className="flex items-center space-x-2"
								onClick={() =>
									handleCopy(`/submit/${sessionId}`)
								}
							>
								<ClipboardCopy className="w-4 h-4" />
								<span>Copy Submit Link</span>
							</Button>
							<Button
								variant="danger"
								className="flex items-center space-x-2"
								onClick={() =>
									handleCopy(
										`/view/${sessionId}?accessId=${accessId}`
									)
								}
							>
								<ClipboardCopy className="w-4 h-4" />
								<span>Copy View Link</span>
							</Button>
							{copied && (
								<span className="ml-2 text-green-400 text-sm">
									Copied!
								</span>
							)}
						</div>
					)}

					{/* Desktop Navigation */}
					<div className="hidden md:flex items-center space-x-8">
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
