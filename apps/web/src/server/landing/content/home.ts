export const landingPrimaryNavigation = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
] as const

export const landingExamplePrompts = [
  "I have a SaaS product and need help with onboarding, support, and retention.",
  "Help me turn my AI product into a real software business with repeatable operations.",
  "I need an operating system for customer support, handoffs, and follow-through.",
  "We ship product quickly, but the business around it is still messy and manual.",
] as const

export const landingCapabilityCards = [
  {
    description:
      "Bring support, customer success, and execution into one shared operating rhythm.",
    title: "Support and customer ops",
  },
  {
    description:
      "Set up onboarding, follow-ups, and internal workflows without building a second company in Notion and Slack.",
    title: "Onboarding and delivery",
  },
  {
    description:
      "Make growth, workflows, and operational decisions visible in one place instead of scattered prompts and docs.",
    title: "Growth and operating cadence",
  },
] as const

export const landingNumbers = [
  {
    description: "Support, operations, and growth should run in one system.",
    value: "3 core loops",
  },
  {
    description:
      "Keep decisions, instructions, and execution in one operating workspace.",
    value: "1 operating layer",
  },
  {
    description:
      "Reduce scattered prompts, manual handoffs, and copy-pasted runbooks.",
    value: "0 extra sprawl",
  },
] as const

export const landingHowItWorks = [
  {
    body: "Start with the business problem, not a giant setup checklist. Otto should understand what you are trying to build and where the business is currently breaking down.",
    step: "01",
    title: "Describe the business you want to run",
  },
  {
    body: "Use one prompt to qualify the business, the stage, and the operating gaps. This is where a later onboarding agent loop will take over.",
    step: "02",
    title: "Let Otto qualify the operating needs",
  },
  {
    body: "Move from an idea to a real operating system for support, execution, workflows, and the business around the product.",
    step: "03",
    title: "Turn the brief into a working business system",
  },
] as const

export const landingFooterColumns = [
  {
    links: [
      { href: "/#product", label: "Product" },
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
      { href: "/#examples", label: "Examples" },
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
