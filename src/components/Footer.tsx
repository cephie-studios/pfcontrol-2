import {
	TowerControl,
	Settings,
	ExternalLink,
	Mail,
	Home,
	FolderOpen,
	FileText,
	Shield,
	Cookie,
	BookPlus
} from 'lucide-react';
import { FaDiscord, FaYoutube } from 'react-icons/fa';
import { SiGithub } from 'react-icons/si';
import { useAuth } from '../hooks/auth/useAuth';

export default function Footer() {
	const { user } = useAuth();
	const year = new Date().getFullYear();

	const quickLinks = [
		{ href: '/', label: 'Home', icon: Home },
		{ href: '/create', label: 'Create Session', icon: BookPlus },
		{ href: '/sessions', label: 'My Sessions', icon: FolderOpen }
	];

	const legalLinks = [
		{
			href: 'https://terms.pfconnect.online',
			label: 'Terms of Use',
			icon: FileText
		},
		{
			href: 'https://privacy.pfconnect.online',
			label: 'Privacy Policy',
			icon: Shield
		},
		{
			href: 'https://cookies.pfconnect.online',
			label: 'Cookies Policy',
			icon: Cookie
		}
	];

	return (
		<footer className="bg-zinc-900 border-t border-gray-700 pt-16 pb-12">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-10">
					<div className="space-y-4 col-span-2">
						<div className="flex items-center space-x-2 mb-4">
							<TowerControl className="h-8 w-8 text-blue-400" />
							<span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
								PFControl
							</span>
						</div>
						<p className="text-gray-400 text-sm max-w-sm">
							The next-generation flight strip platform built for
							real-time coordination between air traffic
							controllers with enterprise-level reliability.
						</p>
						<div className="flex space-x-4 mt-6">
							<a
								href="https://github.com/pfconnect"
								target="_blank"
								rel="noopener noreferrer"
								className="text-gray-400 hover:text-white transition-all duration-200 transform hover:scale-110"
								title="GitHub"
							>
								<SiGithub className="h-5 w-5" />
							</a>
							<a
								href="https://pfconnect.online/discord"
								target="_blank"
								rel="noopener noreferrer"
								className="text-gray-400 hover:text-white transition-all duration-200 transform hover:scale-110"
								title="Discord"
							>
								<FaDiscord className="h-5 w-5" />
							</a>
							<a
								href="https://www.youtube.com/@PFConnectStudio"
								target="_blank"
								rel="noopener noreferrer"
								className="text-gray-400 hover:text-white transition-all duration-200 transform hover:scale-110"
								title="YouTube"
							>
								<FaYoutube className="h-5 w-5" />
							</a>
						</div>
					</div>

					<div className="space-y-4 col-3">
						<h3 className="font-bold text-white text-lg mb-4">
							Quick Links
						</h3>
						<ul className="space-y-3">
							{quickLinks.map((link) => {
								const IconComponent = link.icon;
								return (
									<li key={link.href}>
										<a
											href={link.href}
											className="inline-flex items-center text-gray-400 hover:text-white transition-all duration-200 text-sm group"
										>
											<IconComponent className="h-4 w-4 mr-2 group-hover:text-blue-400 transition-colors" />
											{link.label}
										</a>
									</li>
								);
							})}
							{user && (
								<li>
									<a
										href="/settings"
										className="inline-flex items-center text-gray-400 hover:text-white transition-all duration-200 text-sm group"
									>
										<Settings className="h-4 w-4 mr-2 group-hover:text-blue-400 transition-colors" />
										Settings
									</a>
								</li>
							)}
						</ul>
					</div>

					<div className="space-y-4">
						<h3 className="font-bold text-white text-lg mb-4">
							Legal
						</h3>
						<ul className="space-y-3">
							{legalLinks.map((link) => {
								const IconComponent = link.icon;
								return (
									<li key={link.href}>
										<a
											href={link.href}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center text-gray-400 hover:text-white transition-all duration-200 text-sm group"
										>
											<IconComponent className="h-4 w-4 mr-2 group-hover:text-blue-400 transition-colors" />
											{link.label}
											<ExternalLink className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
										</a>
									</li>
								);
							})}
						</ul>
					</div>

					<div className="space-y-4">
						<h3 className="font-bold text-white text-lg mb-4">
							Contact Us
						</h3>
						<div className="space-y-3">
							<div className="flex items-center">
								<Mail className="h-4 w-4 text-gray-400 mr-2" />
								<a
									href="mailto:support@pfconnect.online"
									className="text-gray-400 hover:text-white transition-all duration-200 text-sm"
								>
									support@pfconnect.online
								</a>
							</div>
							<div className="flex items-center group">
								<FaDiscord className="h-4 w-4 text-gray-400 mr-2 group-hover:text-blue-400 transition-colors" />
								<a
									href="https://pfconnect.online/discord"
									target="_blank"
									rel="noopener noreferrer"
									className="text-gray-400 hover:text-white transition-all duration-200 text-sm"
								>
									Join our Discord
									<ExternalLink className="h-3 w-3 ml-1 mb-1 inline opacity-0 group-hover:opacity-100 transition-opacity" />
								</a>
							</div>
						</div>
					</div>
				</div>

				<div className="pt-8 mt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center">
					<p className="text-gray-500 text-sm mb-4 md:mb-0">
						&copy; {year} PFControl by{' '}
						<a
							href="https://pfconnect.online"
							className="text-blue-300 hover:text-white transition-all duration-200 inline-flex items-center group"
						>
							PFConnect Studios.
							<ExternalLink className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
						</a>{' '}
						<span className="-ml-3">All rights reserved.</span>
					</p>
					<div className="flex flex-col md:items-end space-y-1 md:space-y-0 md:space-x-6 md:flex-row">
						<p className="text-gray-500 text-sm mt-4 md:mt-0">
							ATIS powered by{' '}
							<a
								href="https://atisgenerator.com"
								className="text-blue-300 hover:text-white transition-all duration-200 underline inline-flex items-center group"
								target="_blank"
								rel="noopener noreferrer"
							>
								atisgenerator.com
								<ExternalLink className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
							</a>
						</p>
						<p className="text-gray-500 text-sm mt-1 md:mt-0">
							METAR powered by{' '}
							<a
								href="https://aviationweather.gov"
								className="text-blue-300 hover:text-white transition-all duration-200 underline inline-flex items-center group"
								target="_blank"
								rel="noopener noreferrer"
							>
								aviationweather.gov
								<ExternalLink className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
							</a>
						</p>
					</div>
					<div className="flex items-center space-x-2 text-gray-500 text-sm">
						<span>Version 2.0.0.1</span>
					</div>
				</div>
			</div>
		</footer>
	);
}
