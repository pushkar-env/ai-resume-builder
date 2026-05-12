import { Link } from "wouter";
import { Shield } from "lucide-react";

const SUPPORT_EMAIL = "support@resumesensei.com";
import { LegalPageShell } from "@/components/layout/legal-page-shell";

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy | ResumeSensei"
      description="How ResumeSensei collects, uses, and protects your information when you use our resume builder and related services."
      canonicalUrl="https://resumesensei.com/privacy"
      heading="Privacy Policy"
      lastUpdated="May 11, 2026"
      icon={<Shield className="h-6 w-6" aria-hidden />}
    >
      <p>
        This Privacy Policy describes how ResumeSensei (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) handles
        information when you use our website, applications, and services (collectively, the
        &quot;Services&quot;). By using the Services, you agree to this policy. If you do not agree, please do
        not use the Services.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>
          <strong>Account data.</strong> When you sign up or sign in, our authentication provider (Clerk)
          processes identifiers such as your email address, name, and profile image if you choose to
          provide them.
        </li>
        <li>
          <strong>Resume and application content.</strong> Information you enter into the resume builder
          (work history, education, skills, summaries, and similar fields) is processed to provide the
          Services.
        </li>
        <li>
          <strong>Payment information.</strong> Subscription and billing are handled by Razorpay. We do not
          store full card numbers on our servers; Razorpay processes payment data according to its own
          policies.
        </li>
        <li>
          <strong>Usage and technical data.</strong> We may collect device, browser, log, and diagnostic
          information to operate, secure, and improve the Services (for example IP address, timestamps, and
          error logs).
        </li>
      </ul>

      <h2>2. How we use information</h2>
      <p>We use the information above to:</p>
      <ul>
        <li>Provide, maintain, and improve the Services;</li>
        <li>Authenticate users and prevent fraud or abuse;</li>
        <li>Process subscriptions and communicate about billing;</li>
        <li>Offer AI-assisted features when you choose to use them;</li>
        <li>Comply with law and enforce our terms.</li>
      </ul>

      <h2>3. AI processing</h2>
      <p>
        If you use AI-powered features, portions of your content may be sent to an AI provider (such as
        OpenAI) to generate suggestions or text. Do not submit highly sensitive personal data (for example
        government ID numbers, health information, or passwords) into the editor or AI prompts.
      </p>

      <h2>4. Sharing of information</h2>
      <p>We may share information with:</p>
      <ul>
        <li>
          <strong>Service providers</strong> who assist us (authentication, payments, hosting, analytics, AI),
          subject to contractual obligations;
        </li>
        <li>
          <strong>Authorities</strong> when required by law or to protect rights, safety, and security.
        </li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>5. Data retention</h2>
      <p>
        We retain information for as long as needed to provide the Services and for legitimate business and
        legal purposes. You may request deletion of your account subject to applicable law and technical
        constraints; some records may be retained where required for security, fraud prevention, or
        compliance.
      </p>

      <h2>6. Security</h2>
      <p>
        We use reasonable technical and organizational measures to protect information. No method of
        transmission or storage is completely secure; we cannot guarantee absolute security.
      </p>

      <h2>7. International transfers</h2>
      <p>
        Our service providers may process data in countries other than your own. Where required, we rely on
        appropriate safeguards such as standard contractual clauses or equivalent mechanisms.
      </p>

      <h2>8. Your rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, delete, or restrict certain
        processing of your personal information, or to object to processing or request portability. Contact us at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary font-medium hover:underline break-all">
          {SUPPORT_EMAIL}
        </a>{" "}
        to make a request. You may also manage some account settings through your authentication provider.
      </p>

      <h2>9. Children</h2>
      <p>
        The Services are not directed to children under 16 (or the minimum age in your jurisdiction). We do
        not knowingly collect personal information from children.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update this Privacy Policy from time to time. We will post the updated version on this page
        and adjust the &quot;Last updated&quot; date. Material changes may be communicated through the
        Services or by email where appropriate.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about this policy: email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary font-medium hover:underline break-all">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>

      <p className="text-sm not-prose border-t border-border pt-6 mt-10">
        <Link href="/terms" className="text-primary font-medium hover:underline">
          Terms &amp; Conditions
        </Link>
      </p>
    </LegalPageShell>
  );
}
