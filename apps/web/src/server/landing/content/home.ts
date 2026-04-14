export const landingPrimaryNavigation = [
  { href: "/#for-whom", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
] as const

export const landingExamplePrompts = [
  "We have users, but onboarding and support are still manual and fragmented.",
  "Help me set up the business operations around my SaaS product.",
  "We're getting customers but losing them because follow-up is a mess.",
  "We ship fast, but the business side still runs on scattered tools and manual work.",
] as const

export const landingPainCards = [
  {
    description:
      "Customer success still lives in scattered docs, inboxes, and founder memory.",
    title: "Onboarding slips through the cracks",
  },
  {
    description:
      "Context gets lost between support requests, product decisions, and follow-up work.",
    title: "Support context is scattered",
  },
  {
    description:
      "Nobody consistently owns the next operational step after a customer conversation or launch milestone.",
    title: "Follow-through stays manual",
  },
] as const

export const landingAudienceCards = [
  {
    description:
      "You can build the product, but the business side is still founder-driven and manual.",
    title: "Solo founders",
  },
  {
    description:
      "You move quickly on product, but onboarding, support, and execution still need structure.",
    title: "Small software teams",
  },
  {
    description:
      "You need one operating layer that complements product and technical skills.",
    title: "Technical builders",
  },
] as const

export const landingHowItWorks = [
  {
    body: "Just chat. Tell Otto where you are and what is not working yet.",
    step: "01",
    title: "Talk to Otto",
  },
  {
    body: "Otto maps out the gaps and figures out what to tackle first.",
    step: "02",
    title: "Get a plan",
  },
  {
    body: "Otto helps you go from plan to live — and keeps the business running after launch.",
    step: "03",
    title: "Build it, launch it, run it",
  },
] as const

export const landingOperatingPillars = [
  {
    description:
      "Qualify new customers, drive onboarding, and keep every next step visible.",
    title: "Onboarding",
  },
  {
    description:
      "Centralize customer context, responses, and follow-up across the team.",
    title: "Support",
  },
  {
    description:
      "Turn recurring business work into tracked, repeatable execution instead of founder memory.",
    title: "Operations",
  },
] as const

export const landingFooterColumns = [
  {
    links: [
      { href: "/#for-whom", label: "Product" },
      { href: "/pricing", label: "Pricing" },
      { href: "/security", label: "Security" },
    ],
    title: "Product",
  },
  {
    links: [
      { href: "/login?mode=sign-in", label: "Log in" },
      { href: "/login", label: "Get started" },
    ],
    title: "Company",
  },
  {
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#proof", label: "How Otto helps" },
    ],
    title: "Resources",
  },
  {
    links: [
      { href: "/security", label: "Security" },
      { href: "/", label: "Privacy" },
      { href: "/", label: "Terms" },
    ],
    title: "Legal",
  },
] as const
