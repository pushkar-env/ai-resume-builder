import { useUser, useClerk } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { FileText, LayoutDashboard, LayoutTemplate, LogOut, ChevronDown, Settings, Mail, Star, Zap, Menu, Shield, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export function Navbar() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/templates", label: "Templates", icon: LayoutTemplate },
    { href: "/contact", label: "Contact Us", icon: Mail },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-foreground">
              <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="ResumeAI" className="h-7 w-7" />
              <span className="text-sm font-bold tracking-tight">ResumeAI</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
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

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Menu */}
            <div className="md:hidden flex items-center">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="px-2 h-8">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[240px] sm:w-[300px]">
                  <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                  <div className="flex items-center gap-2 font-semibold text-foreground mb-4 mt-2">
                    <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="ResumeAI" className="h-6 w-6" />
                    <span className="text-sm font-bold tracking-tight">ResumeAI</span>
                  </div>
                  {user?.publicMetadata?.isPremium ? (
                    <div className="mb-6 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-primary">
                      <Star className="mt-0.5 h-4 w-4 shrink-0 fill-primary text-primary" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide">Pro plan</p>
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          You have full access to premium features.
                        </p>
                      </div>
                    </div>
                  ) : null}
                  <nav className="flex flex-col gap-2">
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
                        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                          location === "/terms"
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <ScrollText className="h-4 w-4 shrink-0" />
                        Terms
                      </Link>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            {user && (
              <>
                {user.publicMetadata?.isPremium ? (
                  <>
                    <span className="hidden sm:flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded-full border border-primary/20">
                      <Star className="h-3 w-3 fill-primary text-primary" aria-hidden /> Pro
                    </span>
                    <span
                      className="flex sm:hidden items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary"
                      title="ResumeAI Pro"
                      aria-label="You are on the Pro plan"
                    >
                      <Star className="h-3 w-3 shrink-0 fill-primary text-primary" aria-hidden />
                      Pro
                    </span>
                  </>
                ) : (
                  <Button size="sm" className="hidden sm:flex h-8 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-sm gap-1.5 px-3" asChild>
                    <Link href="/pricing">
                      <Zap className="h-3.5 w-3.5 fill-white" /> Go Pro
                    </Link>
                  </Button>
                )}
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center gap-2 h-8 px-2">
                    <div className="h-6 w-6 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                      {user.firstName?.[0] ?? user.emailAddresses[0]?.emailAddress[0]?.toUpperCase() ?? "?"}
                    </div>
                    <span className="hidden sm:block text-sm max-w-[120px] truncate">
                      {user.firstName ?? user.emailAddresses[0]?.emailAddress}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-medium">
                        {user.firstName} {user.lastName}
                      </p>
                      {user.publicMetadata?.isPremium ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                          <Star className="h-2.5 w-2.5 fill-primary text-primary" aria-hidden />
                          Pro
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{user.emailAddresses[0]?.emailAddress}</p>
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
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive cursor-pointer"
                    onClick={() => signOut()}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="ResumeAI" className="h-7 w-7" />
            <span className="text-sm font-bold tracking-tight">ResumeAI</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/sign-up">Get started free</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

import { useState, useEffect, useRef } from "react";

export function BuilderNavbar({ title, atsScore, onExport, onRename }: { title: string; atsScore?: number; onExport: () => void; onRename?: (title: string) => void }) {
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
    <header className="flex h-12 items-center justify-between border-b border-border/60 bg-background px-4 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="ResumeAI" className="h-5 w-5" />
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
            className="h-7 w-40 sm:w-48 max-w-[55vw] px-2 text-sm font-medium bg-muted border-border rounded-md outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
        ) : (
          <button
            onClick={() => {
              if (onRename) setIsEditing(true);
            }}
            className="text-sm font-medium truncate max-w-[120px] sm:max-w-[200px] hover:bg-muted px-2 py-1 -ml-2 rounded-md transition-colors cursor-text text-left"
            title="Click to rename"
          >
            {title || "Untitled Resume"}
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 ml-2">
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-muted-foreground mr-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 text-primary/70">
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
            <path d="M12 12v3"/>
            <path d="m10 13 2-2 2 2"/>
          </svg>
          <span className="text-[10px] font-medium tracking-wide">Saved to browser</span>
        </div>
        {atsScore !== undefined && (
          <div className="flex items-center gap-1.5">
            <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              atsScore >= 80 ? "bg-green-100 text-green-700" :
              atsScore >= 60 ? "bg-yellow-100 text-yellow-700" :
              "bg-red-100 text-red-700"
            }`}>
              ATS {atsScore}
            </div>
          </div>
        )}
        <Button size="sm" variant="outline" onClick={onExport} className="h-7 text-xs">
          Export
        </Button>
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                  {user.firstName?.[0] ?? "?"}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/dashboard" className="cursor-pointer">Dashboard</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive cursor-pointer" onClick={() => signOut()}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
