import { useEffect, useRef } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  Show,
  useClerk,
  useAuth,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { setAuthTokenGetter } from "@workspace/api-client-react";
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

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/bluemascot.svg`,
  },
  variables: {
    colorPrimary: "#4f46e5",
    colorForeground: "#0a0e1a",
    colorMutedForeground: "#6b7280",
    colorDanger: "#dc2626",
    colorBackground: "#ffffff",
    colorInput: "#f3f4f6",
    colorInputForeground: "#0a0e1a",
    colorNeutral: "#e5e7eb",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl border border-gray-100",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-gray-900 font-semibold",
    headerSubtitle: "text-gray-500",
    socialButtonsBlockButtonText: "text-gray-700 font-medium",
    formFieldLabel: "text-gray-700 font-medium",
    footerActionLink: "text-violet-600 font-medium hover:text-violet-700",
    footerActionText: "text-gray-500",
    dividerText: "text-gray-400",
    identityPreviewEditButton: "text-violet-600",
    formFieldSuccessText: "text-green-600",
    alertText: "text-red-600",
    logoBox: "flex justify-center mb-1",
    logoImage: "h-16 w-auto",
    socialButtonsBlockButton: "border border-gray-200 hover:bg-gray-50",
    formButtonPrimary:
      "bg-violet-600 hover:bg-violet-700 text-white font-medium",
    formFieldInput:
      "border-gray-200 focus:border-violet-500 focus:ring-violet-500 bg-white text-gray-900",
    footerAction: "bg-gray-50",
    dividerLine: "bg-gray-200",
    alert: "border border-red-100 bg-red-50",
    otpCodeFieldInput: "border-gray-200 text-gray-900",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-indigo-50 to-sky-50 px-4">
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
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-indigo-50 to-sky-50 px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function ProtectedRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  return (
    <>
      <Show when="signed-in">
        <Component />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkAuthTokenInitializer() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      setAuthTokenGetter(() => getToken());
    } else {
      setAuthTokenGetter(null);
    }
  }, [getToken, isSignedIn]);

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

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route
        path="/dashboard"
        component={() => <ProtectedRoute component={DashboardPage} />}
      />
      <Route
        path="/builder/:id"
        component={() => <ProtectedRoute component={BuilderPage} />}
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

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      {...(clerkProxyUrl ? { proxyUrl: clerkProxyUrl } : {})}
      appearance={clerkAppearance}
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
          <Route path="/builder/:id" component={() => <Redirect to="/" />} />
          <Route path="/templates" component={() => <Redirect to="/" />} />
          <Route path="/billing" component={() => <Redirect to="/" />} />
          <Route path="/settings/*?" component={() => <Redirect to="/" />} />
          <Route component={NotFound} />
        </Switch>
        <Toaster />
      </WouterRouter>
    );
  }

  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
