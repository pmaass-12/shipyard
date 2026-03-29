import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider }         from '@/context/ToastContext';
import { AuthGuard }             from '@/components/AuthGuard';
import FeedbackWidget            from '@/components/FeedbackWidget';
import ImpersonationBanner, { ImpersonationProvider } from '@/components/ImpersonationBanner';
import TestModeBanner            from '@/components/TestModeBanner';    // Build 007
import LoginScreen               from '@/screens/Login/LoginScreen';
import ResetPasswordScreen       from '@/screens/Login/ResetPasswordScreen';
import ProjectsListScreen        from '@/screens/Projects/ProjectsListScreen';
import AdminScreen               from '@/screens/Admin/AdminScreen';
import SetupScreen               from '@/screens/Setup/SetupScreen';
import WhatsNewScreen            from '@/screens/WhatsNew/WhatsNewScreen';       // Build 009
import SeoScreen                 from '@/screens/Seo/SeoScreen';                 // Build 010
import ProjectHubScreen          from '@/screens/ProjectHub/ProjectHubScreen';   // Build 014
import ChangeRequestsScreen      from '@/screens/ChangeRequests/ChangeRequestsScreen'; // Build 012
import ScreensScreen             from '@/screens/Screens/ScreensScreen';         // Build 015
import FeatureWorkflowScreen     from '@/screens/Features/FeatureWorkflowScreen'; // Build 016
import HumanTasksScreen          from '@/screens/HumanTasks/HumanTasksScreen';    // Build 022

// ── App ──────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ImpersonationProvider>
    <ToastProvider>
      <BrowserRouter>
        {/* Impersonation banner reads from ImpersonationProvider context */}
        <ImpersonationBanner />

        {/* Test Mode amber banner — Build 007 (renders only when session active) */}
        <TestModeBanner />

        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/reset-password" element={<ResetPasswordScreen />} />

          {/* All routes below require an active Supabase session */}
          <Route element={<AuthGuard />}>
            <Route path="/" element={<Navigate to="/projects" replace />} />
            <Route path="/projects" element={<ProjectsListScreen />} />
            <Route path="/projects/:id/setup" element={<SetupScreen />} />

            {/* Build 014: Project Hub — main landing page */}
            <Route path="/projects/:id" element={<ProjectHubScreen />} />

            {/* Build 012: Change Requests — global project view */}
            <Route path="/projects/:id/change-requests" element={<ChangeRequestsScreen />} />

            {/* Build 015: Screens & Sitemap Builder */}
            <Route path="/projects/:id/screens" element={<ScreensScreen />} />
            <Route path="/projects/:id/screens/:screenId" element={<ScreensScreen />} />

            {/* Build 016: Feature Workflow */}
            <Route path="/projects/:id/features/:featureId" element={<FeatureWorkflowScreen />} />

            {/* Build 022: Human Tasks Global View */}
            <Route path="/tasks" element={<HumanTasksScreen />} />

            {/* Build 009: What's New screen */}
            <Route path="/projects/:id/whats-new" element={<WhatsNewScreen />} />

            {/* Build 010: SEO / AEO Settings */}
            <Route path="/projects/:id/seo" element={<SeoScreen />} />

            {/* Admin Console — gated by VITE_SHIPYARD_ADMIN env var at build time */}
            <Route path="/admin" element={<AdminScreen />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>

        {/* Feedback widget — renders only in preview builds */}
        <FeedbackWidget />
      </BrowserRouter>
    </ToastProvider>
    </ImpersonationProvider>
  );
}
