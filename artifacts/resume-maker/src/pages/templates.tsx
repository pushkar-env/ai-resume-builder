import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, ArrowRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Navbar } from "@/components/layout/Navbar";
import { ResumePreview } from "@/components/resume/ResumePreview";
import { SAMPLE_RESUME } from "@/lib/sample-resume";
import { useListTemplates, useCreateResume, getListResumesQueryKey, type ResumeDetail } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/react";
import { SEO } from "@/components/shared/SEO";
import { PaywallDialog } from "@/components/shared/PaywallDialog";
import { Zap } from "lucide-react";

/* ─── Per-template style config ─── */
const CONFIG: Record<string, { accent: string; bg: string }> = {
  "silicon-valley": { accent: "#6366f1", bg: "#0f1117" },
  "faang":          { accent: "#0ea5e9", bg: "#f0f9ff" },
  "nova":           { accent: "#64748b", bg: "#f8fafc" },
  "executive-pro":  { accent: "#92400e", bg: "#fffbeb" },
  "creative-pro":   { accent: "#ec4899", bg: "#fdf2f8" },
  "midnight":       { accent: "#d4a853", bg: "#0d1117" },
  "ats-clean":      { accent: "#1f2937", bg: "#f9fafb" },
  "academic":       { accent: "#1e40af", bg: "#eff6ff" },
  "corporate-navy": { accent: "#1e3a5f", bg: "#f0f4f8" },
  "compact":        { accent: "#059669", bg: "#f0fdf4" },
  "european":       { accent: "#7c3aed", bg: "#f5f3ff" },
  "two-column":     { accent: "#e11d48", bg: "#0f1117" },
};

const CATEGORY_COLORS: Record<string, string> = {
  Technical: "bg-blue-100 text-blue-700",
  Minimal: "bg-gray-100 text-gray-700",
  Executive: "bg-amber-100 text-amber-700",
  Creative: "bg-pink-100 text-pink-700",
  Premium: "bg-purple-100 text-purple-700",
  ATS: "bg-green-100 text-green-700",
  Academic: "bg-indigo-100 text-indigo-700",
  Professional: "bg-slate-100 text-slate-700",
  International: "bg-teal-100 text-teal-700",
};

