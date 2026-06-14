import {
  APP_URL,
  BRAND_NAME,
  formatPlanLabel,
  formatPlanPrice,
  formatUnixDate,
  renderDetailsCard,
  renderEmailLayout,
  renderFeatureList,
  renderParagraph,
} from "./layout";

export type SubscriptionEmailContext = {
  firstName: string;
  planType?: string;
  subscriptionId?: string;
  accessUntil?: number;
  nextBillingAt?: number;
  amountLabel?: string;
};

export function buildWelcomeEmail(ctx: SubscriptionEmailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const planLabel = formatPlanLabel(ctx.planType);
  const planPrice = formatPlanPrice(ctx.planType);
  const nextBill = formatUnixDate(ctx.nextBillingAt);

  const details = renderDetailsCard([
    { label: "Plan", value: planLabel },
    { label: "Price", value: planPrice },
    ...(nextBill ? [{ label: "Next billing", value: nextBill }] : []),
    ...(ctx.subscriptionId
      ? [{ label: "Subscription ID", value: ctx.subscriptionId }]
      : []),
  ]);

  const bodyHtml = `
    ${renderParagraph(`Hi ${ctx.firstName},`)}
    ${renderParagraph(`Welcome to ${BRAND_NAME} Pro — your subscription is active. You now have full access to our premium resume tools, built to help you land more interviews.`)}
    ${details}
    ${renderParagraph("Here's what you can do right away:")}
    ${renderFeatureList([
      "Build unlimited AI-powered resumes with premium templates",
      "Run ATS scoring and optimization on every resume",
      "Export polished PDF and DOCX files without watermarks",
      "Create tailored cover letters in minutes",
    ])}
    ${renderParagraph("We're excited to be part of your job search journey.")}`;

  const html = renderEmailLayout({
    preheader: `You're now on ${BRAND_NAME} Pro. Start building your best resume today.`,
    headline: "Welcome to Pro",
    bodyHtml,
    cta: { label: "Open your dashboard", href: `${APP_URL}/dashboard` },
    footerNote: `Manage billing anytime from your account settings.`,
  });

  const text = [
    `Hi ${ctx.firstName},`,
    "",
    `Welcome to ${BRAND_NAME} Pro! Your ${planLabel} subscription (${planPrice}) is now active.`,
    nextBill ? `Next billing date: ${nextBill}` : "",
    "",
    `Open your dashboard: ${APP_URL}/dashboard`,
    `Manage billing: ${APP_URL}/billing`,
    "",
    `Questions? Contact ${APP_URL}/contact`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject: `Welcome to ${BRAND_NAME} Pro`, html, text };
}

export function buildCancellationScheduledEmail(ctx: SubscriptionEmailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const planLabel = formatPlanLabel(ctx.planType);
  const accessUntil = formatUnixDate(ctx.accessUntil);

  const details = renderDetailsCard([
    { label: "Plan", value: planLabel },
    { label: "Status", value: "Cancellation scheduled" },
    ...(accessUntil
      ? [{ label: "Pro access until", value: accessUntil }]
      : []),
    ...(ctx.subscriptionId
      ? [{ label: "Subscription ID", value: ctx.subscriptionId }]
      : []),
  ]);

  const bodyHtml = `
    ${renderParagraph(`Hi ${ctx.firstName},`)}
    ${renderParagraph(`We've received your request to cancel auto-renewal on your ${BRAND_NAME} Pro subscription.`)}
    ${details}
    ${renderParagraph(
      accessUntil
        ? `You'll keep full Pro access until ${accessUntil}. After that, your account will move to the Free plan and auto-renewal will stop.`
        : "You'll keep Pro access for the remainder of your current billing period. After that, your account will move to the Free plan.",
    )}
    ${renderParagraph("Changed your mind? You can restart auto-renewal anytime from your billing page before your access ends.")}`;

  const html = renderEmailLayout({
    preheader: `Your Pro subscription will not renew${accessUntil ? ` after ${accessUntil}` : ""}.`,
    headline: "Cancellation confirmed",
    bodyHtml,
    cta: { label: "Manage billing", href: `${APP_URL}/billing` },
  });

  const text = [
    `Hi ${ctx.firstName},`,
    "",
    `Your ${planLabel} subscription cancellation has been scheduled.`,
    accessUntil ? `Pro access continues until: ${accessUntil}` : "",
    "",
    `Restart auto-renewal: ${APP_URL}/billing`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: `Your ${BRAND_NAME} Pro cancellation is confirmed`,
    html,
    text,
  };
}

export function buildSubscriptionResumedEmail(ctx: SubscriptionEmailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const planLabel = formatPlanLabel(ctx.planType);
  const planPrice = formatPlanPrice(ctx.planType);
  const nextBill = formatUnixDate(ctx.nextBillingAt);

  const details = renderDetailsCard([
    { label: "Plan", value: planLabel },
    { label: "Price", value: planPrice },
    { label: "Status", value: "Active — auto-renewal on" },
    ...(nextBill ? [{ label: "Next billing", value: nextBill }] : []),
    ...(ctx.subscriptionId
      ? [{ label: "Subscription ID", value: ctx.subscriptionId }]
      : []),
  ]);

  const bodyHtml = `
    ${renderParagraph(`Hi ${ctx.firstName},`)}
    ${renderParagraph(`Great news — auto-renewal is back on for your ${BRAND_NAME} Pro subscription.`)}
    ${details}
    ${renderParagraph("Your Pro benefits continue uninterrupted, and your plan will renew automatically at the end of each billing cycle.")}`;

  const html = renderEmailLayout({
    preheader: "Auto-renewal has been re-enabled for your Pro subscription.",
    headline: "Subscription renewed",
    bodyHtml,
    cta: { label: "View billing details", href: `${APP_URL}/billing` },
  });

  const text = [
    `Hi ${ctx.firstName},`,
    "",
    `Auto-renewal is active again on your ${planLabel} plan (${planPrice}).`,
    nextBill ? `Next billing date: ${nextBill}` : "",
    "",
    `Billing page: ${APP_URL}/billing`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: `${BRAND_NAME} Pro — auto-renewal restored`,
    html,
    text,
  };
}

export function buildSubscriptionEndedEmail(
  ctx: SubscriptionEmailContext & { reasonLabel: string },
): {
  subject: string;
  html: string;
  text: string;
} {
  const planLabel = formatPlanLabel(ctx.planType);

  const details = renderDetailsCard([
    { label: "Previous plan", value: planLabel },
    { label: "Status", value: ctx.reasonLabel },
    ...(ctx.subscriptionId
      ? [{ label: "Subscription ID", value: ctx.subscriptionId }]
      : []),
  ]);

  const bodyHtml = `
    ${renderParagraph(`Hi ${ctx.firstName},`)}
    ${renderParagraph(`Your ${BRAND_NAME} Pro subscription has ended and your account is now on the Free plan.`)}
    ${details}
    ${renderParagraph("Your resumes and account data are safe. You can upgrade again anytime to unlock Pro templates, ATS scoring, and unlimited exports.")}`;

  const html = renderEmailLayout({
    preheader: `Your Pro subscription has ended. You're now on the Free plan.`,
    headline: "Pro access ended",
    bodyHtml,
    cta: { label: "Upgrade to Pro", href: `${APP_URL}/pricing` },
  });

  const text = [
    `Hi ${ctx.firstName},`,
    "",
    `Your ${planLabel} subscription has ended (${ctx.reasonLabel}).`,
    "",
    `Upgrade again: ${APP_URL}/pricing`,
  ].join("\n");

  return {
    subject: `Your ${BRAND_NAME} Pro subscription has ended`,
    html,
    text,
  };
}

