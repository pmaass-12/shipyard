import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ToastProvider }         from '@/context/ToastContext';
import { AuthGuard }             from '@/components/AuthGuard';
import FeedbackWidget            from '@/components/FeedbackWidget';
import ImpersonationBanner, { ImpersonationProvider } from '@/components/ImpersonationBanner';
import TestModeBanner            from '@/components/TestModeBanner';    // Build 007
import LoginScreen               from '@/screens/Login/LoginScreen';
import ResetPasswordScreen       from '@/screens/Login/ResetPasswordScreen';
import ProjectsListScreen        from '@/screens/Projects/ProjectsListScreen';
import AdminScreen               from '@/screens/Admin/AdminScreen';
// Build 056: SetupScreen retired — /projects/:id/setup now redirects to hub
// import SetupScreen            from '@/screens/Setup/SetupScreen';
import WhatsNewScreen            from '@/screens/WhatsNew/WhatsNewScreen';       // Build 009
import SeoScreen                 from '@/screens/Seo/SeoScreen';                 // Build 010
import ProjectHubScreen          from '@/screens/ProjectHub/ProjectHubScreen';   // Build 014
import ChangeRequestsScreen      from '@/screens/ChangeRequests/ChangeRequestsScreen'; // Build 012
import ScreensScreen             from '@/screens/Screens/ScreensScreen';         // Build 015
import FeatureWorkflowScreen     from '@/screens/Features/FeatureWorkflowScreen'; // Build 016
import HumanTasksScreen          from '@/screens/HumanTasks/HumanTasksScreen';    // Build 022
import ImportFlowScreen          from '@/screens/Import/ImportFlowScreen';        // Build 041
import AnalyticsScreen           from '@/screens/Analytics/AnalyticsScreen';      // Build 017
import DomainScreen              from '@/screens/Domain/DomainScreen';            // Build 018
import EmailScreen               from '@/screens/Email/EmailScreen';              // Build 019
import BillingScreen             from '@/screens/Billing/BillingScreen';          // Build 020
import GithubScreen              from '@/screens/Github/GithubScreen';            // Build 021
import UsageScreen               from '@/screens/Usage/UsageScreen';              // Build 023
import BugsScreen                from '@/screens/Bugs/BugsScreen';                // Build 025
import ArtifactsScreen           from '@/screens/Artifacts/ArtifactsScreen';      // Build 026
import AdSenseScreen             from '@/screens/AdSense/AdSenseScreen';          // Build 028
import PromoScreen               from '@/screens/Promo/PromoScreen';              // Build 029
import DocumentsScreen           from '@/screens/Documents/DocumentsScreen';      // Build 030
import ChangesScreen             from '@/screens/Changes/ChangesScreen';          // Build 035
import SetupWizardScreen         from '@/screens/Setup/SetupWizardScreen';        // Build 032
// Build 038 DeploySetupScreen superseded by Build 053 InfraSetupWizardScreen at /projects/:id/deploy
// import DeploySetupScreen         from '@/screens/Deploy/DeploySetupScreen';       // Build 038 — preserved for reference
import ProjectTypeChoiceScreen   from '@/screens/Setup/ProjectTypeChoiceScreen';  // Build 047
import DistributeWizardScreen    from '@/screens/Distribute/DistributeWizardScreen'; // Build 047
import DistributeHubScreen       from '@/screens/Distribute/DistributeHubScreen';    // Build 047
import DistributeResearchScreen  from '@/screens/Distribute/DistributeResearchScreen'; // Build 047
import DistributeLeadsScreen     from '@/screens/Distribute/DistributeLeadsScreen';    // Build 047
import DistributeOutreachScreen  from '@/screens/Distribute/DistributeOutreachScreen'; // Build 047
import MobileChatView            from '@/screens/Mobile/MobileChatView';               // Build 048
import InfraSetupWizardScreen    from '@/screens/Setup/InfraWizardScreen';              // Build 053 — replaces DeploySetupScreen at /deploy
import FeatureBoardScreen        from '@/screens/FeatureBoard/FeatureBoardScreen';       // Build 058
import TriageScreen             from '@/screens/Features/TriageScreen';                  // Build 066
import DesignGalleryScreen      from '@/screens/DesignGallery/DesignGalleryScreen';     // Build 061
import PrototypeViewerScreen    from '@/screens/Prototype/PrototypeViewerScreen';       // Build 061

