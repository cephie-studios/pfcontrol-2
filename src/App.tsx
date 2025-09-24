import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

import Home from './pages/Home';
import Create from './pages/Create';
import Sessions from './pages/Sessions';

import Test from './pages/Test';

export default function App() {
	return (
		<Router>
			<Routes>
				<Route path="/" element={<Home />} />
				<Route path="/create" element={<Create />} />
				<Route path="/sessions" element={<Sessions />} />

				<Route path="/test" element={<Test />} />
			</Routes>
		</Router>
	);
}
