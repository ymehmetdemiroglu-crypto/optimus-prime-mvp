import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AuthGuard from './components/AuthGuard';
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import AiChat from './pages/AiChat';
import Optimization from './pages/Optimization';
import Experiments from './pages/Experiments';
import Portfolio from './pages/Portfolio';
import Forecasts from './pages/Forecasts';
import Alerts from './pages/Alerts';
import Competitive from './pages/Competitive';
import Settings from './pages/Settings';
import Semantic from './pages/Semantic';
import Reports from './pages/Reports';
import ApprovalQueue from './pages/ApprovalQueue';
import Login from './pages/Login';
import './index.css';

function AppLayout() {
    return (
        <div className="min-h-screen bg-cyber-black">
            <Navigation />
            <Outlet />
        </div>
    );
}

function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route element={<AuthGuard />}>
                        <Route element={<AppLayout />}>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/campaigns" element={<Campaigns />} />
                            <Route path="/optimize" element={<Optimization />} />
                            <Route path="/experiments" element={<Experiments />} />
                            <Route path="/portfolio" element={<Portfolio />} />
                            <Route path="/forecasts" element={<Forecasts />} />
                            <Route path="/alerts" element={<Alerts />} />
                            <Route path="/competitive" element={<Competitive />} />
                            <Route path="/semantic" element={<Semantic />} />
                            <Route path="/reports" element={<Reports />} />
                            <Route path="/approvals" element={<ApprovalQueue />} />
                            <Route path="/chat" element={<AiChat />} />
                            <Route path="/settings" element={<Settings />} />
                        </Route>
                    </Route>
                </Routes>
            </Router>
        </AuthProvider>
    );
}

export default App;
