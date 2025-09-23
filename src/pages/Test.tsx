import { useState } from 'react';
import AirportDropdown from '../components/dropdowns/AirportDropdown';

export default function Test() {
	const [selectedAirport, setSelectedAirport] = useState<string>('');

	const handleAirportChange = (icao: string) => {
		setSelectedAirport(icao);
	};

	return (
		<div
			style={{
				maxWidth: 400,
				margin: '40px auto',
				padding: 24,
				background: '#2f2f2f',
				borderRadius: 8,
				boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
			}}
		>
			<h1 style={{ textAlign: 'center', marginBottom: 24 }}>Test Page</h1>
			<div style={{ display: 'flex', justifyContent: 'center' }}>
				<div style={{ minWidth: 300 }}>
					<AirportDropdown
						value={selectedAirport}
						onChange={handleAirportChange}
					/>
				</div>
			</div>
		</div>
	);
}
