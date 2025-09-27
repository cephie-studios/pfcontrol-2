import Navbar from '../components/Navbar';
import { useParams, useSearchParams } from 'react-router-dom';

export default function Flights() {
	const { sessionId } = useParams<{ sessionId?: string }>();
	const [searchParams] = useSearchParams();
	const accessId = searchParams.get('accessId') ?? undefined;

	return (
		<div className="min-h-screen bg-black text-white">
			<Navbar sessionId={sessionId} accessId={accessId} />
		</div>
	);
}
