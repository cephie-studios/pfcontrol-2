import { ArrowRight, TowerControl } from 'lucide-react';
import Navbar from '../components/Navbar';

export default function Home() {
	return (
		<div className="min-h-screen">
			<Navbar />
			{/* Hero */}
			<section className="relative min-h-[97vh] flex items-center justify-between overflow-hidden px-36 bg-gradient-to-b from-black via-zinc-900 to-zinc-800">
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
							onClick={() =>
								(window.location.href = '/view/pfatc')
							}
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
					className="absolute bottom-0 w-full h-24 fill-zinc-800"
					viewBox="0 0 1440 120"
					preserveAspectRatio="none"
				>
					<path d="M0,60 Q360,0 720,60 T1440,60 L1440,120 L0,120 Z"></path>
				</svg>
			</section>

			<section className="relative bg-zinc-800 py-20"></section>
		</div>
	);
}