export function buildPaymentRenewalEmail(ctx: SubscriptionEmailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const planLabel = formatPlanLabel(ctx.planType);
  const planPrice = ctx.amountLabel ?? formatPlanPrice(ctx.planType);
  const nextBill = formatUnixDate(ctx.nextBillingAt);

  const details = renderDetailsCard([
    { label: "Plan", value: planLabel },
    { label: "Amount paid", value: planPrice },
    { label: "Status", value: "Payment successful" },
    ...(nextBill ? [{ label: "Next billing", value: nextBill }] : []),
    ...(ctx.subscriptionId
      ? [{ label: "Subscription ID", value: ctx.subscriptionId }]
      : []),
  ]);

  const bodyHtml = `
    ${renderParagraph(`Hi ${ctx.firstName},`)}
    ${renderParagraph(`We've successfully processed your ${BRAND_NAME} Pro renewal. Thank you for continuing with us.`)}
    ${details}
    ${renderParagraph("Your Pro benefits remain fully active. You can review your subscription anytime from billing settings.")}`;

  const html = renderEmailLayout({
    preheader: `Payment received for your ${planLabel} subscription.`,
    headline: "Payment received",
    bodyHtml,
    cta: { label: "Manage billing", href: `${APP_URL}/billing` },
  });

  const text = [
    `Hi ${ctx.firstName},`,
    "",
    `Payment received for ${planLabel} (${planPrice}).`,
    nextBill ? `Next billing date: ${nextBill}` : "",
    "",
    `Billing: ${APP_URL}/billing`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: `${BRAND_NAME} Pro — payment receipt`,
    html,
    text,
  };
}

export function buildPaymentFailedEmail(ctx: SubscriptionEmailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const planLabel = formatPlanLabel(ctx.planType);

  const details = renderDetailsCard([
    { label: "Plan", value: planLabel },
    { label: "Status", value: "Payment failed — action needed" },
    ...(ctx.subscriptionId
      ? [{ label: "Subscription ID", value: ctx.subscriptionId }]
      : []),
  ]);

  const bodyHtml = `
    ${renderParagraph(`Hi ${ctx.firstName},`)}
    ${renderParagraph(`We couldn't process the latest payment for your ${BRAND_NAME} Pro subscription. Your Pro access may be paused until the payment issue is resolved.`)}
    ${details}
    ${renderParagraph("Please update your payment method or retry from your billing page to keep uninterrupted access to Pro features.")}`;

  const html = renderEmailLayout({
    preheader: "Action needed — we couldn't process your Pro subscription payment.",
    headline: "Payment issue",
    bodyHtml,
    cta: { label: "Update billing", href: `${APP_URL}/billing` },
  });

  const text = [
    `Hi ${ctx.firstName},`,
    "",
    `We couldn't process payment for your ${planLabel} subscription.`,
    "",
    `Update billing: ${APP_URL}/billing`,
  ].join("\n");

  return {
    subject: `Action needed — ${BRAND_NAME} Pro payment failed`,
    html,
    text,
  };
}
