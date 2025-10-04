import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

import Home from './pages/Home';
import Create from './pages/Create';
import Sessions from './pages/Sessions';
import Submit from './pages/Submit';
import Flights from './pages/Flights';
import Settings from './pages/Settings';
import PFATCFlights from './pages/PFATCFlights';

import Login from './pages/Login';
import NotFound from './pages/NotFound';

import ProtectedRoute from './components/ProtectedRoute';

import Admin from './pages/Admin';
import AdminUsers from './pages/admin/AdminUsers';
import AdminAudit from './pages/admin/AdminAudit';

export default function App() {
	return (
		<Router>
			<Routes>
				<Route path="/" element={<Home />} />
				<Route path="/pfatc" element={<PFATCFlights />} />
				<Route path="/submit/:sessionId" element={<Submit />} />
				<Route
					path="/create"
					element={
						<ProtectedRoute>
							<Create />
						</ProtectedRoute>
					}
				/>
				<Route
					path="/sessions"
					element={
						<ProtectedRoute>
							<Sessions />
						</ProtectedRoute>
					}
				/>
				<Route
					path="/view/:sessionId"
					element={
						<ProtectedRoute>
							<Flights />
						</ProtectedRoute>
					}
				/>
				<Route
					path="/settings"
					element={
						<ProtectedRoute>
							<Settings />
						</ProtectedRoute>
					}
				/>
				<Route path="/login" element={<Login />} />

				<Route
					path="/admin"
					element={
						<ProtectedRoute requireAdmin={true}>
							<Admin />
						</ProtectedRoute>
					}
				/>
				<Route
					path="/admin/users"
					element={
						<ProtectedRoute requireAdmin={true}>
							<AdminUsers />
						</ProtectedRoute>
					}
				/>
				<Route
					path="/admin/audit"
					element={
						<ProtectedRoute requireAdmin={true}>
							<AdminAudit />
						</ProtectedRoute>
					}
				/>

				<Route path="*" element={<NotFound />} />
			</Routes>
		</Router>
	);
}
