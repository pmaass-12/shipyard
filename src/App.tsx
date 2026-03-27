import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ToastProvider } from '@/context/ToastContext';
import { AuthGuard } from '@/components/AuthGuard';
import LoginScreen from '@/screens/Login/LoginScreen';
import ProjectsListScreen from '@/screens/Projects/ProjectsListScreen';

// ── Stub screens (not yet built) ─────────────────────────────────────────
function SetupStub() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
          Project Setup
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Coming soon — project id: <code>{id}</code>
        </p>
      </div>
    </div>
  );
}

function ScreensStub() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
          Screens / Sitemap
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Coming soon — project id: <code>{id}</code>
        </p>
      </div>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />

          {/* All routes below require an active Supabase session */}
          <Route element={<AuthGuard />}>
            <Route path="/" element={<Navigate to="/projects" replace />} />
            <Route path="/projects" element={<ProjectsListScreen />} />
            <Route path="/projects/:id/setup" element={<SetupStub />} />
            <Route path="/projects/:id/screens" element={<ScreensStub />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
