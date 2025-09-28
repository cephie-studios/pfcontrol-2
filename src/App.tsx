import { BrowserRouter as Router, Route, Routes } from "react-router-dom";

import Home from "./pages/Home";
import Create from "./pages/Create";
import Sessions from "./pages/Sessions";
import Submit from "./pages/Submit";
import Team from "./pages/Team";
import Flights from "./pages/Flights";

import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
   return (
      <Router>
         <Routes>
            <Route path="/" element={<Home />} />
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

            <Route path="/login" element={<Login />} />
            <Route path="/team" element={<Team />} />

            <Route path="*" element={<NotFound />} />
         </Routes>
      </Router>
   );
}