// ── Build 056: /projects/:id/setup redirect helper ───────────────────────
function SetupRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/projects/${id}`} replace />;
}

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
            {/* Build 048: Mobile chat-first — full-screen Reeve thread, no sidebar */}
            <Route path="/mobile" element={<MobileChatView />} />

            <Route path="/" element={<Navigate to="/projects" replace />} />
            <Route path="/projects" element={<ProjectsListScreen />} />
            {/* Build 056: SetupScreen retired — redirect to Project Hub */}
            <Route path="/projects/:id/setup" element={<SetupRedirect />} />

            {/* Build 047: Project type choice — shown before Build or Distribute wizard */}
            <Route path="/projects/:id/setup/wizard" element={<ProjectTypeChoiceScreen />} />

            {/* Build 032: Setup Wizard — Full Redesign (Build path) */}
            <Route path="/projects/:id/setup/build-wizard" element={<SetupWizardScreen />} />

            {/* Build 047: Distribute path */}
            <Route path="/projects/:id/distribute/wizard"   element={<DistributeWizardScreen />} />
            <Route path="/projects/:id/distribute"          element={<DistributeHubScreen />} />
            <Route path="/projects/:id/distribute/research" element={<DistributeResearchScreen />} />
            <Route path="/projects/:id/distribute/leads"    element={<DistributeLeadsScreen />} />
            <Route path="/projects/:id/distribute/outreach" element={<DistributeOutreachScreen />} />

            {/* Build 014: Project Hub — main landing page */}
            <Route path="/projects/:id" element={<ProjectHubScreen />} />

            {/* Build 012: Change Requests — global project view */}
            <Route path="/projects/:id/change-requests" element={<ChangeRequestsScreen />} />

            {/* Build 035: Changes (replaces Build 012) */}
            <Route path="/projects/:id/changes" element={<ChangesScreen />} />

            {/* Build 015: Screens & Sitemap Builder */}
            <Route path="/projects/:id/screens" element={<ScreensScreen />} />
            <Route path="/projects/:id/screens/:screenId" element={<ScreensScreen />} />

            {/* Build 058: Feature Board — all features grouped by pipeline stage */}
            <Route path="/projects/:id/features" element={<FeatureBoardScreen />} />

            {/* Build 066: Feature Triage — one-time planning step after brief extraction */}
            <Route path="/projects/:id/triage" element={<TriageScreen />} />

            {/* Build 061: Design Gallery — Designs tab + Flow Map tab */}
            <Route path="/projects/:id/gallery" element={<DesignGalleryScreen />} />

            {/* Build 061: Prototype Viewer — full-screen live prototype */}
            <Route path="/projects/:id/prototype" element={<PrototypeViewerScreen />} />

            {/* Build 016: Feature Workflow */}
            <Route path="/projects/:id/features/:featureId" element={<FeatureWorkflowScreen />} />
            {/* Build 066: /chat alias — navigates directly to the Design (PM chat) step */}
            <Route path="/projects/:id/features/:featureId/chat" element={<FeatureWorkflowScreen />} />

            {/* Build 022: Human Tasks Global View */}
            <Route path="/tasks" element={<HumanTasksScreen />} />

            {/* Build 041: Import Existing Website */}
            <Route path="/projects/:id/import" element={<ImportFlowScreen />} />

            {/* Build 009: What's New screen */}
            <Route path="/projects/:id/whats-new" element={<WhatsNewScreen />} />

            {/* Build 010: SEO / AEO Settings */}
            <Route path="/projects/:id/seo" element={<SeoScreen />} />

            {/* Build 017: Analytics Dashboard */}
            <Route path="/projects/:id/analytics" element={<AnalyticsScreen />} />

            {/* Build 018: Custom Domain */}
            <Route path="/projects/:id/domain" element={<DomainScreen />} />

            {/* Build 019: Transactional Email (Resend) */}
            <Route path="/projects/:id/email" element={<EmailScreen />} />

            {/* Build 020: Billing / Monetization (Stripe) */}
            <Route path="/projects/:id/billing" element={<BillingScreen />} />

            {/* Build 021: GitHub Integration UI */}
            <Route path="/projects/:id/github" element={<GithubScreen />} />

            {/* Build 023: Token Usage / Cost Dashboard */}
            <Route path="/projects/:id/usage" element={<UsageScreen />} />

            {/* Build 025: Global Bugs View */}
            <Route path="/projects/:id/bugs" element={<BugsScreen />} />

            {/* Build 026: Artifacts Panel */}
            <Route path="/projects/:id/artifacts" element={<ArtifactsScreen />} />

            {/* Build 028: AdSense Monetization Scaffold */}
            <Route path="/projects/:id/adsense" element={<AdSenseScreen />} />

            {/* Build 029: Promo Page + Business Name */}
            <Route path="/projects/:id/promo" element={<PromoScreen />} />

            {/* Build 030: Supporting Documents */}
            <Route path="/projects/:id/documents" element={<DocumentsScreen />} />

            {/* Build 053: Guided Infrastructure Setup Wizard (replaces Build 038 at this route)
                Advanced mode preserves Build 038 UI behind "Advanced setup →" link */}
            <Route path="/projects/:id/deploy" element={<InfraSetupWizardScreen />} />

            {/* Admin Console */}
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
