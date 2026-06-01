import { Link } from "wouter";
import { ArrowLeft, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/shared/SEO";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <SEO
        title="404 - Page Not Found | Resumesensei"
        description="The page you are looking for does not exist on Resumesensei."
        robots="noindex, nofollow"
      />
      <div className="text-center max-w-sm">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <FileSearch className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Page not found</h1>
        <p className="text-muted-foreground text-sm mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button asChild className="gap-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Go home
          </Link>
        </Button>
      </div>
    </div>
  );
}
