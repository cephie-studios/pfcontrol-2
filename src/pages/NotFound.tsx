import Navbar from '../components/Navbar';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFound() {
	return (
		<div className="min-h-screen bg-gradient-to-b from-black via-zinc-900 to-blue-950 text-white flex flex-col">
			<Navbar />
			<div className="flex flex-1 items-center justify-center">
				<div className="text-center">
					<h1 className="text-[15rem] font-extrabold bg-gradient-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent -mb-8">
						404
					</h1>
					<p className="text-2xl mb-8 text-gray-300">
						Page Not Found
					</p>
					<Link
						to="/"
						className="inline-flex items-center px-8 py-4 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 text-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl"
					>
						Go Home
						<ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform duration-300" />
					</Link>
				</div>
			</div>
		</div>
	);
}
