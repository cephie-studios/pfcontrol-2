import { useState } from 'react';
import Navbar from '../components/Navbar';
import Button from '../components/common/Button';

interface TeamMemberCardProps {
	name?: string;
	role?: string;
	image?: string | null;
}

function TeamMemberCard({ name, role, image }: TeamMemberCardProps) {
	const [isHovered, setIsHovered] = useState(false);

	return (
		<div
			className={`relative bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border-2 transition-all duration-300 transform cursor-default ${
				isHovered
					? 'border-blue-400 shadow-2xl shadow-blue-500/20 bg-slate-800/70'
					: 'border-blue-600 shadow-lg shadow-blue-600/10'
			}`}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<div className="relative z-10">
				<div className="flex justify-center mb-4">
					<div className={`relative transition-all duration-300`}>
						<div className="w-36 h-36 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 p-1">
							<div className="w-full h-full rounded-full overflow-hidden bg-slate-700">
								{image ? (
									<img
										src={image}
										alt={name}
										className="w-full h-full object-cover"
									/>
								) : (
									<div className="w-full h-full flex items-center justify-center text-blue-300 text-2xl font-bold">
										{name?.charAt(0) || '?'}
									</div>
								)}
							</div>
						</div>
					</div>
				</div>

				<h3 className="text-xl font-bold text-white text-center mb-2">
					{name || 'Team Member'}
				</h3>

				<p className="text-blue-300 text-center font-medium mb-3">
					{role || 'Role'}
				</p>
			</div>
		</div>
	);
}

export default function Team() {
	const teamMembers = [
		{
			name: 'Banana',
			role: 'Lead Developer',
			image: '/assets/app/team/devbanane.webp'
		},
		{
			name: 'Linuss (Torvalds)',
			role: 'Server',
			image: '/assets/app/team/linuss.webp'
		},
		{
			name: 'FrenchFries',
			role: 'UI/UX',
			image: '/assets/app/team/uhh.webp'
		}
	];

	// Removed unused handleClick function

	return (
		<div className="min-h-screen bg-gradient-to-b from-black to-slate-900 py-16 px-4">
			<Navbar />
			<div className="max-w-7xl mx-auto">
				<div className="text-center mb-16 mt-24">
					<h2
						className="text-4xl sm:text-6xl font-extrabold bg-gradient-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent mb-6"
						style={{ lineHeight: 1.4 }}
					>
						Our Team
					</h2>
					<p className="text-slate-400 text-lg max-w-2xl mx-auto">
						Meet the dedicated individuals behind PFControl.
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
					{teamMembers.map((member, index) => (
						<TeamMemberCard
							key={index}
							name={member.name}
							role={member.role}
							image={member.image}
						/>
					))}
				</div>

				<div className="flex justify-center items-center mx-auto mt-12">
					<Button
						variant="outline"
						onClick={() =>
							window.open(
								'https://apply.pfconnect.online',
								'_blank'
							)
						}
					>
						Join our team!
					</Button>
				</div>
			</div>
		</div>
	);
}
