import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getApiKey } from '@/lib/api';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import Landing from '@/pages/Landing';
import Dashboard from '@/pages/Dashboard';
import Feedback from '@/pages/Feedback';
import Tags from '@/pages/Tags';
import Settings from '@/pages/Settings';
import Login from '@/pages/Login';
import Layout from '@/components/Layout';
import About from '@/pages/About';
import Contact from '@/pages/Contact';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!getApiKey()) return <Navigate to="/login" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
            <Route path="/feedback" element={<ProtectedRoute><Layout><Feedback /></Layout></ProtectedRoute>} />
            <Route path="/tags" element={<ProtectedRoute><Layout><Tags /></Layout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </WorkspaceProvider>
    </QueryClientProvider>
  );
}
