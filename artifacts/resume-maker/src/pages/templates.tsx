import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProBadge } from "@/components/shared/ProBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Navbar } from "@/components/layout/Navbar";
import { AppFooter } from "@/components/layout/AppFooter";
import {
  useListTemplates,
  useCreateResume,
  createResume as createResumeApi,
  getListResumesQueryKey,
  useListResumes,
} from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { useUser } from "@clerk/react";
import { SEO } from "@/components/shared/SEO";
import { PaywallDialog } from "@/components/shared/PaywallDialog";
import { PremiumLoadingScreen } from "@/components/shared/PremiumLoadingScreen";
import {
  createResumeMutationOptions,
  resumeOperationErrorMessage,
  withResumeMutationRetry,
} from "@/lib/resume-api-request";
import { Zap } from "lucide-react";
import { SITE_URL } from "@/lib/brand";
import {
  previewCardHoverTransition,
  previewCardWhileHover,
  previewCardWhileTap,
} from "@/lib/preview-card-hover";
import { CreateResumeDialog } from "@/components/resume/CreateResumeDialog";

import { TEMPLATE_CONFIG } from "@/lib/template-config";

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

import { TemplateThumbnail } from "@/components/resume/TemplateThumbnail";

export default function TemplatesPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useUser();
  const coarsePointer = useCoarsePointer();
  const [selected, setSelected] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [prefillType, setPrefillType] = useState<"starter" | "personal" | "empty">("starter");
  const [newTitle, setNewTitle] = useState("My Resume");
  const [prefillOpen, setPrefillOpen] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallTitle, setPaywallTitle] = useState("Premium Feature");
  const [paywallDescription, setPaywallDescription] = useState(
    "This feature is reserved for Pro users.",
  );

  const isPremiumUser = user?.publicMetadata?.isPremium === true;

  const { data: templates, isLoading } = useListTemplates();
  const { data: resumes } = useListResumes();
  const resumeList = Array.isArray(resumes) ? resumes : [];

  const createResume = useCreateResume({
    request: createResumeMutationOptions(),
    mutation: {
      mutationFn: ({ data }) =>
        withResumeMutationRetry(() =>
          createResumeApi(data, createResumeMutationOptions()),
        ),
      onSuccess: (data) => {
        setCreating(false);
        queryClient.invalidateQueries({ queryKey: getListResumesQueryKey() });
        navigate(`/builder/${data.id}`);
      },
      onError: (error: any) => {
        setCreating(false);
        toast({
          title: "Failed to create resume",
          description: resumeOperationErrorMessage(
            error,
            "Unknown error occurred",
          ),
          variant: "destructive",
        });
      },
    },
  });

  const handleUseTemplate = (templateId: string) => {
    const template = templateList.find((t) => t.id === templateId);
    if (template?.isPremium && !isPremiumUser) {
      setPaywallTitle("Premium Template");
      setPaywallDescription(
        "This template is reserved for Pro users. Upgrade to unlock all templates, unlimited AI generation, and ATS optimization.",
      );
      setShowPaywall(true);
      return;
    }

    setSelectedTemplateId(templateId);
    setNewTitle(`My ${template?.name || "Resume"}`);
    setPrefillType("starter");
    setPrefillOpen(true);
  };

  const handleConfirmCreate = () => {
    if (!selectedTemplateId || !newTitle.trim()) return;

    setPrefillOpen(false);
    setCreating(true);
    const cfg = TEMPLATE_CONFIG[selectedTemplateId] ?? {
      accent: "#000000",
      bg: "#f8fafc",
    };
    createResume.mutate({
      data: {
        title: newTitle,
        templateId: selectedTemplateId,
        accentColor: cfg.accent,
        startPrefilled: prefillType !== "empty",
        prefillType: prefillType,
      },
    });
  };

  const templateList = Array.isArray(templates) ? templates : [];
  const categories = [
    "All",
    ...Array.from(new Set(templateList.map((t) => t.category).filter(Boolean))),
  ];
  const filtered =
    activeCategory === "All"
      ? templateList
      : templateList.filter((t) => t.category === activeCategory);

  const stagger = coarsePointer
    ? { hidden: {}, visible: { transition: { staggerChildren: 0 } } }
    : { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
  const fadeUp = coarsePointer
    ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
    : {
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
      };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AnimatePresence>
        {(creating || createResume.isPending) && (
          <PremiumLoadingScreen
            key="template-create-loading"
            title="Creating your resume"
            subtitle="Applying template and sample sections"
          />
        )}
      </AnimatePresence>
      <SEO
        title="Resume Templates | Resumesensei"
        description="Browse our collection of professional, ATS-optimized resume templates. From minimal to executive, find the perfect design for your career."
        canonicalUrl={`${SITE_URL}/templates`}
        robots="noindex, nofollow"
      />
      <Navbar />

      {/* Hero */}
      <div className="border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Premium Templates
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">
              Resume templates that get you hired
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              12 professionally designed templates — preview the actual layout
              with sample content, then customize with your own details.
            </p>
          </div>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Category filter */}
        <div className="flex gap-2 mb-7 flex-wrap">
          {categories.map((cat) => (
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

        <AnimatePresence mode="wait">
          {isLoading ? (
            <PremiumLoadingScreen
              key="templates-loading"
              title="Loading templates"
              subtitle="Fetching premium designs"
            />
          ) : (
            <motion.div
              key="templates-content"
              initial="hidden"
              animate="visible"
              variants={stagger}
              className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
            >
              {filtered.map((template) => {
                const cfg = TEMPLATE_CONFIG[template.id] ?? {
                  accent: "#000000",
                  bg: "#f8fafc",
                };
                const isSelected = selected === template.id;
                const isHovered = hoveredId === template.id;
                const catClass =
                  CATEGORY_COLORS[template.category ?? ""] ??
                  "bg-gray-100 text-gray-600";

                return (
                  <motion.div
                    key={template.id}
                    variants={fadeUp}
                    transition={previewCardHoverTransition}
                    whileHover={
                      coarsePointer
                        ? undefined
                        : {
                            ...previewCardWhileHover,
                            transition: previewCardHoverTransition,
                          }
                    }
                    whileTap={previewCardWhileTap}
                    className={`group relative rounded-2xl border overflow-hidden cursor-pointer transition-[box-shadow,border-color] duration-300 [content-visibility:auto] [contain-intrinsic-size:auto_420px] ${
                      coarsePointer ? "" : "[will-change:transform]"
                    } ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/25 shadow-xl shadow-primary/10"
                        : "border-border hover:border-primary/45 hover:shadow-xl"
                    }`}
                    onClick={() => setSelected(isSelected ? null : template.id)}
                    onMouseEnter={() => setHoveredId(template.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {/* Premium badge */}
                    {template.isPremium && !isPremiumUser && (
                      <ProBadge
                        size="sm"
                        className="absolute top-2.5 right-2.5 z-20"
                      />
                    )}

                    {/* Selected checkmark */}
                    {isSelected && (
                      <div className="absolute top-2.5 left-2.5 z-20 h-6 w-6 rounded-full bg-primary flex items-center justify-center shadow-md">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}

                    {/* Real resume preview as thumbnail */}
                    <div
                      className="relative overflow-hidden"
                      style={{ aspectRatio: "3/4", background: cfg.bg }}
                    >
                      <TemplateThumbnail
                        templateId={template.id}
                        accent={cfg.accent}
                        showWatermark={user?.publicMetadata?.isPremium !== true}
                      />

                      {/* Gradient hint overlay (very subtle) */}
                      <div className="absolute inset-x-0 bottom-0 h-12 pointer-events-none bg-gradient-to-t from-black/10 to-transparent" />

                      {/* Hover overlay with CTA */}
                      <motion.div
                        className={`absolute inset-0 flex items-center justify-center z-10 ${!isHovered ? "pointer-events-none" : ""}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isHovered ? 1 : 0 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                        style={{ background: "rgba(0,0,0,0.52)" }}
                      >
                        <button
                          type="button"
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white border border-white/35 bg-white/10 hover:bg-white/18 transition-[transform,colors] duration-200 ease-out backdrop-blur-sm ${
                            isHovered ? "translate-y-0" : "translate-y-1.5"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleUseTemplate(template.id);
                          }}
                        >
                          Use template <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    </div>

                    {/* Info */}
                    <div className="p-3.5 bg-background">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-foreground truncate">
                            {template.name}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                            {template.description}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${catClass}`}
                        >
                          {template.category}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {filtered.length === 0 && !isLoading && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">No templates in this category.</p>
          </div>
        )}
      </main>

      <AppFooter />

      {/* Floating action bar */}
      <AnimatePresence>
        {selected && !creating && !createResume.isPending && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-4 sm:bottom-6 z-50 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:w-auto sm:max-w-[720px] sm:-translate-x-1/2"
          >
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2 bg-background border border-border rounded-2xl shadow-2xl px-4 sm:px-6 py-3.5">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <div>
                <p className="text-sm font-bold">
                  {templateList.find((t) => t.id === selected)?.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ready to use this template
                </p>
              </div>
              <Button
                onClick={() => handleUseTemplate(selected)}
                disabled={createResume.isPending || creating}
                className="gap-2 sm:ml-2 w-full sm:w-auto"
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

      {/* Create Dialog */}
      <CreateResumeDialog
        open={prefillOpen}
        onOpenChange={setPrefillOpen}
        title={newTitle}
        onTitleChange={setNewTitle}
        prefillType={prefillType}
        onPrefillTypeChange={setPrefillType}
        onConfirm={handleConfirmCreate}
        isCreating={createResume.isPending || creating}
      />

      <PaywallDialog
        open={showPaywall}
        onOpenChange={setShowPaywall}
        title={paywallTitle}
        description={paywallDescription}
      />
    </div>
  );
}
