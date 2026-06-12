import { useState } from "react";
import { useUser, useClerk, useAuth } from "@clerk/react";
import { Link, useLocation } from "wouter";
import {
  FileText,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  ChevronDown,
  Settings,
  Mail,
  Star,
  Zap,
  Menu,
  Shield,
  ScrollText,
  CreditCard,
  Lock,
  Tags,
  Loader2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProfileModal } from "./ProfileModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { ProBadge } from "@/components/shared/ProBadge";
import { ProButton } from "@/components/shared/ProButton";
import { ThemeToggle } from "./ThemeToggle";

const appNavLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/contact", label: "Contact", icon: Mail },
] as const;

/** Routes that work without signing in — never show dashboard/templates/billing here when signed out. */
const publicNavLinks = [
  { href: "/pricing", label: "Pricing", icon: Tags },
  { href: "/contact", label: "Contact", icon: Mail },
] as const;

export function Navbar() {
  const { user } = useUser();
  const { isSignedIn, isLoaded } = useAuth();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);

  const showAppNav = isLoaded && isSignedIn;
  const navLinks = showAppNav ? appNavLinks : publicNavLinks;
  const brandHref = showAppNav ? "/dashboard" : "/";

  return (
    <header className="sticky top-0 z-50 w-full max-w-[100vw] overflow-x-clip border-b border-border/60 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-6 lg:gap-8">
            <Link
              href={brandHref}
              className="flex items-center gap-1 min-[340px]:gap-1.5 min-[380px]:gap-2 text-foreground transition-opacity hover:opacity-90 min-w-0"
            >
              <img
                src={`${import.meta.env.BASE_URL}bluemascot.svg`}
                alt="Resumesensei mascot"
                className="h-7 w-7 min-[340px]:h-8 min-[340px]:w-8 min-[380px]:h-9 min-[380px]:w-9 sm:h-10 sm:w-10 object-contain shrink-0"
              />
              <span className="text-sm min-[340px]:text-base min-[380px]:text-xl font-extrabold tracking-tight sm:text-2xl truncate">
                Resume<span className="text-primary font-black">sensei</span>
              </span>
            </Link>
            <nav
              className="hidden lg:flex items-center gap-1"
              aria-label={showAppNav ? "App navigation" : "Site navigation"}
            >
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`px-2 lg:px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    location === href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 min-[380px]:gap-2 sm:gap-3">
            <ThemeToggle />
            {/* Mobile Menu */}
            <div className="lg:hidden flex items-center">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="px-2 h-8">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[240px] sm:w-[300px]">
                  <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                  <Link
                    href={brandHref}
                    className="flex items-center gap-2 text-foreground mb-4 mt-2 transition-opacity hover:opacity-90"
                  >
                    <img
                      src={`${import.meta.env.BASE_URL}bluemascot.svg`}
                      alt="Resumesensei mascot"
                      className="h-9 w-9 object-contain shrink-0"
                    />
                    <span className="text-xl font-extrabold tracking-tight">
                      Resume
                      <span className="text-primary font-black">sensei</span>
                    </span>
                  </Link>
                  {user && !user.publicMetadata?.isPremium ? (
                    <div className="mb-6 flex flex-col gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                      <p className="text-xs font-semibold text-foreground relative z-10">
                        Upgrade to Pro
                      </p>
                      <p className="text-[11px] leading-snug text-muted-foreground relative z-10">
                        Unlock unlimited AI resume builds, templates, and
                        exports.
                      </p>
                      <Link
                        href="/pricing"
                        className="w-full relative z-10 mt-1"
                      >
                        <ProButton
                          size="sm"
                          className="w-full h-8"
                          text="Upgrade to Pro"
                          showIcon
                        />
                      </Link>
                    </div>
                  ) : user?.publicMetadata?.isPremium ? (
                    <div className="mb-6 flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                      <div className="flex items-center gap-2 relative z-10">
                        <ProBadge size="default" />
                      </div>
                      <p className="text-xs leading-snug text-muted-foreground relative z-10 mt-0.5">
                        You have full access to premium features.
                      </p>
                    </div>
                  ) : null}
                  <nav
                    className="flex flex-col gap-2"
                    aria-label={
                      showAppNav ? "App navigation" : "Site navigation"
                    }
                  >
                    {navLinks.map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                          location === href
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </Link>
                    ))}
                  </nav>
                  {!showAppNav && isLoaded ? (
                    <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-center"
                        asChild
                      >
                        <Link href="/sign-in">Sign in</Link>
                      </Button>
                      {location !== "/pricing" && (
                        <Button
                          size="sm"
                          className="w-full justify-center"
                          asChild
                        >
                          <Link href="/sign-up">Get started free</Link>
                        </Button>
                      )}
                    </div>
                  ) : null}
                  <div className="mt-6 border-t border-border pt-4">
                    <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Legal
                    </p>
                    <div className="flex flex-col gap-1">
                      <Link
                        href="/privacy"
                        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                          location === "/privacy"
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <Shield className="h-4 w-4 shrink-0" />
                        Privacy
                      </Link>
                      <Link
                        href="/terms"
                        className={`flex items-start gap-3 rounded-md px-3 py-2.5 text-sm font-medium leading-snug transition-colors ${
                          location === "/terms"
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <ScrollText className="mt-0.5 h-4 w-4 shrink-0" />
                        Terms &amp; Conditions
                      </Link>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            {!showAppNav && isLoaded ? (
              <div className="hidden lg:flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-8" asChild>
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                {location !== "/pricing" && (
                  <Button size="sm" className="h-8" asChild>
                    <Link href="/sign-up">Get started</Link>
                  </Button>
                )}
              </div>
            ) : null}
            {user && (
              <>
                {user.publicMetadata?.isPremium ? (
                  <>
                    <div className="hidden sm:flex items-center">
                      <ProBadge size="sm" />
                    </div>
                    <div
                      className="flex sm:hidden items-center"
                      title="Resumesensei Pro"
                      aria-label="You are on the Pro plan"
                    >
                      <ProBadge size="sm" />
                    </div>
                  </>
                ) : (
                  <Link href="/pricing" className="flex items-center">
                    <ProButton
                      size="sm"
                      className="h-8 w-8 p-0 sm:w-auto sm:px-3 text-xs sm:text-sm rounded-full sm:rounded-md"
                      text={<span className="hidden sm:inline">Go Pro</span>}
                      showIcon
                    />
                  </Link>
                )}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-1 sm:gap-2 h-8 w-8 p-0 sm:w-auto sm:px-2 rounded-full sm:rounded-md"
                    >
                      <div className="h-6 w-6 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                        {user.firstName?.[0] ??
                          user.emailAddresses[0]?.emailAddress[0]?.toUpperCase() ??
                          "?"}
                      </div>
                      <span className="hidden sm:block text-sm max-w-[120px] truncate">
                        {user.firstName ?? user.emailAddresses[0]?.emailAddress}
                      </span>
                      <ChevronDown className="hidden sm:block h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <div className="px-2 py-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-medium">
                          {user.firstName} {user.lastName}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.emailAddresses[0]?.emailAddress}
                      </p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="cursor-pointer">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/templates" className="cursor-pointer">
                        <LayoutTemplate className="mr-2 h-4 w-4" />
                        Templates
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setProfileOpen(true)}
                      className="cursor-pointer"
                    >
                      <User className="mr-2 h-4 w-4" />
                      My Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/billing" className="cursor-pointer">
                        <CreditCard className="mr-2 h-4 w-4" />
                        Billing
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive cursor-pointer"
                      onClick={() => {
                        sessionStorage.setItem("is_signing_out", "true");
                        void signOut();
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function LandingNavbar() {
  return (
    <header className="sticky top-0 z-50 w-full max-w-[100vw] overflow-x-clip border-b border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl min-w-0 px-3 sm:px-6 lg:px-8">
        <div className="flex min-h-14 items-center justify-between gap-2 py-2 sm:py-0">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 text-foreground transition-opacity hover:opacity-90"
          >
            <img
              src={`${import.meta.env.BASE_URL}bluemascot.svg`}
              alt="Resumesensei mascot"
              className="h-9 w-9 object-contain shrink-0 sm:h-10 sm:w-10"
            />
            <span className="text-xl font-extrabold tracking-tight sm:text-2xl">
              Resume<span className="text-primary font-black">sensei</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center justify-end gap-2.5">
            <ThemeToggle />
            <Button
              size="sm"
              asChild
              className="h-9 px-3.5 text-xs sm:h-10 sm:px-5 sm:text-sm"
            >
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

import { useEffect, useRef } from "react";

export function BuilderNavbar({
  title,
  atsScore,
  isAtsOutdated,
  atsPremiumLocked,
  isAtsFetching,
  onAtsPremiumClick,
  onAtsScoreClick,
  onExport,
  onRename,
}: {
  title: string;
  atsScore?: number;
  isAtsOutdated?: boolean;
  isAtsFetching?: boolean;
  /** When true, show a locked ATS entry point instead of the numeric score (free users). */
  atsPremiumLocked?: boolean;
  onAtsPremiumClick?: () => void;
  onAtsScoreClick?: () => void;
  onExport: () => void;
  onRename?: (title: string) => void;
}) {
  const { user } = useUser();
  const { signOut } = useClerk();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title || "Untitled Resume");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) setEditTitle(title || "Untitled Resume");
  }, [title, isEditing]);

  const handleSave = () => {
    setIsEditing(false);
    if (editTitle.trim() !== title && onRename) {
      onRename(editTitle.trim() || "Untitled Resume");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setIsEditing(false);
      setEditTitle(title || "Untitled Resume");
    }
  };

  return (
    <header
      className={cn(
        "flex shrink-0 border-b border-border/60 bg-background px-4 max-w-[100vw] overflow-x-clip",
        isEditing
          ? "min-h-12 flex-col items-stretch gap-2 py-2 sm:h-12 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:py-0"
          : "h-12 items-center justify-between",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-3",
          isEditing
            ? "w-full sm:w-auto sm:min-w-[12rem] sm:flex-1"
            : "min-w-0 flex-1",
        )}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <img
            src={`${import.meta.env.BASE_URL}bluemascot.svg`}
            alt="Resumesensei mascot"
            className="h-8 w-8 object-contain shrink-0"
          />
          <FileText className="h-3.5 w-3.5" />
        </Link>
        <span className="text-muted-foreground shrink-0">/</span>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="h-8 min-w-0 flex-1 rounded-md border border-border bg-muted px-2 text-sm font-medium outline-none focus:ring-1 focus:ring-primary sm:h-7 sm:w-48 sm:flex-none sm:max-w-[min(240px,40vw)]"
            autoFocus
          />
        ) : (
          <button
            onClick={() => {
              if (onRename) setIsEditing(true);
            }}
            className="min-w-0 max-w-full truncate text-left text-sm font-medium hover:bg-muted px-2 py-1 -ml-2 rounded-md transition-colors cursor-text sm:max-w-[200px]"
            title="Click to rename"
          >
            {title || "Untitled Resume"}
          </button>
        )}
      </div>

      <div
        className={cn(
          "flex shrink-0 items-center gap-1.5 sm:gap-3",
          isEditing
            ? "w-full justify-end sm:w-auto sm:justify-start sm:ml-2"
            : "ml-2",
        )}
      >
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-muted-foreground mr-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3 w-3 text-primary/70"
          >
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
            <path d="M12 12v3" />
            <path d="m10 13 2-2 2 2" />
          </svg>
          <span className="text-[10px] font-medium tracking-wide">
            Saved to browser
          </span>
        </div>
        {atsPremiumLocked && onAtsPremiumClick && (
          <button
            type="button"
            onClick={onAtsPremiumClick}
            className="flex items-center gap-1 shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border border-dashed border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-100 hover:bg-amber-500/15 transition-colors max-w-[min(100%,9rem)]"
            title="ATS score — Pro feature"
          >
            <Lock
              className="h-3 w-3 shrink-0 text-amber-700 dark:text-amber-300"
              aria-hidden
            />
            <span className="truncate">ATS Pro</span>
          </button>
        )}
        {!atsPremiumLocked && isAtsFetching && (
          <div className="flex items-center gap-1 shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
            <span>Scanning...</span>
          </div>
        )}
        {!atsPremiumLocked && !isAtsFetching && atsScore !== undefined && (
          <button
            type="button"
            onClick={onAtsScoreClick}
            className="relative flex items-center gap-1.5 shrink-0 min-w-0 transition-transform hover:scale-105 active:scale-95"
            title={isAtsOutdated ? "ATS score may be outdated. Click to view and rescan." : "Click to view detailed ATS feedback"}
          >
            <div
              className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                atsScore >= 80
                  ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                  : atsScore >= 60
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400"
                    : "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
              }`}
            >
              <Zap className="h-3 w-3 fill-current" />
              <span>ATS {atsScore}</span>
            </div>
            {isAtsOutdated && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-white shadow-sm ring-1 ring-background" title="Outdated: Scan required">
                <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                <span className="relative z-10 leading-none">!</span>
              </span>
            )}
          </button>
        )}
        <ThemeToggle />
        <Button
          size="sm"
          variant="outline"
          onClick={onExport}
          className="h-7 text-xs"
        >
          Export
        </Button>
        {user && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 rounded-full"
              >
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                  {user.firstName?.[0] ?? "?"}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/dashboard" className="cursor-pointer">
                  Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive cursor-pointer"
                onClick={() => {
                  sessionStorage.setItem("is_signing_out", "true");
                  void signOut();
                }}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
