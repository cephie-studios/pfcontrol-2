import { TowerControl, Menu, X } from 'lucide-react';
import { useState } from 'react';
import CustomUserButton from './buttons/UserButton';

export default function Navbar() {
	const [isMenuOpen, setIsMenuOpen] = useState(false);

	return (
		<nav className="fixed top-0 w-full z-50 bg-black/20 backdrop-blur-md border-b border-white/10">
			<div className="max-w-7xl mx-auto px-6 lg:px-8">
				<div className="flex justify-between items-center h-16">
					<div className="flex items-center space-x-2">
						<TowerControl className="h-8 w-8 text-blue-400" />
						<span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
							PFControl
						</span>
					</div>

					{/* Desktop Navigation */}
					<div className="hidden md:flex items-center space-x-8">
						<a
							href="/"
							className="text-white hover:text-blue-400 transition-colors duration-300 font-medium"
						>
							Home
						</a>
						<a
							href="/create"
							className="text-white hover:text-blue-400 transition-colors duration-300 font-medium"
						>
							Create Session
						</a>
						<a
							href="/view/pfatc"
							className="text-white hover:text-blue-400 transition-colors duration-300 font-medium"
						>
							PFATC Flights
						</a>
						<CustomUserButton />
					</div>

					<div className="md:hidden">
						<button
							onClick={() => setIsMenuOpen(!isMenuOpen)}
							className="text-white hover:text-blue-400 transition-colors duration-300"
						>
							{isMenuOpen ? (
								<X className="h-6 w-6" />
							) : (
								<Menu className="h-6 w-6" />
							)}
						</button>
					</div>
				</div>

				{/* Mobile Navigation */}
				{isMenuOpen && (
					<div className="md:hidden bg-black/40 backdrop-blur-md border-t border-white/10">
						<div className="px-2 pt-2 pb-3 space-y-1">
							<a
								href="/"
								className="block px-3 py-2 text-white hover:text-blue-400 transition-colors duration-300 font-medium"
							>
								Home
							</a>
							<a
								href="/create"
								className="block px-3 py-2 text-white hover:text-blue-400 transition-colors duration-300 font-medium"
							>
								Create Session
							</a>
							<a
								href="/view/pfatc"
								className="block px-3 py-2 text-white hover:text-blue-400 transition-colors duration-300 font-medium"
							>
								PFATC Flights
							</a>
							<a
								href="/about"
								className="block px-3 py-2 text-white hover:text-blue-400 transition-colors duration-300 font-medium"
							>
								About
							</a>
							<CustomUserButton isMobile={true} />
						</div>
					</div>
				)}
			</div>
		</nav>
	);
}
