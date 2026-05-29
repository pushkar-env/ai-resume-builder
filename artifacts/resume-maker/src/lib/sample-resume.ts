import type { ResumeDetail } from "@workspace/api-client-react";

export const SAMPLE_RESUME = {
  id: 0,
  userId: "sample",
  title: "Sample Resume",
  templateId: "silicon-valley",
  accentColor: "#000000",
  fontFamily: "Inter, sans-serif",
  isPublic: false,
  shareToken: null,
  viewCount: 0,
  downloadCount: 0,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  sections: [
    {
      id: 1, type: "personal", title: "Personal", displayOrder: 0, isVisible: true,
      content: {
        name: "Alex Morgan",
        jobTitle: "Senior Software Engineer",
        title: "Senior Software Engineer",
        email: "alex@example.com",
        phone: "+1 (555) 123-4567",
        location: "San Francisco, CA",
        photo: "",
        socials: [
          { label: "GitHub", url: "https://github.com/alexm" },
          { label: "LinkedIn", url: "https://linkedin.com/in/alexm" },
          { label: "Portfolio", url: "https://alexmorgan.dev" },
        ],
      },
    },
    {
      id: 2, type: "summary", title: "Summary", displayOrder: 1, isVisible: true,
      content: { text: "Senior engineer with 8+ years building scalable distributed systems. Led teams of 10+ at high-growth startups and Fortune 500 companies. Passionate about elegant code, mentorship, and shipping products that delight users." },
    },
    {
      id: 3, type: "experience", title: "Experience", displayOrder: 2, isVisible: true,
      content: { items: [
        {
          title: "Staff Engineer", company: "Stripe", location: "SF, CA",
          startDate: "2022", endDate: "Present",
          bullets: [
            { text: "Led migration of payments infrastructure to Kubernetes serving 100B+ requests/year", label: "Architecture write-up", link: "https://example.com/arch" },
            "Mentored 8 engineers and grew team velocity 3x through pairing program",
            { text: "Designed event-driven architecture reducing P99 latency by 65%", label: "Tech talk", link: "https://example.com/talk" },
          ],
        },
        {
          title: "Senior Engineer", company: "Airbnb", location: "SF, CA",
          startDate: "2019", endDate: "2022",
          bullets: [
            "Built core booking platform handling $50B+ annual transactions",
            "Reduced page load time by 40% through React performance optimization",
          ],
        },
        {
          title: "Software Engineer", company: "Uber", location: "SF, CA",
          startDate: "2017", endDate: "2019",
          bullets: ["Developed real-time pricing algorithms for ride matching service"],
        },
      ]},
    },
    {
      id: 4, type: "education", title: "Education", displayOrder: 3, isVisible: true,
      content: { items: [
        { school: "Stanford University", degree: "M.S. Computer Science", field: "AI/ML", startDate: "2015", endDate: "2017", gpa: "3.9" },
        { school: "UC Berkeley", degree: "B.S. Computer Science", startDate: "2011", endDate: "2015", gpa: "3.8" },
      ]},
    },
    {
      id: 5, type: "skills", title: "Skills", displayOrder: 4, isVisible: true,
      content: {
        items: [
          { name: "TypeScript", level: 95 },
          { name: "Python", level: 90 },
          { name: "React", level: 95 },
          { name: "Node.js", level: 90 },
          { name: "Go", level: 80 },
          { name: "AWS", level: 85 },
          { name: "Kubernetes", level: 85 },
          { name: "PostgreSQL", level: 90 },
        ],
      },
    },
    {
      id: 6, type: "projects", title: "Projects", displayOrder: 5, isVisible: true,
      content: { items: [
        { name: "OpenSource SDK", description: "TypeScript SDK with 50k+ monthly downloads", url: "github.com/alex/sdk" },
        { name: "ML Trading Bot", description: "Reinforcement learning algorithmic trading platform" },
      ]},
    },
    {
      id: 7, type: "certifications", title: "Certifications", displayOrder: 6, isVisible: true,
      content: { items: [
        { name: "AWS Solutions Architect", issuer: "Amazon Web Services", date: "2023", credentialUrl: "https://www.credly.com/badges/aws-sa" },
        { name: "Kubernetes CKA", issuer: "CNCF", date: "2022", credentialUrl: "" },
      ]},
    },
  ],
} as unknown as ResumeDetail;
