/** Minimal mirror of the API catalog for the deterministic E2E fake API. */
export type FakeExpert = {
  id: string;
  name: string;
  role: string;
  scope: string;
  tone: string;
  suggestions: string[];
};

export const FAKE_EXPERTS: FakeExpert[] = [
  {
    id: "cto",
    name: "CTO Expert",
    role: "Technology & Engineering",
    scope: "Technology, architecture, security and engineering leadership.",
    tone: "Technical and pragmatic.",
    suggestions: [
      "Review our architecture for the top three scaling risks.",
      "What should be in the next engineering roadmap?",
      "What are the top security risks for a product at our stage?",
    ],
  },
  {
    id: "cmo",
    name: "CMO Expert",
    role: "Marketing & Brand",
    scope: "Marketing, brand, acquisition and content.",
    tone: "Creative and data-driven.",
    suggestions: [
      "Which acquisition channel has the best conversion trend?",
      "Draft a campaign brief for our next launch.",
      "How would you position us against a generic competitor?",
    ],
  },
  {
    id: "sales-director",
    name: "Sales Director Expert",
    role: "Sales & Revenue",
    scope: "Pipeline, revenue forecasting, key accounts and negotiation.",
    tone: "Commercial and goal-oriented.",
    suggestions: [
      "Which deals in the pipeline are most at risk?",
      "Draft a follow-up plan for our top accounts.",
      "How would you build a forecast for this quarter?",
    ],
  },
  {
    id: "customer-success-director",
    name: "Customer Success Director Expert",
    role: "Customer Success & Retention",
    scope: "Adoption, health score, retention and expansion.",
    tone: "Consultative and empathetic.",
    suggestions: [
      "Which accounts show early churn signals?",
      "Draft a recovery plan for a low-health account.",
      "What are the most common adoption blockers in B2B products?",
    ],
  },
  {
    id: "customer-hero-director",
    name: "Customer Hero Director Expert",
    role: "Customer Experience & Advocacy",
    scope: "Voice of the customer, experience, escalation and success stories.",
    tone: "Warm, energetic and solution-oriented.",
    suggestions: [
      "Which customer issue needs escalation now?",
      "Draft a response that turns a complaint into a success story.",
      "How would you collect and share customer stories?",
    ],
  },
  {
    id: "ceo",
    name: "CEO Expert",
    role: "Strategy & Leadership",
    scope: "Strategy, business, finance and prioritization.",
    tone: "Executive, direct and decision-oriented.",
    suggestions: [
      "Summarize the biggest risks to this quarter's goals.",
      "What should we deprioritize to protect our runway?",
      "Draft a 90-day strategic plan for the next quarter.",
    ],
  },
  {
    id: "cfo",
    name: "CFO Expert",
    role: "Finance & Capital",
    scope: "Cash flow, budgeting, margin and fundraising.",
    tone: "Rigorous, conservative and numerical.",
    suggestions: [
      "How would you calculate and extend our cash runway?",
      "Where can we reduce spend without hurting growth?",
      "How should we read a margin change by product line?",
    ],
  },
  {
    id: "coo",
    name: "COO Expert",
    role: "Operations & Execution",
    scope: "Operations, processes, SLAs and execution.",
    tone: "Objective and execution-focused.",
    suggestions: [
      "Which process is the biggest bottleneck right now?",
      "Draft an action plan to improve our SLA.",
      "How would you reduce our most common operational bottleneck?",
    ],
  },
  {
    id: "cpo",
    name: "CPO Expert",
    role: "Product & Discovery",
    scope: "Discovery, roadmap, prioritization and product metrics.",
    tone: "User-centered and experimental.",
    suggestions: [
      "Which user problem should we solve next?",
      "Draft a prioritized roadmap for the next quarter.",
      "How would you prioritize themes from customer interviews?",
    ],
  },
];
