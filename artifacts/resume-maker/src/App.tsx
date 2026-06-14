import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn, dark } from "@clerk/themes";
import { setAuthTokenGetter, useGetProfile } from "@workspace/api-client-react";
import {
  Switch,
  Route,
  useLocation,
  Router as WouterRouter,
  Redirect,
} from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PremiumLoadingScreen } from "@/components/shared/PremiumLoadingScreen";
import { clearAllToasts } from "@/hooks/use-toast";
import LandingPage from "@/pages/landing";
import DashboardPage from "@/pages/dashboard";
import BuilderPage from "@/pages/builder";
import TemplatesPage from "@/pages/templates";
import BillingPage from "@/pages/billing";
import SettingsPage from "@/pages/settings";
import ContactPage from "@/pages/contact";
import PricingPage from "@/pages/pricing";
import PrivacyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";
import NotFound from "@/pages/not-found";
import OnboardingPage from "@/pages/onboarding";
import ProfilePage from "@/pages/profile";
import { ThemeProvider, useTheme } from "next-themes";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const isE2E = import.meta.env.VITE_E2E === "true";

const clerkProxyUrl =
  import.meta.env.PROD && import.meta.env.VITE_CLERK_PROXY_URL
    ? import.meta.env.VITE_CLERK_PROXY_URL
    : undefined;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey && !isE2E) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

function getClerkAppearance(resolvedTheme: string | undefined) {
  const isDark = resolvedTheme === "dark";
  return {
    theme: isDark ? dark : shadcn,
    cssLayerName: "clerk",
    options: {
      logoPlacement: "inside" as const,
      logoLinkUrl: basePath || "/",
      logoImageUrl: `${window.location.origin}${basePath}/bluemascot.svg`,
    },
    variables: {
      colorPrimary: "#4f46e5",
      colorForeground: isDark ? "#f3f4f6" : "#0a0e1a",
      colorMutedForeground: isDark ? "#9ca3af" : "#6b7280",
      colorDanger: "#dc2626",
      colorBackground: isDark ? "#0B0F14" : "#ffffff",
      colorInput: isDark ? "#171F2B" : "#f3f4f6",
      colorInputForeground: isDark ? "#ffffff" : "#0a0e1a",
      colorNeutral: isDark ? "#111827" : "#e5e7eb",
      fontFamily: "Inter, system-ui, sans-serif",
      borderRadius: "0.5rem",
    },
    elements: {
      rootBox: "w-full flex justify-center",
      cardBox: isDark
        ? "bg-[#171F2B] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl border border-gray-800"
        : "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl border border-gray-100",
      card: "!shadow-none !border-0 !bg-transparent !rounded-none",
      footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
      headerTitle: isDark ? "text-gray-100 font-semibold" : "text-gray-900 font-semibold",
      headerSubtitle: "text-gray-500",
      socialButtonsBlockButtonText: isDark ? "text-gray-300 font-medium" : "text-gray-700 font-medium",
      formFieldLabel: isDark ? "text-gray-300 font-medium" : "text-gray-700 font-medium",
      footerActionLink: "text-violet-400 font-medium hover:text-violet-300",
      footerActionText: "text-gray-500",
      dividerText: "text-gray-400",
      identityPreviewEditButton: "text-violet-400",
      formFieldSuccessText: "text-green-600",
      alertText: "text-red-600",
      logoBox: "flex justify-center mb-1",
      logoImage: "h-16 w-auto",
      socialButtonsBlockButton: isDark
        ? "border border-gray-805 hover:bg-gray-800 text-gray-300"
        : "border border-gray-200 hover:bg-gray-50 text-gray-700",
      formButtonPrimary:
        "bg-violet-600 hover:bg-violet-700 text-white font-medium",
      formFieldInput: isDark
        ? "border-gray-800 focus:border-violet-500 focus:ring-violet-500 bg-[#0B0F14] text-white"
        : "border-gray-200 focus:border-violet-500 focus:ring-violet-500 bg-white text-gray-900",
      footerAction: isDark ? "bg-[#111827]" : "bg-gray-50",
      dividerLine: isDark ? "bg-gray-800" : "bg-gray-200",
      alert: isDark ? "border border-red-950 bg-red-950/20" : "border border-red-100 bg-red-50",
      otpCodeFieldInput: isDark ? "border-gray-800 text-white" : "border-gray-200 text-gray-900",
      formFieldRow: "",
      main: "",
    },
  };
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-indigo-50 to-sky-50 dark:from-[#0B0F14] dark:to-[#171F2B] px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-indigo-50 to-sky-50 dark:from-[#0B0F14] dark:to-[#171F2B] px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <AuthLoadingFallback />;
  }

  return isSignedIn ? <Redirect to="/dashboard" /> : <LandingPage />;
}

