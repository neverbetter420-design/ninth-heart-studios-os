export type Priority = "critical" | "high" | "normal";

export const metrics = [
  { label: "Active Leads", value: "18", detail: "+4 this week", tone: "violet" },
  { label: "Waiting on Me", value: "3", detail: "2 need replies today", tone: "pink" },
  { label: "Open Projects", value: "6", detail: "2 in build", tone: "cyan" },
  { label: "Pipeline Value", value: "$8.4k", detail: "+$1.9k this month", tone: "green" },
] as const;

export const nextActions: Array<{
  id: number;
  title: string;
  subject: string;
  meta: string;
  priority: Priority;
  action: string;
}> = [
  {
    id: 1,
    title: "Reply to lead",
    subject: "Black Diamond Tavern",
    meta: "Reply received 42m ago · business email",
    priority: "critical",
    action: "Open lead",
  },
  {
    id: 2,
    title: "Prepare for consultation",
    subject: "Copper & Ash Salon",
    meta: "Consult tomorrow · intake complete",
    priority: "high",
    action: "Prep brief",
  },
  {
    id: 3,
    title: "Respond to new lead",
    subject: "Rainier Plumbing Co.",
    meta: "Inbound 3h ago · SLA due next business day",
    priority: "normal",
    action: "Draft reply",
  },
];

export const projects = [
  { name: "South Prairie Bar & Grill", stage: "Care Plan", progress: 84, due: "Ongoing" },
  { name: "Velvet Room", stage: "Design", progress: 58, due: "Oct 19" },
  { name: "Northline Electric", stage: "Content", progress: 37, due: "Oct 26" },
  { name: "Ember Hair Studio", stage: "Discovery", progress: 18, due: "Nov 2" },
];

export const opportunities = [
  { source: "Freelancer", title: "Restaurant website redesign", score: 92, fit: "Strong" },
  { source: "Freelancer", title: "Wix site rescue + booking", score: 86, fit: "Strong" },
  { source: "Referral", title: "Local salon refresh", score: 78, fit: "Good" },
];

export const activity = [
  { time: "12m", text: "Lead score recalculated for Black Diamond Tavern" },
  { time: "48m", text: "Project milestone completed: Velvet Room wireframes" },
  { time: "2h", text: "New inbound lead captured: Rainier Plumbing Co." },
  { time: "Yesterday", text: "South Prairie care-plan check completed" },
];
