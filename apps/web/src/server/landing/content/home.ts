export const landingPrimaryNavigation = [
  { href: "/#for-whom", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
] as const

export const landingExamplePrompts = [
  "We have users, but onboarding and support are still manual and fragmented.",
  "Help me set up the business operations around my SaaS product.",
  "I need an AI operating layer for customer onboarding and follow-through.",
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
    body: "Describe what you are building, where you are in the journey, and where the business side is breaking down.",
    step: "01",
    title: "Start with a business brief",
  },
  {
    body: "Use one prompt to clarify the stage, the operating gaps, and the next practical move. This is where the live qualification loop will plug in.",
    step: "02",
    title: "Let Otto qualify what matters next",
  },
  {
    body: "Turn that brief into a working system for onboarding, support, handoffs, and recurring business operations.",
    step: "03",
    title: "Build the business around the product",
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
      { href: "/login", label: "Log in" },
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