function AuthLoadingFallback() {
  const path = stripBase(window.location.pathname);

  if (sessionStorage.getItem("is_signing_out") === "true") {
    return (
      <PremiumLoadingScreen
        title="Signing out"
        subtitle="Securing your session"
      />
    );
  }

  // If loading auth status on a public route, do NOT show the heavy loading screen
  const isPublicRoute =
    path === "/" ||
    path.startsWith("/pricing") ||
    path.startsWith("/privacy") ||
    path.startsWith("/terms") ||
    path.startsWith("/contact") ||
    path.startsWith("/sign-in") ||
    path.startsWith("/sign-up");

  if (isPublicRoute) {
    return null;
  }

  if (path.startsWith("/dashboard")) {
    return (
      <PremiumLoadingScreen
        title="Fetching your resumes"
        subtitle="Preparing your dashboard"
      />
    );
  }

  if (path.startsWith("/builder")) {
    return <PremiumLoadingScreen title="Setting up your workspace" />;
  }

  if (path.startsWith("/cover-letter-builder")) {
    return (
      <PremiumLoadingScreen
        title="Loading Cover Letter Workspace..."
        subtitle="Preparing your professional writing canvas"
      />
    );
  }

  if (path.startsWith("/templates")) {
    return (
      <PremiumLoadingScreen
        title="Loading templates"
        subtitle="Fetching premium designs"
      />
    );
  }

  if (path.startsWith("/billing")) {
    return (
      <PremiumLoadingScreen
        title="Loading billing"
        subtitle="Checking your subscription"
      />
    );
  }

  if (path.startsWith("/settings")) {
    return (
      <PremiumLoadingScreen
        title="Loading settings"
        subtitle="Preparing your account"
      />
    );
  }

  return <PremiumLoadingScreen title="Loading..." />;
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: profile, isLoading } = useGetProfile();

  console.log("OnboardingGuard render:", {
    isLoading,
    location,
    onboardingCompleted: profile?.onboardingCompleted,
    onboardingSkipped: profile?.onboardingSkipped,
    profile
  });

  useEffect(() => {
    if (profile && !isLoading) {
      const path = stripBase(location);
      console.log("OnboardingGuard useEffect check:", {
        path,
        onboardingCompleted: profile.onboardingCompleted,
        onboardingSkipped: profile.onboardingSkipped,
        shouldRedirect: path !== "/onboarding" && !profile.onboardingCompleted && !profile.onboardingSkipped
      });
      if (path !== "/onboarding" && !profile.onboardingCompleted && !profile.onboardingSkipped) {
        console.log("OnboardingGuard redirecting to /onboarding");
        setLocation("/onboarding");
      }
    }
  }, [profile, isLoading, location, setLocation]);

  if (isLoading) {
    return <PremiumLoadingScreen title="Checking profile..." />;
  }

  return <>{children}</>;
}

function ProtectedRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const [location] = useLocation();

  if (!isLoaded) {
    return <AuthLoadingFallback />;
  }

  if (!isSignedIn) {
    return <Redirect to="/" />;
  }

  const path = stripBase(location);
  if (path === "/onboarding") {
    return <Component />;
  }

  return (
    <OnboardingGuard>
      <Component />
    </OnboardingGuard>
  );
}

