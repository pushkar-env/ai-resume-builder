import { Router, type IRouter, type Request, type Response } from "express";
import { ListTemplatesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const TEMPLATES = [
  {
    id: "silicon-valley",
    name: "Silicon Valley",
    description: "Two-column with dark sidebar — built for engineers at top tech companies",
    category: "Technical",
    previewImageUrl: "",
    isPremium: false,
  },
  {
    id: "faang",
    name: "FAANG Engineer",
    description: "Precision layout with skill indicators — stand out at Google, Meta, Apple",
    category: "Technical",
    previewImageUrl: "",
    isPremium: false,
  },
  {
    id: "nova",
    name: "Nova Minimal",
    description: "Ultra-clean with extreme whitespace — the design that gets callbacks",
    category: "Minimal",
    previewImageUrl: "",
    isPremium: false,
  },
  {
    id: "executive-pro",
    name: "Executive Pro",
    description: "Serif elegance for C-suite and senior leadership positions",
    category: "Executive",
    previewImageUrl: "",
    isPremium: false,
  },
  {
    id: "creative-pro",
    name: "Creative Pro",
    description: "Bold asymmetric layout for designers, marketers, and creative directors",
    category: "Creative",
    previewImageUrl: "",
    isPremium: true,
  },
  {
    id: "midnight",
    name: "Midnight Luxe",
    description: "Dark background with gold accents — a premium statement for elite roles",
    category: "Premium",
    previewImageUrl: "",
    isPremium: true,
  },
  {
    id: "ats-clean",
    name: "ATS Clean",
    description: "Maximum ATS compatibility — every word counts, nothing is filtered out",
    category: "ATS",
    previewImageUrl: "",
    isPremium: false,
  },
  {
    id: "academic",
    name: "Academic CV",
    description: "Traditional scholarly format for research, academia, and PhD applications",
    category: "Academic",
    previewImageUrl: "",
    isPremium: false,
  },
  {
    id: "corporate-navy",
    name: "Corporate Navy",
    description: "Navy header authority — ideal for finance, law, and consulting firms",
    category: "Professional",
    previewImageUrl: "",
    isPremium: false,
  },
  {
    id: "compact",
    name: "Compact One-Page",
    description: "Dense, pixel-perfect layout that fits everything in a single page",
    category: "Professional",
    previewImageUrl: "",
    isPremium: false,
  },
  {
    id: "european",
    name: "European Style",
    description: "EU Europass-inspired with photo slot and personal details section",
    category: "International",
    previewImageUrl: "",
    isPremium: true,
  },
  {
    id: "two-column",
    name: "Two Column Premium",
    description: "Sophisticated 35/65 split layout — the gold standard for senior roles",
    category: "Premium",
    previewImageUrl: "",
    isPremium: true,
  },
];

router.get("/templates", async (_req: Request, res: Response): Promise<void> => {
  res.json(ListTemplatesResponse.parse(TEMPLATES));
});

export default router;
