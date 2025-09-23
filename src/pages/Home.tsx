import {
	ArrowRight,
	Clock,
	Plane,
	Shield,
	TowerControl,
	Users
} from 'lucide-react';
import Navbar from '../components/Navbar';

export default function Home() {
	return (
		<div className="min-h-screen">
			<Navbar />

			<section className="relative min-h-[97vh] flex items-center justify-between overflow-hidden px-36 bg-gradient-to-b from-black via-zinc-900 to-slate-900">
				<div className="flex flex-col justify-center mt-16">
					<div>
						<h1 className="text-[8rem] font-extrabold bg-gradient-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent">
							PFControl
						</h1>
						<p className="text-xl text-white max-w-2xl ml-1">
							The next-generation flight strip platform built for
							real-time coordination between air traffic
							controllers with enterprise-level reliability.
						</p>
					</div>
					<div className="flex items-center space-x-6 mt-8">
						<button
							onClick={() => (window.location.href = '/create')}
							className="group inline-flex items-center px-10 py-5 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 text-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl"
						>
							Start Session Now
							<ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform duration-300" />
						</button>
						<button
							onClick={() => (window.location.href = '/pfatc')}
							className="group inline-flex items-center px-10 py-5 rounded-full bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 text-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl"
						>
							<TowerControl className="mr-3 h-6 w-6 group-hover:scale-110 transition-transform duration-300" />
							See PFATC Flights
						</button>
					</div>
				</div>

				<div className="flex-1 flex justify-center items-center ml-16 mt-12">
					<div className="relative">
						<img
							src="/assets/app/hero-rotated.png"
							alt="Application Preview"
							className="max-w-full h-[30rem] transform hover:scale-105 transition-transform duration-500"
						/>
					</div>
				</div>

				<svg
					className="absolute bottom-0 left-0 w-full h-16 fill-[#1b1b1e] z-0"
					viewBox="0 0 1440 120"
					preserveAspectRatio="none"
				>
					<path d="M0,60 Q720,0 1440,60 L1440,120 L0,120 Z"></path>
				</svg>
			</section>

			<section className="relative bg-[#1b1b1e] py-20">
				<div className="max-w-7xl mx-auto px-6 lg:px-8 mb-32">
					<h2
						className="text-6xl font-extrabold bg-gradient-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent mb-6 text-center"
						style={{ lineHeight: 1.4 }}
					>
						How it works
					</h2>
					<div className="w-16 h-1 bg-blue-500 mx-auto mb-6"></div>
					<p className="text-xl text-center text-gray-300 max-w-3xl mx-auto">
						Get started with PFControl in three simple steps.
					</p>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-12 mt-20">
						<div className="text-center">
							<div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
								1
							</div>
							<h3 className="text-2xl font-bold mb-4">
								Create Session
							</h3>
							<p className="text-gray-400">
								Start a new flight strip session and receive a
								unique identifier for your control position
							</p>
						</div>

						<div className="text-center">
							<div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
								2
							</div>
							<h3 className="text-2xl font-bold mb-4">
								Share Submission Link
							</h3>
							<p className="text-gray-400">
								Share the form link with pilots to start
								receiving flight plans instantly
							</p>
						</div>

						<div className="text-center">
							<div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
								3
							</div>
							<h3 className="text-2xl font-bold mb-4">
								Manage Strips
							</h3>
							<p className="text-gray-400">
								Update clearance status, assign SIDs, and track
								departures in real-time
							</p>
						</div>
					</div>
				</div>

				<svg
					className="absolute bottom-0 w-full h-24 fill-slate-900"
					viewBox="0 0 1440 120"
					preserveAspectRatio="none"
				>
					<path d="M0,60 Q360,0 720,60 T1440,60 L1440,120 L0,120 Z"></path>
				</svg>
			</section>

			<section className="relative bg-gradient-to-b from-slate-900 via-zinc-900 to-black py-20">
				<div className="max-w-7xl mx-auto mb-36">
					<div className="text-center mb-16">
						<h2
							className="text-6xl font-extrabold bg-gradient-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent mb-6 text-center"
							style={{ lineHeight: 1.4 }}
						>
							Platform Statistics
						</h2>
						<div className="w-16 h-1 bg-blue-500 mx-auto mb-6"></div>
						<p className="text-xl text-gray-300 max-w-3xl mx-auto">
							Join thousands of controllers and pilots using
							PFControl worldwide
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-10 cursor-default">
						<div className="relative bg-gray-800/60 backdrop-blur-md border border-blue-700 rounded-2xl p-10 text-center shadow-xl transition-transform hover:-translate-y-2 hover:shadow-2xl hover:border-blue-400">
							<div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-700 p-3 rounded-full shadow-lg">
								<TowerControl className="h-8 w-8 text-white" />
							</div>
							<h3 className="text-2xl font-semibold mt-8 mb-4 text-blue-200">
								Sessions Created
							</h3>
							<div className="text-4xl font-bold text-white mb-3">
								2.518
							</div>
							<p className="text-gray-400">Last 30 days</p>
						</div>

						<div className="relative bg-gray-800/60 backdrop-blur-md border border-blue-700 rounded-2xl p-10 text-center shadow-xl transition-transform hover:-translate-y-2 hover:shadow-2xl hover:border-blue-400">
							<div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-700 p-3 rounded-full shadow-lg">
								<Users className="h-8 w-8 text-white" />
							</div>
							<h3 className="text-2xl font-semibold mt-8 mb-4 text-blue-200">
								Registered Users
							</h3>
							<div className="text-4xl font-bold text-white mb-3">
								4.611
							</div>
							<p className="text-gray-400">All time</p>
						</div>

						<div className="relative bg-gray-800/60 backdrop-blur-md border border-blue-700 rounded-2xl p-10 text-center shadow-xl transition-transform hover:-translate-y-2 hover:shadow-2xl hover:border-blue-400">
							<div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-700 p-3 rounded-full shadow-lg">
								<Plane className="h-8 w-8 text-white" />
							</div>
							<h3 className="text-2xl font-semibold mt-8 mb-4 text-blue-200">
								Flights Logged
							</h3>
							<div className="text-4xl font-bold text-white mb-3">
								7.346
							</div>
							<p className="text-gray-400">Last 30 days</p>
						</div>
					</div>
				</div>

				<svg
					className="absolute bottom-0 w-full h-24 fill-[#1b1b1e]"
					viewBox="0 0 1440 120"
					preserveAspectRatio="none"
				>
					<path d="M0,60 Q360,0 720,60 T1440,60 L1440,120 L0,120 Z"></path>
				</svg>
			</section>

			<section className="relative bg-[#1b1b1e] py-20">
				<div className="max-w-7xl mx-auto mb-24">
					<h2
						className="text-6xl font-extrabold bg-gradient-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent mb-6 text-center"
						style={{ lineHeight: 1.4 }}
					>
						Why Choose PFControl?
					</h2>
					<div className="w-16 h-1 bg-blue-500 mx-auto mb-6"></div>
					<p className="text-xl text-center text-gray-300 max-w-3xl mx-auto">
						Experience the future of air traffic control with
						PFControl.
					</p>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-10 mt-12">
						<div className="relative bg-gray-800/60 backdrop-blur-md border border-blue-700 rounded-2xl p-10 text-center shadow-xl transition-transform hover:-translate-y-2 hover:shadow-2xl hover:border-blue-400">
							<div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-700 p-3 rounded-full shadow-lg">
								<Shield className="h-8 w-8 text-white" />
							</div>
							<h3 className="text-2xl font-semibold mt-8 mb-2 text-blue-200">
								Secure & Reliable
							</h3>
							<p className="text-gray-300">
								Enterprise-grade reliability and security for
								every session, ensuring your data is always
								protected.
							</p>
						</div>
						<div className="relative bg-gray-800/60 backdrop-blur-md border border-blue-700 rounded-2xl p-10 text-center shadow-xl transition-transform hover:-translate-y-2 hover:shadow-2xl hover:border-blue-400">
							<div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-700 p-3 rounded-full shadow-lg">
								<Clock className="h-8 w-8 text-white" />
							</div>
							<h3 className="text-2xl font-semibold mt-8 mb-2 text-blue-200">
								Real-Time Updates
							</h3>
							<p className="text-gray-300">
								Instantly see changes and updates as they
								happen, keeping your team in sync at all times.
							</p>
						</div>
						<div className="relative bg-gray-800/60 backdrop-blur-md border border-blue-700 rounded-2xl p-10 text-center shadow-xl transition-transform hover:-translate-y-2 hover:shadow-2xl hover:border-blue-400">
							<div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-700 p-3 rounded-full shadow-lg">
								<Users className="h-8 w-8 text-white" />
							</div>
							<h3 className="text-2xl font-semibold mt-8 mb-2 text-blue-200">
								Collaborative
							</h3>
							<p className="text-gray-300">
								Designed for seamless teamwork between
								controllers, pilots, and staff across any
								device.
							</p>
						</div>
					</div>
				</div>

				<svg
					className="absolute bottom-0 left-0 w-full h-16 fill-black z-0"
					viewBox="0 0 1440 120"
					preserveAspectRatio="none"
				>
					<path d="M0,60 Q720,0 1440,60 L1440,120 L0,120 Z"></path>
				</svg>
			</section>

			<section className="relative bg-black py-20">
				<div className="max-w-7xl mx-auto">
					<div className="flex flex-col md:flex-row items-center gap-8 lg:gap-16">
						<div className="w-full md:w-1/2 space-y-6">
							<h2
								className="text-6xl font-extrabold bg-gradient-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent mb-6 text-left"
								style={{ lineHeight: 1.4 }}
							>
								PFControl v2
							</h2>
							<div className="w-16 h-1 bg-blue-500 mb-6"></div>
							<p className="text-xl text-gray-300">
								Watch our official trailer showcasing the
								powerful features of our latest stable release.
							</p>
							<ul className="space-y-4 text-gray-300 mt-6">
								<li className="flex items-start">
									<ArrowRight className="mr-3 h-5 w-5 text-blue-400 flex-shrink-0 mt-1" />
									<span>
										Enhanced real-time collaboration between
										controllers
									</span>
								</li>
								<li className="flex items-start">
									<ArrowRight className="mr-3 h-5 w-5 text-blue-400 flex-shrink-0 mt-1" />
									<span>
										Redesigned interface for improved
										usability
									</span>
								</li>
								<li className="flex items-start">
									<ArrowRight className="mr-3 h-5 w-5 text-blue-400 flex-shrink-0 mt-1" />
									<span>
										Advanced flight strip management system
									</span>
								</li>
							</ul>
							<div className="pt-6">
								<button
									onClick={() =>
										(window.location.href = '/create')
									}
									className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-full text-lg font-medium transition-all"
								>
									Try the Latest Version Now
								</button>
							</div>
						</div>

						<div className="w-full md:w-1/2 mt-10 md:mt-0">
							<div className="relative">
								<img
									src="/assets/app/hero-rotated.png"
									alt="Application Preview"
									className="max-w-full h-[30rem] transform hover:scale-105 transition-transform duration-500"
								/>
							</div>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
