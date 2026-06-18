import { useState, useEffect, useRef, useTransition } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProfile,
  useUpdateProfile,
  useGenerateSummary,
  useImproveBullet,
  getGetProfileQueryKey,
} from "@workspace/api-client-react";
import { createAiQuickRequestOptions } from "@/lib/ai-request";
import { plainTextToRichHtml, richHtmlToPlainText } from "@/lib/ai-rich-text";
import { resolveProfileBullets, syncBulletsToDescription } from "@/lib/profile-bullets";
import { Button } from "@/components/ui/button";
import { BulletListEditor } from "@/components/ui/BulletListEditor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SEO } from "@/components/shared/SEO";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Upload,
  Plus,
  Trash2,
  X,
  Compass,
  Briefcase,
  Wrench,
  FolderGit,
  Award,
  User as UserIcon,
  GraduationCap,
} from "lucide-react";

const STEPS = [
  { id: 1, name: "Personal Info", icon: UserIcon },
  { id: 2, name: "Professional Summary", icon: Compass },
  { id: 3, name: "Work Experience", icon: Briefcase },
  { id: 4, name: "Education", icon: GraduationCap },
  { id: 5, name: "Skills", icon: Wrench },
  { id: 6, name: "Projects", icon: FolderGit },
  { id: 7, name: "Certifications", icon: Award },
];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, startTransition] = useTransition();

  const { data: profile, isLoading } = useGetProfile();
  const { mutate: updateProfile } = useUpdateProfile({
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
      },
    },
  });

  const generateSummary = useGenerateSummary({
    request: createAiQuickRequestOptions(),
  });
  const improveBullet = useImproveBullet({
    request: createAiQuickRequestOptions(),
  });

  // Local state for all fields
  const [currentStep, setCurrentStep] = useState(1);

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

  const isSavingRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);

  // Redirect if already completed/skipped onboarding
  useEffect(() => {
    console.log("OnboardingPage redirect check:", {
      onboardingCompleted: profile?.onboardingCompleted,
      onboardingSkipped: profile?.onboardingSkipped,
      profile
    });
    if (profile && (profile.onboardingCompleted || profile.onboardingSkipped)) {
      console.log("OnboardingPage redirecting to /dashboard because completed or skipped is true");
      setLocation("/dashboard");
    }
  }, [profile, setLocation]);

  useEffect(() => {
    if (profile && !initializedRef.current) {
      initializedRef.current = true;
      setName(profile.name || "");
      setEmail(profile.email || "");
      setPhone(profile.phone || "");
      setLocationStr(profile.location || "");
      setPhoto(profile.photo || "");
      setSocials((profile.socials as { label: string; url: string }[]) || []);

      setJobTitle(profile.jobTitle || "");
      setYearsOfExperience(profile.yearsOfExperience ?? "");
      setAboutMe(profile.aboutMe || "");

      setExperience(
        ((profile.experience as any[]) || []).map(exp => ({
          company: exp.company || "",
          title: exp.title || "",
          startDate: exp.startDate || "",
          endDate: exp.endDate || "",
          location: exp.location || "",
          description: exp.description || "",
          currentlyWorking: !!exp.currentlyWorking,
          bullets: resolveProfileBullets(exp.bullets, exp.description),
        }))
      );
      setEducation(
        ((profile.education as any[]) || []).map(edu => ({
          school: edu.school || "",
          degree: edu.degree || "",
          field: edu.field || "",
          startDate: edu.startDate || "",
          endDate: edu.endDate || "",
          gpa: edu.gpa || "",
          gpaMode: edu.gpaMode || "gpa",
        }))
      );
      setSkills(profile.skills || []);
      setProjects(
        ((profile.projects as any[]) || []).map(proj => ({
          name: proj.name || "",
          description: proj.description || "",
          technologiesUsed: proj.technologiesUsed || "",
          url: proj.url || "",
          github: proj.github || "",
          bullets: resolveProfileBullets(proj.bullets, proj.description),
        }))
      );
      setCertifications(
        (profile.certifications as {
          name: string;
          issuer: string;
          date: string;
          credentialUrl?: string;
        }[]) || []
      );

      if (profile.onboardingProgress && profile.onboardingProgress > 0) {
        setCurrentStep(profile.onboardingProgress);
      }
    }
  }, [profile]);

  // Debounced auto-save function
  const triggerAutoSave = (patch: Record<string, any>) => {
    if (isSavingRef.current) clearTimeout(isSavingRef.current);
    isSavingRef.current = setTimeout(() => {
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
          onboardingProgress: currentStep,
          ...patch,
        },
      });
    }, 800);
  };

  const handleFieldChange = (setter: (val: any) => void, fieldName: string, value: any) => {
    setter(value);
    triggerAutoSave({ [fieldName]: value });
  };

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && e.ctrlKey && currentStep < STEPS.length) {
        handleNext();
      } else if (e.key === "ArrowLeft" && e.ctrlKey && currentStep > 1) {
        handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStep, name, email, phone, locationStr, photo, socials, jobTitle, yearsOfExperience, aboutMe, experience, skills, projects, certifications]);

  const handleNext = () => {
    if (isSavingRef.current) {
      clearTimeout(isSavingRef.current);
      isSavingRef.current = null;
    }
    if (currentStep === 1) {
      if (!name.trim() || !email.trim()) {
        toast({
          title: "Required Fields Missing",
          description: "Please enter your Full Name and Email Address.",
          variant: "destructive",
        });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        toast({
          title: "Invalid Email",
          description: "Please enter a valid email address.",
          variant: "destructive",
        });
        return;
      }
    }
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
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
        onboardingProgress: nextStep,
      },
    });
  };

  const handlePrev = () => {
    if (isSavingRef.current) {
      clearTimeout(isSavingRef.current);
      isSavingRef.current = null;
    }
    const prevStep = currentStep - 1;
    setCurrentStep(prevStep);
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
        onboardingProgress: prevStep,
      },
    });
  };

  const handleSkip = () => {
    if (isSavingRef.current) clearTimeout(isSavingRef.current);
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
        onboardingSkipped: true,
      },
    }, {
      onSuccess: () => {
        toast({
          title: "Onboarding Skipped",
          description: "You can complete your profile later in the Profile page.",
        });
        setLocation("/dashboard");
      }
    });
  };

  const handleFinish = () => {
    if (isSavingRef.current) clearTimeout(isSavingRef.current);
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
        onboardingCompleted: true,
        onboardingProgress: STEPS.length,
      },
    }, {
      onSuccess: () => {
        toast({
          title: "Onboarding Completed",
          description: "Your professional profile has been saved successfully!",
        });
        setLocation("/dashboard");
      }
    });
  };

  // Image Upload helper
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
        handleFieldChange(setPhoto, "photo", reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // AI Helpers
  const handleAISummary = () => {
    if (!jobTitle.trim()) {
      toast({
        title: "Job Title Required",
        description: "Please specify a current Job Title first so AI has context.",
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
            handleFieldChange(setAboutMe, "aboutMe", res.text);
            toast({ title: "AI Summary Generated!" });
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
            // Strip any wrapping HTML tags generated by improve bullet if needed
            updated[index].description = richHtmlToPlainText(res.text);
            handleFieldChange(setExperience, "experience", updated);
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
        description: "Please write some description notes first for the AI to improve.",
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
            handleFieldChange(setProjects, "projects", updated);
            toast({ title: "Project description polished!" });
          }
        },
      }
    );
  };  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
          <p className="text-sm font-medium text-muted-foreground">Loading Onboarding Wizard...</p>
        </div>
      </div>
    );
  }

  const progressPercent = (currentStep / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      <SEO title="Onboarding | Resumesensei" description="Set up your Resumesensei profile." robots="noindex, nofollow" />

      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/60 px-4 sm:px-6 py-3 sm:py-4 flex flex-col gap-3">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg sm:text-xl font-extrabold tracking-tight">
              Resume<span className="text-primary font-black">sensei</span>
            </span>
            <span className="hidden sm:inline-flex text-xs bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-semibold px-2 py-0.5 rounded-full">
              Onboarding
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground px-2.5 sm:px-3 text-xs sm:text-sm" onClick={handleSkip}>
              Skip For Now
            </Button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto w-full">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].name}</span>
            <span>{Math.round(progressPercent)}% Complete</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
            />
          </div>
        </div>
      </header>

      {/* Main wizard step content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10 flex flex-col justify-center">
        <div className="bg-card/40 border border-border/80 rounded-2xl p-6 md:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          {/* Glassmorphic lighting effect */}
          <div className="absolute top-0 right-0 h-40 w-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 h-40 w-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* Step 1: Personal Info */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Let's start with your Personal Details</h2>
                    <p className="text-muted-foreground text-sm mt-1">This information will populate your resume header by default.</p>
                  </div>

                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    {/* Photo Uploader */}
                    <div className="flex flex-col items-center gap-2 shrink-0">
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
                          <Upload className="h-3 w-3" /> Upload Photo
                        </span>
                      </label>
                    </div>

                    <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="name" className="text-foreground/80">Full Name <span className="text-red-500">*</span></Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => handleFieldChange(setName, "name", e.target.value)}
                          placeholder="Jane Doe"
                          className="bg-background border-input focus:border-primary focus:ring-primary"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-foreground/80">Email Address <span className="text-red-500">*</span></Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => handleFieldChange(setEmail, "email", e.target.value)}
                          placeholder="jane.doe@example.com"
                          className="bg-background border-input focus:border-primary focus:ring-primary"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="phone" className="text-foreground/80">Phone Number</Label>
                        <Input
                          id="phone"
                          value={phone}
                          onChange={(e) => handleFieldChange(setPhone, "phone", e.target.value)}
                          placeholder="+1 (555) 000-0000"
                          className="bg-background border-input focus:border-primary focus:ring-primary"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="location" className="text-foreground/80">Location (City, State)</Label>
                        <Input
                          id="location"
                          value={locationStr}
                          onChange={(e) => handleFieldChange(setLocationStr, "location", e.target.value)}
                          placeholder="San Francisco, CA"
                          className="bg-background border-input focus:border-primary focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border/80 pt-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Links & Portfolio</h3>
                    <div className="space-y-3">
                      {socials.map((s, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 flex-1">
                            <Input
                              value={s.label}
                              placeholder="Label (e.g. LinkedIn, GitHub)"
                              onChange={(e) => {
                                const next = socials.map((item, idx) => idx === i ? { ...item, label: e.target.value } : item);
                                handleFieldChange(setSocials, "socials", next);
                              }}
                              className="bg-background border-input text-sm focus:border-primary focus:ring-primary"
                            />
                            <Input
                              value={s.url}
                              placeholder="https://..."
                              onChange={(e) => {
                                const next = socials.map((item, idx) => idx === i ? { ...item, url: e.target.value } : item);
                                handleFieldChange(setSocials, "socials", next);
                              }}
                              className="bg-background border-input text-sm focus:border-primary focus:ring-primary"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const next = socials.filter((_, idx) => idx !== i);
                              handleFieldChange(setSocials, "socials", next);
                            }}
                            className="h-9 w-9 text-muted-foreground/80 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 shrink-0"
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
                          handleFieldChange(setSocials, "socials", next);
                        }}
                        className="gap-1.5 border-border hover:bg-muted text-foreground"
                      >
                        <Plus className="h-4 w-4" /> Add Link
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Professional Summary */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Your Professional Summary</h2>
                    <p className="text-muted-foreground text-sm mt-1">Briefly outline your profile, role, and professional expertise.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="jobTitle" className="text-foreground/80">Desired Job Title</Label>
                      <Input
                        id="jobTitle"
                        value={jobTitle}
                        onChange={(e) => handleFieldChange(setJobTitle, "jobTitle", e.target.value)}
                        placeholder="Staff Software Engineer"
                        className="bg-background border-input focus:border-primary focus:ring-primary"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="years" className="text-foreground/80">Years of Experience</Label>
                      <Input
                        id="years"
                        type="number"
                        value={yearsOfExperience}
                        onChange={(e) => handleFieldChange(setYearsOfExperience, "yearsOfExperience", e.target.value ? parseInt(e.target.value) : "")}
                        placeholder="5"
                        className="bg-background border-input focus:border-primary focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="about" className="text-foreground/80">Summary</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-indigo-650 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 gap-1"
                        onClick={handleAISummary}
                        disabled={generateSummary.isPending}
                      >
                        {generateSummary.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        {aboutMe ? "Refine Summary" : "Write Summary with AI"}
                      </Button>
                    </div>
                    <Textarea
                      id="about"
                      rows={5}
                      value={aboutMe}
                      onChange={(e) => handleFieldChange(setAboutMe, "aboutMe", e.target.value)}
                      placeholder="Write a brief professional summary or let the AI write one for you based on your job title and skills..."
                      className="bg-background border-input focus:border-primary focus:ring-primary resize-none"
                    />
                  </div>

                  <div className="bg-card/40 border border-border/50 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">AI Summary Suggestions</h4>
                    <p className="text-xs text-muted-foreground/60 italic">
                      "Dedicated professional with a proven track record of designing scalable cloud solutions, streamlining microservices, and leading high-performing engineering teams to deliver impactful products."
                    </p>
                  </div>
                </div>
              )}

              {/* Step 3: Work Experience */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">Work Experience</h2>
                      <p className="text-muted-foreground text-sm mt-1">Add details about your professional journey.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-border hover:bg-muted text-foreground w-full sm:w-auto"
                      onClick={() => {
                        const newExp = [
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
                        ];
                        handleFieldChange(setExperience, "experience", newExp);
                      }}
                    >
                      <Plus className="h-4 w-4" /> Add Experience
                    </Button>
                  </div>

                  <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                    {experience.length === 0 ? (
                      <div className="text-center py-10 bg-muted/10 border border-dashed border-border rounded-xl">
                        <Briefcase className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                        <p className="text-muted-foreground text-sm">No work experiences added yet.</p>
                        <Button
                          variant="link"
                          className="text-indigo-650 dark:text-indigo-400 mt-1"
                          onClick={() => {
                            setExperience([
                              {
                                company: "",
                                title: "",
                                startDate: "",
                                endDate: "",
                                location: "",
                                description: "",
                                currentlyWorking: false,
                              },
                            ]);
                          }}
                        >
                          Add your first experience
                        </Button>
                      </div>
                    ) : (
                      experience.map((exp, idx) => (
                        <div key={idx} className="bg-card/40 border border-border rounded-xl p-4 space-y-4 relative">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = experience.filter((_, i) => i !== idx);
                              handleFieldChange(setExperience, "experience", updated);
                            }}
                            className="absolute top-3 right-3 text-muted-foreground/80 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Job Title</Label>
                              <Input
                                value={exp.title}
                                onChange={(e) => {
                                  const updated = [...experience];
                                  updated[idx].title = e.target.value;
                                  handleFieldChange(setExperience, "experience", updated);
                                }}
                                placeholder="Software Engineer"
                                className="bg-background border-input"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Company Name</Label>
                              <Input
                                value={exp.company}
                                onChange={(e) => {
                                  const updated = [...experience];
                                  updated[idx].company = e.target.value;
                                  handleFieldChange(setExperience, "experience", updated);
                                }}
                                placeholder="Acme Corp"
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
                                  updated[idx].startDate = e.target.value;
                                  handleFieldChange(setExperience, "experience", updated);
                                }}
                                placeholder="Jan 2021"
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
                                  updated[idx].endDate = e.target.value;
                                  handleFieldChange(setExperience, "experience", updated);
                                }}
                                placeholder={exp.currentlyWorking ? "Present" : "Dec 2023"}
                                className="bg-background border-input"
                              />
                            </div>

                            <div className="flex items-center gap-2 mt-2 md:mt-5">
                              <Checkbox
                                id={`curr-${idx}`}
                                checked={exp.currentlyWorking}
                                onCheckedChange={(checked) => {
                                  const updated = [...experience];
                                  updated[idx].currentlyWorking = !!checked;
                                  if (checked) {
                                    updated[idx].endDate = "Present";
                                  }
                                  handleFieldChange(setExperience, "experience", updated);
                                }}
                              />
                              <Label htmlFor={`curr-${idx}`} className="text-xs text-muted-foreground cursor-pointer">
                                I currently work here
                              </Label>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <BulletListEditor
                              bullets={exp.bullets || []}
                              onChange={(newBullets) => {
                                const updated = [...experience];
                                updated[idx].bullets = newBullets;
                                updated[idx].description = syncBulletsToDescription(newBullets);
                                handleFieldChange(setExperience, "experience", updated);
                              }}
                              context={`${exp.title || "Role"} at ${exp.company || "Company"}`}
                              placeholder="e.g. Led redesign of customer checkout flow, boosting conversion by 15%"
                              label="Description / Key Achievements"
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Step 4: Education */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">Education</h2>
                      <p className="text-muted-foreground text-sm mt-1">Add details about your educational credentials.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-border hover:bg-muted text-foreground w-full sm:w-auto"
                      onClick={() => {
                        const newEdu = [
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
                        ];
                        handleFieldChange(setEducation, "education", newEdu);
                      }}
                    >
                      <Plus className="h-4 w-4" /> Add Education
                    </Button>
                  </div>

                  <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                    {education.length === 0 ? (
                      <div className="text-center py-10 bg-muted/10 border border-dashed border-border rounded-xl">
                        <GraduationCap className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                        <p className="text-muted-foreground text-sm">No education items added yet.</p>
                        <Button
                          variant="link"
                          className="text-indigo-650 dark:text-indigo-400 mt-1"
                          onClick={() => {
                            setEducation([
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
                          Add your first education item
                        </Button>
                      </div>
                    ) : (
                      education.map((edu, idx) => (
                        <div key={idx} className="bg-card/40 border border-border rounded-xl p-4 space-y-4 relative">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = education.filter((_, i) => i !== idx);
                              handleFieldChange(setEducation, "education", updated);
                            }}
                            className="absolute top-3 right-3 text-muted-foreground/80 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">School / University</Label>
                              <Input
                                value={edu.school}
                                onChange={(e) => {
                                  const updated = [...education];
                                  updated[idx].school = e.target.value;
                                  handleFieldChange(setEducation, "education", updated);
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
                                  updated[idx].degree = e.target.value;
                                  handleFieldChange(setEducation, "education", updated);
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
                                  updated[idx].field = e.target.value;
                                  handleFieldChange(setEducation, "education", updated);
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
                                  updated[idx].startDate = e.target.value;
                                  handleFieldChange(setEducation, "education", updated);
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
                                  updated[idx].endDate = e.target.value;
                                  handleFieldChange(setEducation, "education", updated);
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
                                  updated[idx].gpaMode = e.target.value;
                                  handleFieldChange(setEducation, "education", updated);
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
                                  updated[idx].gpa = e.target.value;
                                  handleFieldChange(setEducation, "education", updated);
                                }}
                                placeholder={edu.gpaMode === "percentage" ? "95.5" : "3.9"}
                                className="bg-background border-input"
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Step 5: Skills */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Key Skills</h2>
                    <p className="text-muted-foreground text-sm mt-1">Specify your key skills. Type skill and press Enter to add chip.</p>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="skill-input" className="text-foreground/80">Add Skills</Label>
                    <div className="flex gap-2">
                      <Input
                        id="skill-input"
                        value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const cleaned = skillInput.trim();
                            if (cleaned && !skills.includes(cleaned)) {
                              const nextSkills = [...skills, cleaned];
                              setSkillInput("");
                              handleFieldChange(setSkills, "skills", nextSkills);
                            }
                          }
                        }}
                        placeholder="React, TypeScript, AWS, Project Management..."
                        className="bg-background border-input"
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          const cleaned = skillInput.trim();
                          if (cleaned && !skills.includes(cleaned)) {
                            const nextSkills = [...skills, cleaned];
                            setSkillInput("");
                            handleFieldChange(setSkills, "skills", nextSkills);
                          }
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        Add
                      </Button>
                    </div>
                  </div>

                  {/* Skills Chips */}
                  <div className="flex flex-wrap gap-2 min-h-12 p-3 bg-card/40 border border-border rounded-xl">
                    {skills.length === 0 ? (
                      <span className="text-xs text-muted-foreground/60 italic">No skills added yet. Click some suggestions below.</span>
                    ) : (
                      skills.map((skill, idx) => (
                        <div
                          key={idx}
                          className="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-500/30 text-indigo-650 dark:text-indigo-300 text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5"
                        >
                          <span>{skill}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const nextSkills = skills.filter((_, i) => i !== idx);
                              handleFieldChange(setSkills, "skills", nextSkills);
                            }}
                            className="text-indigo-650 dark:text-indigo-400 hover:text-indigo-850 dark:hover:text-indigo-200"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Suggestions list */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Popular Suggestions</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {["Unity", "Unreal Engine", "C#", "C++", "TypeScript", "React", "Python", "Node.js", "AI Engineering", "Machine Learning"].map(
                        (sug) => (
                          <button
                            type="button"
                            key={sug}
                            disabled={skills.includes(sug)}
                            onClick={() => {
                              const nextSkills = [...skills, sug];
                              handleFieldChange(setSkills, "skills", nextSkills);
                            }}
                            className="text-xs bg-muted hover:bg-muted/80 text-foreground border border-border px-2.5 py-1 rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            + {sug}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 6: Projects */}
              {currentStep === 6 && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">Key Projects</h2>
                      <p className="text-muted-foreground text-sm mt-1">Showcase your best engineering and creative projects.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-border hover:bg-muted text-foreground w-full sm:w-auto"
                      onClick={() => {
                        const newProjs = [
                          ...projects,
                          { name: "", description: "", technologiesUsed: "", url: "", github: "", bullets: [] },
                        ];
                        handleFieldChange(setProjects, "projects", newProjs);
                      }}
                    >
                      <Plus className="h-4 w-4" /> Add Project
                    </Button>
                  </div>

                  <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                    {projects.length === 0 ? (
                      <div className="text-center py-10 bg-muted/10 border border-dashed border-border rounded-xl">
                        <FolderGit className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                        <p className="text-muted-foreground text-sm">No projects added yet.</p>
                        <Button
                          variant="link"
                          className="text-indigo-650 dark:text-indigo-400 mt-1"
                          onClick={() => {
                            setProjects([{ name: "", description: "", technologiesUsed: "", url: "", github: "", bullets: [] }]);
                          }}
                        >
                          Add your first project
                        </Button>
                      </div>
                    ) : (
                      projects.map((proj, idx) => (
                        <div key={idx} className="bg-card/40 border border-border rounded-xl p-4 space-y-4 relative">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = projects.filter((_, i) => i !== idx);
                              handleFieldChange(setProjects, "projects", updated);
                            }}
                            className="absolute top-3 right-3 text-muted-foreground/80 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Project Name</Label>
                              <Input
                                value={proj.name}
                                onChange={(e) => {
                                  const updated = [...projects];
                                  updated[idx].name = e.target.value;
                                  handleFieldChange(setProjects, "projects", updated);
                                }}
                                placeholder="E-Commerce API Service"
                                className="bg-background border-input"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Project URL (optional)</Label>
                              <Input
                                value={proj.url}
                                onChange={(e) => {
                                  const updated = [...projects];
                                  updated[idx].url = e.target.value;
                                  handleFieldChange(setProjects, "projects", updated);
                                }}
                                placeholder="my-app.com"
                                className="bg-background border-input"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <BulletListEditor
                              bullets={proj.bullets || []}
                              onChange={(newBullets) => {
                                const updated = [...projects];
                                updated[idx].bullets = newBullets;
                                updated[idx].description = syncBulletsToDescription(newBullets);
                                handleFieldChange(setProjects, "projects", updated);
                              }}
                              context={`Project named ${proj.name || "Project"}`}
                              placeholder="e.g. Developed real-time analytics dashboard rendering 10k data points/sec"
                              label="Project Description / Key Accomplishments"
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Step 7: Certifications */}
              {currentStep === 7 && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">Certifications</h2>
                      <p className="text-muted-foreground text-sm mt-1">Specify your professional certificates and credentials.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-border hover:bg-muted text-foreground w-full sm:w-auto"
                      onClick={() => {
                        const newCerts = [
                          ...certifications,
                          { name: "", issuer: "", date: "", credentialUrl: "" },
                        ];
                        handleFieldChange(setCertifications, "certifications", newCerts);
                      }}
                    >
                      <Plus className="h-4 w-4" /> Add Certification
                    </Button>
                  </div>

                  <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                    {certifications.length === 0 ? (
                      <div className="text-center py-10 bg-muted/10 border border-dashed border-border rounded-xl">
                        <Award className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                        <p className="text-muted-foreground text-sm">No certifications added yet.</p>
                        <Button
                          variant="link"
                          className="text-indigo-650 dark:text-indigo-400 mt-1"
                          onClick={() => {
                            setCertifications([{ name: "", issuer: "", date: "", credentialUrl: "" }]);
                          }}
                        >
                          Add your first certification
                        </Button>
                      </div>
                    ) : (
                      certifications.map((cert, idx) => (
                        <div key={idx} className="bg-card/40 border border-border rounded-xl p-4 space-y-4 relative">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = certifications.filter((_, i) => i !== idx);
                              handleFieldChange(setCertifications, "certifications", updated);
                            }}
                            className="absolute top-3 right-3 text-muted-foreground/80 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Certification Name</Label>
                              <Input
                                value={cert.name}
                                onChange={(e) => {
                                  const updated = [...certifications];
                                  updated[idx].name = e.target.value;
                                  handleFieldChange(setCertifications, "certifications", updated);
                                }}
                                placeholder="AWS Certified Solutions Architect"
                                className="bg-background border-input"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Issuing Organization</Label>
                              <Input
                                value={cert.issuer}
                                onChange={(e) => {
                                  const updated = [...certifications];
                                  updated[idx].issuer = e.target.value;
                                  handleFieldChange(setCertifications, "certifications", updated);
                                }}
                                placeholder="Amazon Web Services"
                                className="bg-background border-input"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Issue Date</Label>
                              <Input
                                value={cert.date}
                                onChange={(e) => {
                                  const updated = [...certifications];
                                  updated[idx].date = e.target.value;
                                  handleFieldChange(setCertifications, "certifications", updated);
                                }}
                                placeholder="August 2023"
                                className="bg-background border-input"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Credential URL (optional)</Label>
                              <Input
                                value={cert.credentialUrl}
                                onChange={(e) => {
                                  const updated = [...certifications];
                                  updated[idx].credentialUrl = e.target.value;
                                  handleFieldChange(setCertifications, "certifications", updated);
                                }}
                                placeholder="aws.amazon.com/verify/..."
                                className="bg-background border-input"
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-0 sm:items-center sm:justify-between border-t border-border/80 pt-6 mt-8">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={currentStep === 1}
              className="border-border hover:bg-muted text-foreground w-full sm:w-auto"
            >
              <ChevronLeft className="mr-2 h-4 w-4" /> Previous
            </Button>

            {currentStep < STEPS.length ? (
              <Button onClick={handleNext} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-lg hover:shadow-indigo-500/20 w-full sm:w-auto">
                Continue <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleFinish} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg hover:shadow-indigo-500/20 w-full sm:w-auto">
                Finish & Go to Dashboard <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
