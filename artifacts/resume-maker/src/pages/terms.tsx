import { Link } from "wouter";
import { Scale } from "lucide-react";

const SUPPORT_EMAIL = "support@resumesensei.com";
import { LegalPageShell } from "@/components/layout/legal-page-shell";

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms & Conditions | ResumeSensei"
      description="Terms and conditions for using ResumeSensei, including acceptable use, subscriptions, and limitations of liability."
      canonicalUrl="https://resumesensei.com/terms"
      heading="Terms & Conditions"
      lastUpdated="May 11, 2026"
      icon={<Scale className="h-6 w-6" aria-hidden />}
    >
      <p>
        These Terms &amp; Conditions (&quot;Terms&quot;) govern your access to and use of ResumeSensei
        (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) and our website, applications, and related
        services (the &quot;Services&quot;). By creating an account, clicking to accept, or using the
        Services, you agree to these Terms. If you do not agree, do not use the Services.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be able to form a binding contract in your jurisdiction and meet any minimum age
        requirements (typically at least 16 or older as required locally). If you use the Services on
        behalf of an organization, you represent that you have authority to bind that organization.
      </p>

      <h2>2. Accounts and authentication</h2>
      <p>
        Access may require an account through our authentication provider. You are responsible for
        safeguarding your credentials and for activity under your account. Notify us promptly if you
        suspect unauthorized access, email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary font-medium hover:underline break-all">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>

      <h2>3. License to use the Services</h2>
      <p>
        We grant you a limited, non-exclusive, non-transferable, revocable license to use the Services for
        your personal or internal business purposes in accordance with these Terms. We reserve all rights
        not expressly granted.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Violate applicable law or third-party rights;</li>
        <li>Attempt to gain unauthorized access to the Services, systems, or other users&apos; data;</li>
        <li>Use the Services to distribute malware, spam, or deceptive content;</li>
        <li>Reverse engineer, scrape, or overload the Services except as permitted by law;</li>
        <li>Misrepresent your identity or affiliation;</li>
        <li>Use AI features to generate unlawful, harmful, or infringing content.</li>
      </ul>
      <p>We may suspend or terminate access for conduct that we reasonably believe violates these Terms.</p>

      <h2>5. Content you provide</h2>
      <p>
        You retain ownership of content you submit (&quot;Your Content&quot;). You grant us a worldwide,
        non-exclusive license to host, process, display, and transmit Your Content solely to operate,
        improve, and provide the Services (including AI-assisted processing where you use those features).
      </p>
      <p>
        You represent that you have the rights necessary to submit Your Content and that it does not
        violate law or third-party rights.
      </p>

      <h2>6. Subscriptions and payments</h2>
      <p>
        Paid plans, if offered, are billed through our payment processor (Razorpay). Fees, renewal, taxes,
        and cancellation terms are presented at checkout and in your account or order confirmation where
        applicable. Unless stated otherwise, subscriptions renew until cancelled according to the
        processor&apos;s and our published flows.
      </p>
      <p>
        We may change pricing or features with reasonable notice where required by law. Continued use after
        changes may constitute acceptance.
      </p>

      <h2>7. AI-generated output</h2>
      <p>
        AI suggestions may be inaccurate or incomplete. You are responsible for reviewing and editing any
        content before use (for example in job applications). We do not guarantee employment outcomes or
        scores from any &quot;ATS&quot; or similar tools.
      </p>

      <h2>8. Disclaimers</h2>
      <p>
        THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY
        KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY,
        FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT, TO THE MAXIMUM EXTENT PERMITTED BY LAW.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE AND OUR SUPPLIERS WILL NOT BE LIABLE FOR ANY INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL,
        ARISING FROM OR RELATED TO THE SERVICES. OUR AGGREGATE LIABILITY FOR CLAIMS ARISING OUT OF OR
        RELATED TO THE SERVICES WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US FOR THE SERVICES
        IN THE TWELVE MONTHS BEFORE THE CLAIM OR (B) FIFTY U.S. DOLLARS (OR THE LOCAL EQUIVALENT), EXCEPT
        WHERE LIABILITY CANNOT BE LIMITED BY LAW.
      </p>

      <h2>10. Indemnity</h2>
      <p>
        You will defend and indemnify us and our affiliates, officers, and employees against any claims,
        damages, losses, or expenses (including reasonable attorneys&apos; fees) arising from Your Content
        or your misuse of the Services, except to the extent caused by our willful misconduct.
      </p>

      <h2>11. Termination</h2>
      <p>
        You may stop using the Services at any time. We may suspend or terminate access if you materially
        breach these Terms or if we discontinue the Services (where permitted, with notice when
        reasonable).
      </p>

      <h2>12. Governing law</h2>
      <p>
        These Terms are governed by the laws of the jurisdiction we designate for our entity, without regard
        to conflict-of-law rules, except where consumer protection laws require otherwise. Courts in that
        jurisdiction will have exclusive venue, unless mandatory law gives you a right to sue in your home
        courts.
      </p>
      <p className="text-sm italic">
        Replace this section with your company&apos;s governing law and venue after legal review.
      </p>

      <h2>13. Changes to these Terms</h2>
      <p>
        We may modify these Terms. We will post the updated Terms on this page and update the
        &quot;Last updated&quot; date. Where required, we will provide additional notice. Continued use
        after the effective date may constitute acceptance.
      </p>

      <h2>14. Contact</h2>
      <p>
        For questions about these Terms, email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary font-medium hover:underline break-all">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>

      <p className="text-sm not-prose border-t border-border pt-6 mt-10">
        <Link href="/privacy" className="text-primary font-medium hover:underline">
          Privacy Policy
        </Link>
      </p>
    </LegalPageShell>
  );
}
