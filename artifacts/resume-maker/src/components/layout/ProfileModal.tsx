import React, { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import {
  useGetProfile,
  useUpdateProfile,
  type ProfileSocial,
} from "@workspace/api-client-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Trash2,
  Plus,
  User,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Github,
  Linkedin,
  Twitter,
  Globe,
  Sparkles,
  Briefcase,
  X,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLATFORMS = [
  { value: "github", label: "GitHub", icon: Github },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin },
  { value: "twitter", label: "Twitter / X", icon: Twitter },
  { value: "portfolio", label: "Portfolio", icon: Globe },
  { value: "leetcode", label: "LeetCode", icon: Sparkles },
  { value: "behance", label: "Behance", icon: Globe },
  { value: "dribbble", label: "Dribbble", icon: Globe },
  { value: "medium", label: "Medium", icon: Globe },
];

export function ProfileModal({ open, onOpenChange }: ProfileModalProps) {
  const { user: clerkUser } = useUser();
  const { data: profile, refetch } = useGetProfile();
  const updateProfileMutation = useUpdateProfile();

  // Form states
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [photo, setPhoto] = useState("");
  const [socials, setSocials] = useState<ProfileSocial[]>([]);

  // States for detecting unsaved changes and confirmation modal
  const [initialData, setInitialData] = useState<any>(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const hasInitializedRef = useRef(false);

  // Social input state
  const [selectedPlatform, setSelectedPlatform] = useState("github");
  const [socialUrl, setSocialUrl] = useState("");

  // Set initial state from fetched profile or Clerk fallbacks
  useEffect(() => {
    if (open) {
      if (!hasInitializedRef.current && (profile || clerkUser)) {
        const initialName = profile?.name || (clerkUser ? `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() : "");
        const initialJobTitle = profile?.jobTitle || "";
        const initialLocation = profile?.location || "";
        const initialEmail = profile?.email || (clerkUser ? clerkUser.emailAddresses[0]?.emailAddress || "" : "");
        const initialPhone = profile?.phone || (clerkUser ? clerkUser.phoneNumbers[0]?.phoneNumber || "" : "");
        const initialPhoto = profile?.photo || (clerkUser ? clerkUser.imageUrl || "" : "");
        const initialSocials = profile?.socials || [];

        const initial = {
          name: initialName,
          jobTitle: initialJobTitle,
          location: initialLocation,
          email: initialEmail,
          phone: initialPhone,
          photo: initialPhoto,
          socials: initialSocials,
        };

        setName(initialName);
        setJobTitle(initialJobTitle);
        setLocation(initialLocation);
        setEmail(initialEmail);
        setPhone(initialPhone);
        setPhoto(initialPhoto);
        setSocials(initialSocials);
        setInitialData(initial);

        // If profile is loaded, we can mark as initialized. Otherwise, wait until profile is loaded.
        if (profile) {
          hasInitializedRef.current = true;
        }
      }
    } else {
      hasInitializedRef.current = false;
      setInitialData(null);
      setShowConfirmClose(false);
    }
  }, [profile, clerkUser, open]);

  const hasUnsavedChanges = () => {
    if (!initialData) return false;
    const socialsChanged = JSON.stringify(socials) !== JSON.stringify(initialData.socials);
    return (
      name.trim() !== initialData.name.trim() ||
      jobTitle.trim() !== initialData.jobTitle.trim() ||
      location.trim() !== initialData.location.trim() ||
      email.trim() !== initialData.email.trim() ||
      phone.trim() !== initialData.phone.trim() ||
      photo !== initialData.photo ||
      socialsChanged
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      if (hasUnsavedChanges()) {
        setShowConfirmClose(true);
      } else {
        onOpenChange(false);
      }
    } else {
      onOpenChange(true);
    }
  };

  const handleDiscard = () => {
    setShowConfirmClose(false);
    onOpenChange(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Image size should be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Image size should be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addSocialLink = () => {
    const trimmedUrl = socialUrl.trim();
    if (!trimmedUrl) {
      toast.error("Please enter a valid URL");
      return;
    }

    // Check if platform already exists
    if (socials.some((s) => s.label.toLowerCase() === selectedPlatform)) {
      toast.error(`You have already added a ${selectedPlatform} link`);
      return;
    }

    const platformLabel = PLATFORMS.find((p) => p.value === selectedPlatform)?.label || selectedPlatform;

    setSocials([...socials, { label: platformLabel, url: trimmedUrl }]);
    setSocialUrl("");
    toast.success(`${platformLabel} link added`);
  };

  const removeSocialLink = (index: number) => {
    const updated = socials.filter((_, i) => i !== index);
    setSocials(updated);
  };

  const handleSave = () => {
    updateProfileMutation.mutate(
      {
        data: {
          name,
          jobTitle,
          location,
          email,
          phone,
          photo,
          socials,
        },
      },
      {
        onSuccess: () => {
          toast.success("Profile saved successfully!");
          refetch();
          onOpenChange(false);
        },
        onError: (err: any) => {
          toast.error(err.message || "Failed to update profile");
        },
      }
    );
  };

  const getPlatformIcon = (label: string) => {
    const platform = PLATFORMS.find((p) => p.label.toLowerCase() === label.toLowerCase() || p.value === label.toLowerCase());
    return platform ? platform.icon : Globe;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl bg-background/95 backdrop-blur-xl border border-border/80 shadow-2xl p-0 overflow-hidden rounded-xl [&>button]:hidden">
        {/* Custom Cancel/Close Button */}
        <div className="absolute right-4 top-4 z-50">
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-border/40 bg-background/50 backdrop-blur-sm transition-all hover:scale-105 duration-200 shadow-sm flex items-center justify-center"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Cancel</span>
          </button>
        </div>
        <DialogHeader className="p-6 pb-2 border-b border-border/60">
          <DialogTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
            <User className="h-5 w-5 text-primary" /> My Profile
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs mt-0.5">
            Manage your personal credentials, contact info, and social links to automatically prefill your resumes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-0 h-[560px]">
          {/* Left Panel: Live CV Preview Card */}
          <div className="md:col-span-2 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 p-6 flex flex-col justify-between text-white border-r border-border/40 relative overflow-hidden">
            {/* Ambient glows */}
            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-purple-500/10 blur-[80px]" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-500/15 blur-[80px]" />

            <div className="space-y-6 z-10">
              <span className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase bg-indigo-950/60 border border-indigo-500/20 px-2 py-1 rounded-full w-max block">
                LIVE CV PREVIEW
              </span>

              {/* Digital CV Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5 shadow-xl space-y-4"
              >
                <div className="flex items-center gap-4">
                  {/* Photo with gradient ring */}
                  <div className="relative h-16 w-16 rounded-full p-0.5 bg-gradient-to-tr from-primary to-purple-500 shadow-md">
                    {photo ? (
                      <img
                        src={photo}
                        alt={name || "User Avatar"}
                        className="h-full w-full object-cover rounded-full bg-slate-800"
                      />
                    ) : (
                      <div className="h-full w-full rounded-full bg-slate-800 flex items-center justify-center text-white text-lg font-semibold">
                        {name ? name.charAt(0).toUpperCase() : <User className="h-6 w-6 text-muted-foreground" />}
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <h3 className="font-semibold text-base tracking-tight truncate">
                      {name || "Your Name"}
                    </h3>
                    <p className="text-xs text-indigo-300 font-medium flex items-center gap-1 truncate">
                      <Briefcase className="h-3 w-3 inline" /> {jobTitle || "Job Title"}
                    </p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-0.5 truncate">
                      <MapPin className="h-2.5 w-2.5 inline" /> {location || "City, Country"}
                    </p>
                  </div>
                </div>

                <div className="h-px bg-white/10 my-2" />

                {/* Contact info list */}
                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="h-3 w-3 text-indigo-400 shrink-0" />
                    <span className="truncate">{email || "email@example.com"}</span>
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <Phone className="h-3 w-3 text-indigo-400 shrink-0" />
                    <span>{phone || "+1 (555) 000-0000"}</span>
                  </div>
                </div>

                {/* Social badges preview */}
                {socials.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    <AnimatePresence>
                      {socials.map((social, idx) => {
                        const IconComponent = getPlatformIcon(social.label);
                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="flex items-center gap-1 bg-white/10 hover:bg-white/20 border border-white/5 px-2 py-0.5 rounded-full text-[10px] text-slate-200 transition-colors"
                          >
                            <IconComponent className="h-2.5 w-2.5" />
                            <span>{social.label}</span>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            </div>

            <div className="text-[10px] text-slate-400 z-10 flex items-center gap-1 bg-slate-950/40 p-2 rounded-lg border border-white/5">
              <Sparkles className="h-3 w-3 text-amber-400 shrink-0" />
              <span>This data syncs directly with the 'Personal Details' section of newly pre-filled resumes.</span>
            </div>
          </div>

          {/* Right Panel: Form Fields */}
          <div className="md:col-span-3 flex flex-col justify-between bg-card p-6 h-full overflow-hidden">
            <Tabs defaultValue="general" className="w-full flex-1 flex flex-col min-h-0">
              <TabsList className="grid grid-cols-3 bg-muted/60 p-1 rounded-lg border border-border/40 mb-4 shrink-0">
                <TabsTrigger value="general" className="text-xs py-1.5">General</TabsTrigger>
                <TabsTrigger value="contact" className="text-xs py-1.5">Contact</TabsTrigger>
                <TabsTrigger value="socials" className="text-xs py-1.5">Social Links</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto pr-1 space-y-4 pb-4 min-h-0">
                {/* General Tab */}
                <TabsContent value="general" className="mt-0 space-y-4">
                  {/* Photo upload dropzone */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Profile Picture</Label>
                    <div
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-lg p-4 flex flex-col items-center justify-center gap-2 cursor-pointer bg-muted/20 relative"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        id="avatar-upload-input"
                      />
                      {photo ? (
                        <div className="flex items-center gap-3 w-full">
                          <img
                            src={photo}
                            alt="Preview"
                            className="h-12 w-12 rounded-full object-cover border border-border"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">Custom Profile Picture</p>
                            <p className="text-[10px] text-muted-foreground">Ready to prefill</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.preventDefault();
                              setPhoto("");
                            }}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-full shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Upload className="h-4 w-4 text-primary" />
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-medium">Drag & drop your picture here</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">PNG, JPG up to 2MB (clicks to browse)</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="profile-name" className="text-xs font-semibold">Full Name</Label>
                    <Input
                      id="profile-name"
                      placeholder="e.g. Alex Morgan"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-title" className="text-xs font-semibold">Job Title</Label>
                      <Input
                        id="profile-title"
                        placeholder="e.g. Staff Software Engineer"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-location" className="text-xs font-semibold">Location</Label>
                      <Input
                        id="profile-location"
                        placeholder="e.g. San Francisco, CA"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Contact Tab */}
                <TabsContent value="contact" className="mt-0 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-email" className="text-xs font-semibold">Email Address</Label>
                    <Input
                      id="profile-email"
                      type="email"
                      placeholder="e.g. alex.morgan@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="profile-phone" className="text-xs font-semibold">Phone Number</Label>
                    <Input
                      id="profile-phone"
                      placeholder="e.g. +1 (555) 123-4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </TabsContent>

                {/* Social Links Tab */}
                <TabsContent value="socials" className="mt-0 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Add Social Network Link</Label>
                    <div className="flex gap-2">
                      <div className="w-1/3">
                        <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                          <SelectTrigger className="h-9 text-xs bg-muted/30">
                            <SelectValue placeholder="Platform" />
                          </SelectTrigger>
                          <SelectContent>
                            {PLATFORMS.map((p) => (
                              <SelectItem key={p.value} value={p.value} className="text-xs">
                                <div className="flex items-center gap-1.5">
                                  <p.icon className="h-3.5 w-3.5" />
                                  <span>{p.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1 flex gap-2">
                        <Input
                          placeholder="Link URL (e.g. github.com/username)"
                          value={socialUrl}
                          onChange={(e) => setSocialUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addSocialLink();
                            }
                          }}
                          className="h-9 text-xs"
                        />
                        <Button
                          type="button"
                          onClick={addSocialLink}
                          className="h-9 px-3 shrink-0"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Added social links list */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Current Links</Label>
                    {socials.length === 0 ? (
                      <div className="border border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center text-center bg-muted/10">
                        <Globe className="h-6 w-6 text-muted-foreground/50 mb-1" />
                        <p className="text-xs font-medium text-muted-foreground">No links added yet</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Add your LinkedIn, GitHub, or Portfolio above.</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                        <AnimatePresence>
                          {socials.map((social, index) => {
                            const IconComponent = getPlatformIcon(social.label);
                            return (
                              <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="flex items-center justify-between border border-border/80 bg-muted/20 px-3 py-2 rounded-lg text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <IconComponent className="h-4 w-4 text-primary shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-semibold text-xs leading-none">{social.label}</p>
                                    <p className="text-[10px] text-muted-foreground truncate max-w-[200px] mt-0.5">
                                      {social.url}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <a
                                    href={social.url.startsWith("http") ? social.url : `https://${social.url}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground flex items-center justify-center hover:bg-muted rounded-full transition-colors"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeSocialLink(index)}
                                    className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-full"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60 shrink-0">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateProfileMutation.isPending}
                className="h-9 text-xs font-semibold bg-gradient-to-r from-primary to-purple-600 hover:from-primary/95 hover:to-purple-600/95 shadow-md shadow-primary/10"
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Unsaved Changes Confirmation Dialog */}
      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent className="max-w-md bg-background/95 backdrop-blur-xl border border-border/80 shadow-2xl p-6 rounded-xl overflow-hidden relative">
          <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-amber-500/10 blur-[60px]" />
          
          <DialogHeader className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-lg font-bold tracking-tight text-center text-foreground">
              Unsaved Changes
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs text-center leading-relaxed">
              You have made modifications to your profile. Would you like to save your changes before closing?
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col sm:flex-row justify-end gap-2 mt-6 pt-4 border-t border-border/40 shrink-0">
            <Button
              variant="outline"
              onClick={() => setShowConfirmClose(false)}
              className="text-xs h-9 order-2 sm:order-1 flex-1 sm:flex-initial"
            >
              Keep Editing
            </Button>
            <Button
              variant="ghost"
              onClick={handleDiscard}
              className="text-xs h-9 text-destructive hover:bg-destructive/10 hover:text-destructive order-3 sm:order-2 flex-1 sm:flex-initial"
            >
              Discard
            </Button>
            <Button
              onClick={() => {
                setShowConfirmClose(false);
                handleSave();
              }}
              disabled={updateProfileMutation.isPending}
              className="text-xs h-9 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/95 hover:to-purple-600/95 text-white order-1 sm:order-3 shadow-md shadow-primary/10 flex-1 sm:flex-initial"
            >
              Save & Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