function ClerkAuthTokenInitializer() {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn) {
        setAuthTokenGetter(() => getToken());
      } else {
        setAuthTokenGetter(null);
        // Clean up the sign-out flag once Clerk is loaded and user is signed out
        sessionStorage.removeItem("is_signing_out");
      }
    }
  }, [getToken, isSignedIn, isLoaded]);

  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = addListener((resources) => {
      const userId = resources.user?.id ?? null;
      const hasSession = !!resources.session;
      const prev = prevUserIdRef.current;

      // Full sign-out — drop cached queries and API auth.
      if (!hasSession) {
        if (prev != null) {
          qc.clear();
          setAuthTokenGetter(null);
          clearAllToasts();
        }
        prevUserIdRef.current = null;
        return;
      }

      // During `user.reload()` the user object can be briefly null while the session stays active.
      // Do not treat that as a sign-out or wipe the React Query cache (would blank dashboard/billing).
      if (!userId) {
        return;
      }

      if (prev === userId) {
        return;
      }

      // Rare: switched Clerk accounts without a full session teardown.
      if (prev != null && prev !== userId) {
        qc.clear();
      }

      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

/** Reset window scroll when the SPA path changes (wouter does not do this by default). */
function ScrollToTop() {
  const [pathname] = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return null;
}

import CoverLetterBuilderPage from "@/pages/cover-letter-builder";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route
        path="/dashboard"
        component={() => <ProtectedRoute component={DashboardPage} />}
      />
      <Route
        path="/onboarding"
        component={() => <ProtectedRoute component={OnboardingPage} />}
      />
      <Route
        path="/profile"
        component={() => <ProtectedRoute component={ProfilePage} />}
      />
      <Route
        path="/builder/:id"
        component={() => <ProtectedRoute component={BuilderPage} />}
      />
      <Route
        path="/cover-letter-builder/:id"
        component={() => <ProtectedRoute component={CoverLetterBuilderPage} />}
      />
      <Route
        path="/templates"
        component={() => <ProtectedRoute component={TemplatesPage} />}
      />
      <Route
        path="/billing"
        component={() => <ProtectedRoute component={BillingPage} />}
      />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route
        path="/settings/*?"
        component={() => <ProtectedRoute component={SettingsPage} />}
      />
      <Route path="/contact" component={ContactPage} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  const { resolvedTheme } = useTheme();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      {...(clerkProxyUrl ? { proxyUrl: clerkProxyUrl } : {})}
      appearance={getClerkAppearance(resolvedTheme)}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back to Resumesensei",
            subtitle: "Sign in to continue building your resume",
          },
        },
        signUp: {
          start: {
            title: "Create your Resumesensei account",
            subtitle: "Join thousands of professionals landing great jobs",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkAuthTokenInitializer />
        <ClerkQueryClientCacheInvalidator />
        <ScrollToTop />
        <TooltipProvider>
          <AppRouter />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  if (isE2E) {
    // E2E mode: allow responsive tests to run without Clerk secrets.
    return (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <WouterRouter base={basePath}>
          <ScrollToTop />
          <Switch>
            <Route path="/" component={LandingPage} />
            <Route path="/pricing" component={PricingPage} />
            <Route path="/privacy" component={PrivacyPage} />
            <Route path="/terms" component={TermsPage} />
            <Route path="/contact" component={ContactPage} />
            <Route
              path="/sign-in/*?"
              component={() => (
                <div className="flex min-h-[100dvh] items-center justify-center px-4">
                  <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6">
                    <h1 className="text-lg font-semibold">Sign in</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      E2E placeholder (Clerk disabled).
                    </p>
                  </div>
                </div>
              )}
            />
            <Route
              path="/sign-up/*?"
              component={() => (
                <div className="flex min-h-[100dvh] items-center justify-center px-4">
                  <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6">
                    <h1 className="text-lg font-semibold">Sign up</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      E2E placeholder (Clerk disabled).
                    </p>
                  </div>
                </div>
              )}
            />
            {/* Protected routes redirect to home in E2E mode */}
            <Route path="/dashboard" component={() => <Redirect to="/" />} />
            <Route path="/onboarding" component={() => <Redirect to="/" />} />
            <Route path="/profile" component={() => <Redirect to="/" />} />
            <Route path="/builder/:id" component={() => <Redirect to="/" />} />
            <Route
              path="/cover-letter-builder/:id"
              component={() => <Redirect to="/" />}
            />
            <Route path="/templates" component={() => <Redirect to="/" />} />
            <Route path="/billing" component={() => <Redirect to="/" />} />
            <Route path="/settings/*?" component={() => <Redirect to="/" />} />
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </WouterRouter>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
