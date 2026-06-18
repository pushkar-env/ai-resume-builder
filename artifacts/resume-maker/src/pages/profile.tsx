import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProfile,
  useUpdateProfile,
  useGenerateSummary,
  useImproveBullet,
  useListResumes,
  useExtractProfileFromResume,
  getGetProfileQueryKey,
} from "@workspace/api-client-react";
import { createAiQuickRequestOptions } from "@/lib/ai-request";
import { plainTextToRichHtml, richHtmlToPlainText } from "@/lib/ai-rich-text";
import { resolveProfileBullets, syncBulletsToDescription } from "@/lib/profile-bullets";
import { ExtractFromResumeDialog } from "@/components/resume/ExtractFromResumeDialog";
import {
  CollapsibleEditableBlock,
  BlockPreview,
} from "@/components/resume/CollapsibleEditableBlock";
import { useCollapsibleList } from "@/hooks/use-collapsible-list";
import { Button } from "@/components/ui/button";
import { BulletListEditor } from "@/components/ui/BulletListEditor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SEO } from "@/components/shared/SEO";
import { useToast } from "@/hooks/use-toast";
import { Navbar } from "@/components/layout/Navbar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Loader2,
  Upload,
  Plus,
  Trash2,
  X,
  User,
  Compass,
  Briefcase,
  Wrench,
  FolderGit,
  Award,
  Settings,
  Save,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  FileDown,
} from "lucide-react";

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useGetProfile();
  const { mutate: updateProfile, isPending: isUpdating } = useUpdateProfile({
    mutation: {
      onSuccess: (data, variables) => {
        queryClient.setQueryData(getGetProfileQueryKey(), (oldProfile: any) => {
          if (!oldProfile) return data;
          const onboardingCompleted = variables?.data?.onboardingCompleted !== undefined
            ? data.onboardingCompleted
            : oldProfile.onboardingCompleted;
          const onboardingSkipped = variables?.data?.onboardingSkipped !== undefined
            ? data.onboardingSkipped
            : oldProfile.onboardingSkipped;
          const onboardingProgress = variables?.data?.onboardingProgress !== undefined
            ? data.onboardingProgress
            : oldProfile.onboardingProgress;
          return {
            ...oldProfile,
            ...data,
            onboardingCompleted,
            onboardingSkipped,
            onboardingProgress,
          };
        });
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        toast({ title: "Profile saved successfully!" });
      },
      onError: (err: any) => {
        toast({
          title: "Save failed",
          description: err.message || "An error occurred.",
          variant: "destructive",
        });
      },
    },
  });

  const generateSummary = useGenerateSummary({
    request: createAiQuickRequestOptions(),
  });
  const improveBullet = useImproveBullet({
    request: createAiQuickRequestOptions(),
  });

  const { data: resumes } = useListResumes();
  const resumeList = resumes ?? [];
  const hasResumes = resumeList.length > 0;
  const [showExtractDialog, setShowExtractDialog] = useState(false);
  const { mutate: extractFromResume, isPending: isExtracting } =
    useExtractProfileFromResume();

  const [activeTab, setActiveTab] = useState("personal");

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [locationStr, setLocationStr] = useState("");
  const [photo, setPhoto] = useState("");
  const [socials, setSocials] = useState<{ label: string; url: string }[]>([]);

  const [jobTitle, setJobTitle] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState<number | "">("");
  const [aboutMe, setAboutMe] = useState("");

  const [experience, setExperience] = useState<
    {
      company: string;
      title: string;
      startDate: string;
      endDate: string;
      location: string;
      description: string;
      currentlyWorking: boolean;
      bullets?: string[];
    }[]
  >([]);

  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");

  const [projects, setProjects] = useState<
    {
      name: string;
      description: string;
      technologiesUsed?: string;
      url?: string;
      github?: string;
      bullets?: string[];
    }[]
  >([]);

  const [certifications, setCertifications] = useState<
    {
      name: string;
      issuer: string;
      date: string;
      credentialUrl?: string;
    }[]
  >([]);

  const [education, setEducation] = useState<
    {
      school: string;
      degree: string;
      field: string;
      startDate: string;
      endDate: string;
      gpa: string;
      gpaMode: string;
    }[]
  >([]);

  // Per-block collapse/expand state (UI only — never persisted).
  const expCollapse = useCollapsibleList();
  const eduCollapse = useCollapsibleList();
  const projCollapse = useCollapsibleList();
  const certCollapse = useCollapsibleList();

  // States for detecting unsaved changes and confirmation modal
  const [initialData, setInitialData] = useState<any>(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const hasInitializedRef = useRef(false);

  // Load profile data into form state
  useEffect(() => {
    if (profile && !hasInitializedRef.current) {
      const initialName = profile.name || "";
      const initialEmail = profile.email || "";
      const initialPhone = profile.phone || "";
      const initialLocation = profile.location || "";
      const initialPhoto = profile.photo || "";
      const initialSocials = (profile.socials as { label: string; url: string }[]) || [];
      const initialJobTitle = profile.jobTitle || "";
      const initialYears = profile.yearsOfExperience ?? "";
      const initialAbout = profile.aboutMe || "";
      const initialExperience = ((profile.experience as any[]) || []).map(exp => ({
        company: exp.company || "",
        title: exp.title || "",
        startDate: exp.startDate || "",
        endDate: exp.endDate || "",
        location: exp.location || "",
        description: exp.description || "",
        currentlyWorking: !!exp.currentlyWorking,
        bullets: resolveProfileBullets(exp.bullets, exp.description),
      }));
      const initialSkills = profile.skills || [];
      const initialProjects = ((profile.projects as any[]) || []).map(proj => ({
        name: proj.name || "",
        description: proj.description || "",
        technologiesUsed: proj.technologiesUsed || "",
        url: proj.url || "",
        github: proj.github || "",
        bullets: resolveProfileBullets(proj.bullets, proj.description),
      }));
      const initialCertifications = (profile.certifications as any[]) || [];
      const initialEducation = ((profile.education as any[]) || []).map(edu => ({
        school: edu.school || "",
        degree: edu.degree || "",
        field: edu.field || "",
        startDate: edu.startDate || "",
        endDate: edu.endDate || "",
        gpa: edu.gpa || "",
        gpaMode: edu.gpaMode || "gpa",
      }));

      setName(initialName);
      setEmail(initialEmail);
      setPhone(initialPhone);
      setLocationStr(initialLocation);
      setPhoto(initialPhoto);
      setSocials(initialSocials);
      setJobTitle(initialJobTitle);
      setYearsOfExperience(initialYears);
      setAboutMe(initialAbout);
      setExperience(initialExperience);
      setEducation(initialEducation);
      setSkills(initialSkills);
      setProjects(initialProjects);
      setCertifications(initialCertifications);

      setInitialData(JSON.parse(JSON.stringify({
        name: initialName,
        email: initialEmail,
        phone: initialPhone,
        location: initialLocation,
        photo: initialPhoto,
        socials: initialSocials,
        jobTitle: initialJobTitle,
        yearsOfExperience: initialYears,
        aboutMe: initialAbout,
        experience: initialExperience,
        education: initialEducation,
        skills: initialSkills,
        projects: initialProjects,
        certifications: initialCertifications,
      })));

      hasInitializedRef.current = true;
    }
  }, [profile]);

  const hasUnsavedChanges = () => {
    if (!initialData) return false;
    
    const currentName = name.trim();
    const initialName = initialData.name.trim();
    if (currentName !== initialName) return true;

    const currentEmail = email.trim();
    const initialEmail = initialData.email.trim();
    if (currentEmail !== initialEmail) return true;

    const currentPhone = phone.trim();
    const initialPhone = initialData.phone.trim();
    if (currentPhone !== initialPhone) return true;

    const currentLocation = locationStr.trim();
    const initialLocation = initialData.location.trim();
    if (currentLocation !== initialLocation) return true;

    if (photo !== initialData.photo) return true;

    const currentJobTitle = jobTitle.trim();
    const initialJobTitle = initialData.jobTitle.trim();
    if (currentJobTitle !== initialJobTitle) return true;

    const currentYoe = yearsOfExperience === "" ? null : yearsOfExperience;
    const initialYoe = initialData.yearsOfExperience === "" ? null : initialData.yearsOfExperience;
    if (currentYoe !== initialYoe) return true;

    const currentAbout = aboutMe.trim();
    const initialAbout = initialData.aboutMe.trim();
    if (currentAbout !== initialAbout) return true;

    // Compare arrays/objects
    if (JSON.stringify(socials) !== JSON.stringify(initialData.socials)) return true;
    if (JSON.stringify(experience) !== JSON.stringify(initialData.experience)) return true;
    if (JSON.stringify(education) !== JSON.stringify(initialData.education)) return true;
    if (JSON.stringify(skills) !== JSON.stringify(initialData.skills)) return true;
    if (JSON.stringify(projects) !== JSON.stringify(initialData.projects)) return true;
    if (JSON.stringify(certifications) !== JSON.stringify(initialData.certifications)) return true;

    return false;
  };

  const handleCancel = () => {
    if (hasUnsavedChanges()) {
      setShowConfirmClose(true);
    } else {
      setLocation("/dashboard");
    }
  };

  const handleDiscard = () => {
    setShowConfirmClose(false);
    setLocation("/dashboard");
  };

  const handleSave = (onSaveSuccess?: () => void) => {
    if (!name.trim() || !email.trim()) {
      toast({
        title: "Required Fields Missing",
        description: "Full Name and Email are required.",
        variant: "destructive",
      });
      return;
    }
    updateProfile(
      {
        data: {
          name,
          email,
          phone,
          location: locationStr,
          photo,
          socials,
          jobTitle,
          yearsOfExperience: typeof yearsOfExperience === "number" ? yearsOfExperience : null,
          aboutMe,
          experience,
          education,
          skills,
          projects,
          certifications,
        },
      },
      {
        onSuccess: () => {
          setInitialData({
            name,
            email,
            phone,
            location: locationStr,
            photo,
            socials,
            jobTitle,
            yearsOfExperience,
            aboutMe,
            experience,
            education,
            skills,
            projects,
            certifications,
          });
          if (onSaveSuccess) {
            onSaveSuccess();
          } else {
            setLocation("/dashboard");
          }
        },
      }
    );
  };

  const handleRerunOnboarding = () => {
    updateProfile({
      data: {
        name,
        email,
        phone,
        location: locationStr,
        photo,
        socials,
        jobTitle,
        yearsOfExperience: typeof yearsOfExperience === "number" ? yearsOfExperience : null,
        aboutMe,
        experience,
        education,
        skills,
        projects,
        certifications,
        onboardingCompleted: false,
        onboardingSkipped: false,
        onboardingProgress: 1,
      },
    });
    toast({
      title: "Onboarding restarted",
      description: "Redirecting you to the onboarding flow...",
    });
    setLocation("/onboarding");
  };

  const handleExtractFromResume = (resumeId: number) => {
    extractFromResume(
      { data: { resumeId } },
      {
        onSuccess: (data) => {
          // Populate the form with the extracted fields. Nothing is persisted —
          // the existing unsaved-changes guard lets the user review then Save.
          setName(data.name || "");
          setEmail(data.email || "");
          setPhone(data.phone || "");
          setLocationStr(data.location || "");
          setPhoto(data.photo || "");
          setSocials((data.socials as { label: string; url: string }[]) || []);
          setJobTitle(data.jobTitle || "");
          setYearsOfExperience(
            typeof data.yearsOfExperience === "number" ? data.yearsOfExperience : "",
          );
          setAboutMe(data.aboutMe || "");
          setExperience(
            ((data.experience as any[]) || []).map((exp) => ({
              company: exp.company || "",
              title: exp.title || "",
              startDate: exp.startDate || "",
              endDate: exp.endDate || "",
              location: exp.location || "",
              description: exp.description || "",
              currentlyWorking: !!exp.currentlyWorking,
              bullets: resolveProfileBullets(exp.bullets, exp.description),
            })),
          );
          setEducation(
            ((data.education as any[]) || []).map((edu) => ({
              school: edu.school || "",
              degree: edu.degree || "",
              field: edu.field || "",
              startDate: edu.startDate || "",
              endDate: edu.endDate || "",
              gpa: edu.gpa || "",
              gpaMode: edu.gpaMode || "gpa",
            })),
          );
          setSkills((data.skills as string[]) || []);
          setProjects(
            ((data.projects as any[]) || []).map((proj) => ({
              name: proj.name || "",
              description: proj.description || "",
              technologiesUsed: proj.technologiesUsed || "",
              url: proj.url || "",
              github: proj.github || "",
              bullets: resolveProfileBullets(proj.bullets, proj.description),
            })),
          );
          setCertifications(
            ((data.certifications as any[]) || []).map((cert) => ({
              name: cert.name || "",
              issuer: cert.issuer || "",
              date: cert.date || "",
              credentialUrl: cert.credentialUrl || "",
            })),
          );
          setShowExtractDialog(false);
          setActiveTab("personal");
          toast({
            title: "Profile populated from resume",
            description: "Review the imported details, then click Save Profile to keep them.",
          });
        },
        onError: (err: any) => {
          toast({
            title: "Extraction failed",
            description: err?.message || "Could not extract details from that resume.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1_000_000) {
        toast({
          title: "Image too large",
          description: "Please choose an image smaller than 1MB.",
          variant: "destructive",
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // AI actions
  const handleAISummary = () => {
    if (!jobTitle.trim()) {
      toast({
        title: "Job Title Required",
        description: "Please specify a job title first so AI has context.",
        variant: "destructive",
      });
      return;
    }
    generateSummary.mutate(
      {
        data: {
          jobTitle,
          yearsOfExperience: typeof yearsOfExperience === "number" ? yearsOfExperience : undefined,
          skills,
          currentText: aboutMe || undefined,
        },
      },
      {
        onSuccess: (res) => {
          if (res.text) {
            setAboutMe(res.text);
            toast({ title: "Summary polished with AI!" });
          }
        },
      }
    );
  };

  const handleAIImproveExperience = (index: number) => {
    const exp = experience[index];
    if (!exp.description.trim()) {
      toast({
        title: "Description Empty",
        description: "Please write some description notes first for the AI to improve.",
        variant: "destructive",
      });
      return;
    }
    improveBullet.mutate(
      {
        data: {
          bullet: exp.description,
          context: `${exp.title} at ${exp.company}`,
        },
      },
      {
        onSuccess: (res) => {
          if (res.text) {
            const updated = [...experience];
            updated[index].description = richHtmlToPlainText(res.text);
            setExperience(updated);
            toast({ title: "Experience description polished!" });
          }
        },
      }
    );
  };

  const handleAIImproveProject = (index: number) => {
    const proj = projects[index];
    if (!proj.description.trim()) {
      toast({
        title: "Description Empty",
        description: "Please write some description notes first.",
        variant: "destructive",
      });
      return;
    }
    improveBullet.mutate(
      {
        data: {
          bullet: proj.description,
          context: `Project: ${proj.name}`,
        },
      },
      {
        onSuccess: (res) => {
          if (res.text) {
            const updated = [...projects];
            updated[index].description = richHtmlToPlainText(res.text);
            setProjects(updated);
            toast({ title: "Project description polished!" });
          }
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
          <p className="text-sm text-muted-foreground">Loading Professional Profile...</p>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: "personal", label: "Personal Details", icon: User },
    { id: "summary", label: "Professional Summary", icon: Compass },
    { id: "experience", label: "Work Experience", icon: Briefcase },
    { id: "education", label: "Education", icon: GraduationCap },
    { id: "skills", label: "Skills", icon: Wrench },
    { id: "projects", label: "Projects", icon: FolderGit },
    { id: "certifications", label: "Certifications", icon: Award },
    { id: "settings", label: "Onboarding Settings", icon: Settings },
  ];

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const activeTabIndex = TABS.findIndex((t) => t.id === activeTab);

  const handlePrevTab = () => {
    if (activeTabIndex > 0) {
      setActiveTab(TABS[activeTabIndex - 1].id);
    }
  };

  const handleNextTab = () => {
    if (activeTabIndex < TABS.length - 1) {
      setActiveTab(TABS[activeTabIndex + 1].id);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const start = touchStartRef.current;
    touchStartRef.current = null;

    const diffX = start.x - e.changedTouches[0].clientX;
    const diffY = start.y - e.changedTouches[0].clientY;

    // Only switch tabs if the horizontal swipe is greater than 60px
    // and significantly larger than any vertical swipe/scrolling movement
    if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        handleNextTab();
      } else {
        handlePrevTab();
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <SEO title="Professional Profile | Resumesensei" description="Edit your professional profile for automated resume prefills." />
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Left Navigation Sidebar */}
          <aside className="w-full md:w-64 bg-card/40 border border-border/80 rounded-2xl p-4 shrink-0 backdrop-blur-xl flex flex-col gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-0 md:mb-4 hidden md:block">Profile Sections</h2>
            
            {/* Mobile Navigation Header */}
            <div className="flex md:hidden items-center justify-between w-full bg-background/40 border border-border/50 rounded-xl px-2 py-1.5 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handlePrevTab}
                disabled={activeTabIndex === 0}
                className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-30 shrink-0"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <div className="flex flex-col items-center gap-0.5 text-center">
                {(() => {
                  const activeTabItem = TABS[activeTabIndex];
                  const ActiveIcon = activeTabItem.icon;
                  return (
                    <>
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-foreground">
                        <ActiveIcon className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                        <span>{activeTabItem.label}</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground/60 font-medium tracking-wide">
                        Section {activeTabIndex + 1} of {TABS.length} • Swipe to navigate
                      </span>
                    </>
                  );
                })()}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleNextTab}
                disabled={activeTabIndex === TABS.length - 1}
                className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-30 shrink-0"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Desktop Navigation List */}
            <nav className="hidden md:flex flex-col gap-1.5">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                      activeTab === tab.id
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-border/85 mt-0 md:mt-2 pt-4 px-1 md:px-3 flex flex-col gap-3">
              <div
                title={
                  hasResumes
                    ? "Auto-fill your profile from one of your resumes"
                    : "Create a resume first to use this"
                }
              >
                <Button
                  variant="outline"
                  onClick={() => setShowExtractDialog(true)}
                  disabled={!hasResumes || isExtracting}
                  className="w-full gap-1.5 border-indigo-500/30 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-50"
                >
                  {isExtracting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                  Extract from Resume
                </Button>
              </div>
              <Button
                onClick={() => handleSave()}
                disabled={isUpdating}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-lg shadow-indigo-600/10"
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Profile
              </Button>
            </div>
          </aside>

          {/* Right Content Pane wrapper — relative so the close button can sit on the card edge */}
          <div className="flex-1 w-full relative">
            {/* Cancel/Close Button — perched on the top-right corner of the card */}
            <button
              type="button"
              onClick={handleCancel}
              className="absolute right-2 -top-2.5 md:-right-2.5 md:-top-2.5 z-30 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted border border-border bg-background backdrop-blur-sm transition-all hover:scale-110 duration-200 shadow-lg shadow-black/10 flex items-center justify-center cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Close Profile</span>
            </button>

            <section
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="w-full bg-card/40 border border-border/80 rounded-2xl p-6 md:p-8 min-h-[500px] relative overflow-hidden backdrop-blur-xl"
            >
              {/* Ambient lighting elements */}
              <div className="absolute top-0 right-0 h-40 w-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 h-40 w-40 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* TAB: Personal Details */}
            {activeTab === "personal" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Personal Details</h3>
                  <p className="text-xs text-muted-foreground mt-1">Configure your personal contact fields and resume header options.</p>
                </div>

                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-24 w-24 rounded-full border border-border overflow-hidden bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground">
                      {photo ? (
                        <img src={photo} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        name ? name.split(/\s+/).map(n => n[0]).slice(0, 2).join("").toUpperCase() : "?"
                      )}
                    </div>
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                      <span className="text-xs bg-muted hover:bg-muted/80 border border-border text-foreground px-3 py-1 rounded-md flex items-center gap-1">
                        <Upload className="h-3 w-3" /> Replace
                      </span>
                    </label>
                  </div>

                  <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="p-name" className="text-foreground/80">Full Name</Label>
                      <Input
                        id="p-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jane Doe"
                        className="bg-background border-input"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="p-email" className="text-foreground/80">Email Address</Label>
                      <Input
                        id="p-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="jane.doe@example.com"
                        className="bg-background border-input"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="p-phone" className="text-foreground/80">Phone Number</Label>
                      <Input
                        id="p-phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="bg-background border-input"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="p-loc" className="text-foreground/80">Location (City, State)</Label>
                      <Input
                        id="p-loc"
                        value={locationStr}
                        onChange={(e) => setLocationStr(e.target.value)}
                        placeholder="San Francisco, CA"
                        className="bg-background border-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/80 pt-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Links & Portfolio</h4>
                  <div className="space-y-3">
                    {socials.map((s, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 flex-1">
                          <Input
                            value={s.label}
                            placeholder="Label (e.g. LinkedIn, GitHub)"
                            onChange={(e) => {
                              const next = socials.map((item, idx) => idx === i ? { ...item, label: e.target.value } : item);
                              setSocials(next);
                            }}
                            className="bg-background border-input text-sm focus:border-indigo-500 focus:ring-indigo-500"
                          />
                          <Input
                            value={s.url}
                            placeholder="https://..."
                            onChange={(e) => {
                              const next = socials.map((item, idx) => idx === i ? { ...item, url: e.target.value } : item);
                              setSocials(next);
                            }}
                            className="bg-background border-input text-sm focus:border-indigo-500 focus:ring-indigo-500"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const next = socials.filter((_, idx) => idx !== i);
                            setSocials(next);
                          }}
                          className="h-9 w-9 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 shrink-0"
                          title="Remove Link"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const next = [...socials, { label: "", url: "" }];
                        setSocials(next);
                      }}
                      className="gap-1.5 border-border hover:bg-muted text-foreground"
                    >
                      <Plus className="h-4 w-4" /> Add Link
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Summary */}
            {activeTab === "summary" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Professional Summary</h3>
                  <p className="text-xs text-muted-foreground mt-1">Refine your main job role, years of experience, and bio text.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="p-jt" className="text-foreground/80">Desired Job Title</Label>
                    <Input
                      id="p-jt"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="Senior Software Engineer"
                      className="bg-background border-input"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="p-yoe" className="text-foreground/80">Years of Experience</Label>
                    <Input
                      id="p-yoe"
                      type="number"
                      value={yearsOfExperience}
                      onChange={(e) => setYearsOfExperience(e.target.value ? parseInt(e.target.value) : "")}
                      placeholder="8"
                      className="bg-background border-input"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="p-bio" className="text-foreground/80">Summary</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 gap-1 h-7 text-xs"
                      onClick={handleAISummary}
                      disabled={generateSummary.isPending}
                    >
                      {generateSummary.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Refine with AI
                    </Button>
                  </div>
                  <Textarea
                    id="p-bio"
                    rows={6}
                    value={aboutMe}
                    onChange={(e) => setAboutMe(e.target.value)}
                    placeholder="Enter summary or let the AI write one based on your profile details..."
                    className="bg-background border-input resize-none"
                  />
                </div>
              </div>
            )}

            {/* TAB: Work Experience */}
            {activeTab === "experience" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">Work Experience</h3>
                    <p className="text-xs text-muted-foreground mt-1">Manage details about your past professional roles.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-border hover:bg-muted text-foreground w-full sm:w-auto"
                    onClick={() => {
                      expCollapse.handleAdd(experience.length);
                      setExperience([
                        ...experience,
                        {
                          company: "",
                          title: "",
                          startDate: "",
                          endDate: "",
                          location: "",
                          description: "",
                          currentlyWorking: false,
                          bullets: [],
                        },
                      ]);
                    }}
                  >
                    <Plus className="h-4 w-4" /> Add Experience
                  </Button>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {experience.length === 0 ? (
                    <div className="text-center py-10 bg-muted/10 border border-dashed border-border rounded-xl">
                      <Briefcase className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No experience added yet.</p>
                    </div>
                  ) : (
                    experience.map((exp, idx) => (
                      <CollapsibleEditableBlock
                        key={idx}
                        expanded={expCollapse.isExpanded(idx)}
                        onToggle={() => expCollapse.toggle(idx)}
                        onSave={() => expCollapse.collapse(idx)}
                        onDelete={() => {
                          setExperience(experience.filter((_, i) => i !== idx));
                          expCollapse.handleRemove(idx);
                        }}
                        preview={
                          <BlockPreview
                            title={exp.title}
                            subtitle={exp.company}
                            meta={[exp.startDate, exp.endDate].filter(Boolean).join(" – ")}
                            placeholder="Untitled role"
                          />
                        }
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Job Title</Label>
                            <Input
                              value={exp.title}
                              onChange={(e) => {
                                const updated = [...experience];
                                updated[idx] = { ...updated[idx], title: e.target.value };
                                setExperience(updated);
                              }}
                              placeholder="Software Engineer"
                              className="bg-background border-input"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Company</Label>
                            <Input
                              value={exp.company}
                              onChange={(e) => {
                                const updated = [...experience];
                                updated[idx] = { ...updated[idx], company: e.target.value };
                                setExperience(updated);
                              }}
                              placeholder="Google"
                              className="bg-background border-input"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Start Date</Label>
                            <Input
                              value={exp.startDate}
                              onChange={(e) => {
                                const updated = [...experience];
                                updated[idx] = { ...updated[idx], startDate: e.target.value };
                                setExperience(updated);
                              }}
                              placeholder="Jan 2018"
                              className="bg-background border-input"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">End Date</Label>
                            <Input
                              value={exp.endDate}
                              disabled={exp.currentlyWorking}
                              onChange={(e) => {
                                const updated = [...experience];
                                updated[idx] = { ...updated[idx], endDate: e.target.value };
                                setExperience(updated);
                              }}
                              placeholder="Present"
                              className="bg-background border-input"
                            />
                          </div>

                          <div className="flex items-center gap-2 mt-2 md:mt-5">
                            <Checkbox
                              id={`p-curr-${idx}`}
                              checked={exp.currentlyWorking}
                              onCheckedChange={(checked) => {
                                const updated = [...experience];
                                updated[idx] = {
                                  ...updated[idx],
                                  currentlyWorking: !!checked,
                                  endDate: checked ? "Present" : updated[idx].endDate === "Present" ? "" : updated[idx].endDate
                                };
                                setExperience(updated);
                              }}
                            />
                            <Label htmlFor={`p-curr-${idx}`} className="text-xs text-muted-foreground cursor-pointer">
                              Current Role
                            </Label>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <BulletListEditor
                            bullets={exp.bullets || []}
                            onChange={(newBullets) => {
                                const updated = [...experience];
                                updated[idx] = {
                                  ...updated[idx],
                                  bullets: newBullets,
                                  description: syncBulletsToDescription(newBullets)
                                };
                                setExperience(updated);
                            }}
                            context={`${exp.title || "Role"} at ${exp.company || "Company"}`}
                            placeholder="e.g. Optimized database performance, decreasing query latency by 30%"
                            label="Description / Key Achievements"
                          />
                        </div>
                      </CollapsibleEditableBlock>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB: Education */}
            {activeTab === "education" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">Education</h3>
                    <p className="text-xs text-muted-foreground mt-1">Manage school, university, and academic details.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-border hover:bg-muted text-foreground w-full sm:w-auto"
                    onClick={() => {
                      eduCollapse.handleAdd(education.length);
                      setEducation([
                        ...education,
                        {
                          school: "",
                          degree: "",
                          field: "",
                          startDate: "",
                          endDate: "",
                          gpa: "",
                          gpaMode: "gpa",
                        },
                      ]);
                    }}
                  >
                    <Plus className="h-4 w-4" /> Add Education
                  </Button>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {education.length === 0 ? (
                    <div className="text-center py-10 bg-muted/10 border border-dashed border-border rounded-xl">
                      <GraduationCap className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No education items added yet.</p>
                    </div>
                  ) : (
                    education.map((edu, idx) => (
                      <CollapsibleEditableBlock
                        key={idx}
                        expanded={eduCollapse.isExpanded(idx)}
                        onToggle={() => eduCollapse.toggle(idx)}
                        onSave={() => eduCollapse.collapse(idx)}
                        onDelete={() => {
                          setEducation(education.filter((_, i) => i !== idx));
                          eduCollapse.handleRemove(idx);
                        }}
                        preview={
                          <BlockPreview
                            title={[edu.degree, edu.field].filter(Boolean).join(" ")}
                            subtitle={edu.school}
                            meta={[edu.startDate, edu.endDate].filter(Boolean).join(" – ")}
                            placeholder="Untitled education"
                          />
                        }
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">School / University</Label>
                            <Input
                              value={edu.school}
                              onChange={(e) => {
                                const updated = [...education];
                                updated[idx] = { ...updated[idx], school: e.target.value };
                                setEducation(updated);
                              }}
                              placeholder="MIT"
                              className="bg-background border-input"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Degree</Label>
                            <Input
                              value={edu.degree}
                              onChange={(e) => {
                                const updated = [...education];
                                updated[idx] = { ...updated[idx], degree: e.target.value };
                                setEducation(updated);
                              }}
                              placeholder="B.S. Computer Science"
                              className="bg-background border-input"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Field of Study</Label>
                            <Input
                              value={edu.field}
                              onChange={(e) => {
                                const updated = [...education];
                                updated[idx] = { ...updated[idx], field: e.target.value };
                                setEducation(updated);
                              }}
                              placeholder="Artificial Intelligence"
                              className="bg-background border-input"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Start Date</Label>
                            <Input
                              value={edu.startDate}
                              onChange={(e) => {
                                const updated = [...education];
                                updated[idx] = { ...updated[idx], startDate: e.target.value };
                                setEducation(updated);
                              }}
                              placeholder="2018"
                              className="bg-background border-input"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">End Date (or Expected)</Label>
                            <Input
                              value={edu.endDate}
                              onChange={(e) => {
                                const updated = [...education];
                                updated[idx] = { ...updated[idx], endDate: e.target.value };
                                setEducation(updated);
                              }}
                              placeholder="2022"
                              className="bg-background border-input"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Grade System</Label>
                            <select
                              value={edu.gpaMode || "gpa"}
                              onChange={(e) => {
                                const updated = [...education];
                                updated[idx] = { ...updated[idx], gpaMode: e.target.value };
                                setEducation(updated);
                              }}
                              className="w-full bg-background border border-input rounded-xl px-3 h-10 text-sm text-foreground focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                            >
                              <option value="gpa">GPA</option>
                              <option value="percentage">Percentage (%)</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">
                              {edu.gpaMode === "percentage" ? "Percentage" : "GPA"}
                            </Label>
                            <Input
                              value={edu.gpa}
                              onChange={(e) => {
                                const updated = [...education];
                                updated[idx] = { ...updated[idx], gpa: e.target.value };
                                setEducation(updated);
                              }}
                              placeholder={edu.gpaMode === "percentage" ? "95.5" : "3.9"}
                              className="bg-background border-input"
                            />
                          </div>
                        </div>
                      </CollapsibleEditableBlock>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB: Skills */}
            {activeTab === "skills" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Key Skills</h3>
                  <p className="text-xs text-muted-foreground mt-1">Define professional keywords and tech stack tags.</p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="p-skill-in" className="text-foreground/80">Add Skill Chip</Label>
                  <div className="flex gap-2">
                    <Input
                      id="p-skill-in"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = skillInput.trim();
                          if (val && !skills.includes(val)) {
                            setSkills([...skills, val]);
                            setSkillInput("");
                          }
                        }
                      }}
                      placeholder="React, TypeScript, Unity..."
                      className="bg-background border-input"
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        const val = skillInput.trim();
                        if (val && !skills.includes(val)) {
                          setSkills([...skills, val]);
                          setSkillInput("");
                        }
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      Add
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 min-h-12 p-3 bg-card/40 border border-border rounded-xl">
                  {skills.length === 0 ? (
                    <span className="text-xs text-muted-foreground/60 italic">No skills added.</span>
                  ) : (
                    skills.map((skill, idx) => (
                      <div
                        key={idx}
                        className="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-500/30 text-indigo-650 dark:text-indigo-300 text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5"
                      >
                        <span>{skill}</span>
                        <button
                          type="button"
                          onClick={() => setSkills(skills.filter((_, i) => i !== idx))}
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-850 dark:hover:text-indigo-200"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB: Projects */}
            {activeTab === "projects" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">Key Projects</h3>
                    <p className="text-xs text-muted-foreground mt-1">Manage project portfolios and repositories.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-border hover:bg-muted text-foreground w-full sm:w-auto"
                    onClick={() => {
                      projCollapse.handleAdd(projects.length);
                      setProjects([
                        ...projects,
                        { name: "", description: "", technologiesUsed: "", url: "", github: "", bullets: [] },
                      ]);
                    }}
                  >
                    <Plus className="h-4 w-4" /> Add Project
                  </Button>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {projects.length === 0 ? (
                    <div className="text-center py-10 bg-muted/10 border border-dashed border-border rounded-xl">
                      <FolderGit className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No projects added yet.</p>
                    </div>
                  ) : (
                    projects.map((proj, idx) => (
                      <CollapsibleEditableBlock
                        key={idx}
                        expanded={projCollapse.isExpanded(idx)}
                        onToggle={() => projCollapse.toggle(idx)}
                        onSave={() => projCollapse.collapse(idx)}
                        onDelete={() => {
                          setProjects(projects.filter((_, i) => i !== idx));
                          projCollapse.handleRemove(idx);
                        }}
                        preview={
                          <BlockPreview
                            title={proj.name}
                            meta={proj.technologiesUsed || proj.url}
                            placeholder="Untitled project"
                          />
                        }
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Project Name</Label>
                            <Input
                              value={proj.name}
                              onChange={(e) => {
                                const updated = [...projects];
                                updated[idx] = { ...updated[idx], name: e.target.value };
                                setProjects(updated);
                              }}
                              placeholder="My Project"
                              className="bg-background border-input"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Project URL</Label>
                            <Input
                              value={proj.url}
                              onChange={(e) => {
                                const updated = [...projects];
                                updated[idx] = { ...updated[idx], url: e.target.value };
                                setProjects(updated);
                              }}
                              placeholder="https://..."
                              className="bg-background border-input"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <BulletListEditor
                            bullets={proj.bullets || []}
                            onChange={(newBullets) => {
                              const updated = [...projects];
                              updated[idx] = {
                                ...updated[idx],
                                bullets: newBullets,
                                description: syncBulletsToDescription(newBullets)
                              };
                              setProjects(updated);
                            }}
                            context={`Project named ${proj.name || "Project"}`}
                            placeholder="e.g. Built a custom rendering engine using WebGL, improving rendering speed by 2x"
                            label="Project Description"
                          />
                        </div>
                      </CollapsibleEditableBlock>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB: Certifications */}
            {activeTab === "certifications" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">Certifications</h3>
                    <p className="text-xs text-muted-foreground mt-1">Manage certification details.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-border hover:bg-muted text-foreground w-full sm:w-auto"
                    onClick={() => {
                      certCollapse.handleAdd(certifications.length);
                      setCertifications([
                        ...certifications,
                        { name: "", issuer: "", date: "", credentialUrl: "" },
                      ]);
                    }}
                  >
                    <Plus className="h-4 w-4" /> Add Certification
                  </Button>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {certifications.length === 0 ? (
                    <div className="text-center py-10 bg-muted/10 border border-dashed border-border rounded-xl">
                      <Award className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No certifications added yet.</p>
                    </div>
                  ) : (
                    certifications.map((cert, idx) => (
                      <CollapsibleEditableBlock
                        key={idx}
                        expanded={certCollapse.isExpanded(idx)}
                        onToggle={() => certCollapse.toggle(idx)}
                        onSave={() => certCollapse.collapse(idx)}
                        onDelete={() => {
                          setCertifications(certifications.filter((_, i) => i !== idx));
                          certCollapse.handleRemove(idx);
                        }}
                        preview={
                          <BlockPreview
                            title={cert.name}
                            subtitle={cert.issuer}
                            meta={cert.date}
                            placeholder="Untitled certification"
                          />
                        }
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Certification Name</Label>
                            <Input
                              value={cert.name}
                              onChange={(e) => {
                                const updated = [...certifications];
                                updated[idx] = { ...updated[idx], name: e.target.value };
                                setCertifications(updated);
                              }}
                              placeholder="AWS Cloud Practitioner"
                              className="bg-background border-input"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Issuer</Label>
                            <Input
                              value={cert.issuer}
                              onChange={(e) => {
                                const updated = [...certifications];
                                updated[idx] = { ...updated[idx], issuer: e.target.value };
                                setCertifications(updated);
                              }}
                              placeholder="Amazon"
                              className="bg-background border-input"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Date</Label>
                            <Input
                              value={cert.date}
                              onChange={(e) => {
                                const updated = [...certifications];
                                updated[idx] = { ...updated[idx], date: e.target.value };
                                setCertifications(updated);
                              }}
                              placeholder="Aug 2022"
                              className="bg-background border-input"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">URL</Label>
                            <Input
                              value={cert.credentialUrl}
                              onChange={(e) => {
                                const updated = [...certifications];
                                updated[idx] = { ...updated[idx], credentialUrl: e.target.value };
                                setCertifications(updated);
                              }}
                              placeholder="https://..."
                              className="bg-background border-input"
                            />
                          </div>
                        </div>
                      </CollapsibleEditableBlock>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB: Onboarding settings */}
            {activeTab === "settings" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Onboarding Settings</h3>
                  <p className="text-xs text-muted-foreground mt-1">Configure your wizard status or restart onboarding.</p>
                </div>

                <div className="bg-card/40 border border-border rounded-xl p-5 space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold">Wizard Status</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Current profile status is:{" "}
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {profile?.onboardingCompleted
                          ? "Completed"
                          : profile?.onboardingSkipped
                          ? "Skipped"
                          : "In Progress (Step " + (profile?.onboardingProgress || 1) + ")"}
                      </span>
                    </p>
                  </div>

                  <div className="border-t border-border pt-4 space-y-2">
                    <h4 className="text-sm font-semibold text-red-500">Reset Onboarding</h4>
                    <p className="text-xs text-muted-foreground">
                      Re-run the full multi-step onboarding wizard. Your existing profile data will be retained in the form fields.
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleRerunOnboarding}
                      className="border-red-500/30 hover:bg-red-50 dark:hover:bg-red-950/25 border border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-400 text-xs"
                    >
                      Re-run Onboarding Wizard
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </section>
          </div>
        </div>
      </main>

      {/* Extract-from-resume picker */}
      <ExtractFromResumeDialog
        open={showExtractDialog}
        onOpenChange={setShowExtractDialog}
        resumes={resumeList}
        isExtracting={isExtracting}
        onConfirm={handleExtractFromResume}
      />

      {/* Unsaved Changes Confirmation Dialog */}
      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent className="max-w-[420px] bg-card border border-border/80 shadow-2xl shadow-black/10 rounded-2xl text-foreground p-0 gap-0 [&>button]:text-muted-foreground [&>button]:hover:text-foreground">
          {/* Ambient glow — sits behind content */}
          <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-amber-500/8 blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-32 h-32 rounded-full bg-indigo-500/8 blur-[60px] pointer-events-none" />

          <div className="relative z-10 p-6 pb-0">
            <DialogHeader className="space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-lg shadow-amber-500/5">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <DialogTitle className="text-base font-bold tracking-tight text-center text-foreground pt-1">
                Unsaved Changes
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs text-center leading-relaxed max-w-[320px] mx-auto">
                You have unsaved modifications to your profile. Would you like to save before leaving?
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="relative z-10 p-6 pt-5">
            <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
              <Button
                onClick={() => {
                  setShowConfirmClose(false);
                  handleSave();
                }}
                disabled={isUpdating}
                className="w-full h-10 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-600/15 border-none rounded-xl"
              >
                {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                Save & Close
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmClose(false)}
                  className="flex-1 h-9 text-xs border-border bg-card/60 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl"
                >
                  Keep Editing
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleDiscard}
                  className="flex-1 h-9 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl"
                >
                  Discard
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