/* ─── Real-resume thumbnail (scaled-down ResumePreview) ─── */
function TemplateThumbnail({ templateId, accent }: { templateId: string; accent: string }) {
  const sample: ResumeDetail = {
    ...SAMPLE_RESUME,
    templateId,
    accentColor: accent,
  };
  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <div
        style={{
          width: 794,
          transformOrigin: "top left",
          transform: "scale(0.36)",
          pointerEvents: "none",
        }}
      >
        <ResumePreview key={templateId} resume={sample} accentColor={accent} />
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useUser();
  const [selected, setSelected] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [showPaywall, setShowPaywall] = useState(false);
  
  const isPremiumUser = user?.publicMetadata?.isPremium === true;

  const { data: templates, isLoading } = useListTemplates();

  const createResume = useCreateResume({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListResumesQueryKey() });
        navigate(`/builder/${data.id}`);
      },
      onError: () => toast({ title: "Failed to create resume", variant: "destructive" }),
    },
  });

  const handleUseTemplate = (templateId: string) => {
    const template = templateList.find(t => t.id === templateId);
    if (template?.isPremium && !isPremiumUser) {
      setShowPaywall(true);
      return;
    }
    
    setCreating(true);
    createResume.mutate({ data: { title: "My Resume", templateId } });
  };

  const templateList = Array.isArray(templates) ? templates : [];
  const categories = ["All", ...Array.from(new Set(templateList.map(t => t.category).filter(Boolean)))];
  const filtered = activeCategory === "All" ? templateList : templateList.filter(t => t.category === activeCategory);

  const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
  const fadeUp = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO 
        title="Resume Templates | ResumeAI"
        description="Browse our collection of professional, ATS-optimized resume templates. From minimal to executive, find the perfect design for your career."
        canonicalUrl="https://resumeai.example.com/templates"
      />
      <Navbar />

      {/* Hero */}
      <div className="border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Premium Templates</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">Resume templates that get you hired</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              12 professionally designed templates — preview the actual layout with sample content,
              then customize with your own details.
            </p>
          </div>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Category filter */}
        <div className="flex gap-2 mb-7 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeCategory === cat
                  ? "bg-primary text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border overflow-hidden">
                <Skeleton className="aspect-[3/4] w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <motion.div initial="hidden" animate="visible" variants={stagger} className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((template) => {
              const cfg = CONFIG[template.id] ?? { accent: "#7c3aed", bg: "#f5f3ff" };
              const isSelected = selected === template.id;
              const isHovered = hoveredId === template.id;
              const catClass = CATEGORY_COLORS[template.category ?? ""] ?? "bg-gray-100 text-gray-600";

              return (
                <motion.div
                  key={template.id}
                  variants={fadeUp}
                  className={`group relative rounded-2xl border overflow-hidden cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/25 shadow-lg shadow-primary/10"
                      : "border-border hover:border-primary/40 hover:shadow-lg"
                  }`}
                  onClick={() => setSelected(isSelected ? null : template.id)}
                  onMouseEnter={() => setHoveredId(template.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Premium badge */}
                  {template.isPremium && (
                    <div className="absolute top-2.5 right-2.5 z-20">
                      <div className="relative">
                        <div className="absolute inset-0 bg-violet-500 rounded-full blur-[6px] opacity-60 animate-pulse"></div>
                        <Badge className="relative gap-1 text-[10px] h-5 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white border-0 shadow-md">
                          <Sparkles className="h-2.5 w-2.5" />
                          Pro
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Selected checkmark */}
                  {isSelected && (
                    <div className="absolute top-2.5 left-2.5 z-20 h-6 w-6 rounded-full bg-primary flex items-center justify-center shadow-md">
                      <Check className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}

                  {/* Real resume preview as thumbnail */}
                  <div
                    className="relative"
                    style={{ aspectRatio: "3/4", background: cfg.bg }}
                  >
                    <TemplateThumbnail templateId={template.id} accent={cfg.accent} />

                    {/* Gradient hint overlay (very subtle) */}
                    <div className="absolute inset-x-0 bottom-0 h-12 pointer-events-none bg-gradient-to-t from-black/10 to-transparent" />

                    {/* Hover overlay with CTA */}
                    <motion.div
                      className="absolute inset-0 flex items-center justify-center z-10"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: isHovered ? 1 : 0 }}
                      transition={{ duration: 0.15 }}
                      style={{ background: "rgba(0,0,0,0.5)" }}
                    >
                      <button
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white border border-white/40 bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm"
                        onClick={(e) => { e.stopPropagation(); void handleUseTemplate(template.id); }}
                      >
                        Use template <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  </div>

                  {/* Info */}
                  <div className="p-3.5 bg-background">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-foreground truncate">{template.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{template.description}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${catClass}`}>
                        {template.category}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {filtered.length === 0 && !isLoading && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">No templates in this category.</p>
          </div>
        )}
      </main>

      {/* Floating action bar */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-4 bg-background border border-border rounded-2xl shadow-2xl px-6 py-3.5">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <div>
                <p className="text-sm font-bold">{templateList.find(t => t.id === selected)?.name}</p>
                <p className="text-xs text-muted-foreground">Ready to use this template</p>
              </div>
              <Button
                onClick={() => handleUseTemplate(selected)}
                disabled={createResume.isPending || creating}
                className="gap-2 ml-2"
              >
                {createResume.isPending ? "Creating..." : "Start building"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              <button
                onClick={() => setSelected(null)}
                className="text-muted-foreground hover:text-foreground transition-colors text-xs"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PaywallDialog 
        open={showPaywall} 
        onOpenChange={setShowPaywall}
        title="Premium Template"
        description="This template is reserved for Pro users. Upgrade to unlock all templates, unlimited AI generation, and ATS optimization."
      />
    </div>
  );
}
