import type { MuseProjectPlan } from "./muse-project-guide";

// Synthetic approved four-phase roadmap. No customer data or database connection.
const template = [
  {
    title: "Discovery & Strategy",
    tasks: [
      ["Review client intake", "Confirm objectives, audience and essential content.", "Collect the intake answers", "Identify missing assets"],
      ["Audit current website", "Review current navigation, mobile experience, accessibility and conversion paths.", "Inspect the desktop website", "Document mobile and accessibility issues"],
      ["Define goals and audience", "Turn discovery findings into measurable project outcomes.", "List top visitor goals", "Set success indicators"],
      ["Approve site structure", "Finalize the sitemap and key visitor journeys.", "Draft navigation hierarchy", "Review proposed page structure"],
    ],
  },
  {
    title: "Design Direction",
    tasks: [
      ["Build moodboard", "Collect visual references that align with client goals.", "Gather references", "Define what to avoid"],
      ["Set design tokens", "Establish typography, color, spacing and accessible contrast.", "Create type and color tokens", "Check contrast"],
      ["Create homepage concept", "Design the opening page as the primary visual direction.", "Build the hero and primary actions", "Check mobile composition"],
      ["Design interior pages", "Extend approved patterns into service and contact pages.", "Create reusable sections", "Review responsive patterns"],
      ["Approve design direction", "Confirm visual direction before development begins.", "Present key screens", "Record approved decisions"],
    ],
  },
  {
    title: "Website Development",
    tasks: [
      ["Set up project", "Prepare the site workspace, assets and component structure.", "Confirm domain and environment", "Prepare shared assets"],
      ["Build global layout", "Create navigation, footer, reusable styles and layout.", "Implement navigation", "Implement footer"],
      ["Develop homepage", "Build the approved homepage design.", "Implement hero and primary sections", "Test mobile rendering"],
      ["Build interior pages", "Implement remaining pages and templates.", "Build service pages", "Build contact and about"],
      ["Integrate forms/booking", "Connect the approved interactive features.", "Test forms", "Verify booking setup"],
      ["Mobile refinement", "Improve readability, spacing and interactions across screen sizes.", "Check touch targets", "Review narrow layouts"],
      ["Content and SEO", "Place finalized content and add the agreed SEO essentials.", "Add metadata", "Review alt text and headings"],
    ],
  },
  {
    title: "Testing & Launch",
    tasks: [
      ["Functional QA", "Test navigation, forms, booking, links and client flows.", "Test links and forms", "Record bugs"],
      ["Accessibility check", "Review keyboard behavior, contrast and labels.", "Keyboard review", "Contrast and label review"],
      ["Client review", "Collect final client feedback and resolve approved revisions.", "Share review checklist", "Record sign-off"],
      ["Deploy approved site", "Publish only with separate explicit launch authorization.", "Confirm launch approval", "Follow release checklist"],
      ["Post-launch verification", "Confirm the live experience after authorized publishing.", "Check live links", "Verify forms and responsive layout"],
    ],
  },
] as const;

let taskCounter = 0;
export const MUSE_DEMO_PLAN: MuseProjectPlan = {
  schemaVersion: "1.0",
  projectId: "synthetic-muse-project",
  projectRevision: 0,
  summary: "A guided website redesign, from discovery to launch.",
  warnings: ["Demonstration only. No live project, client or launch authorization is involved."],
  phases: template.map((phase, phaseIndex) => ({
    tempId: "phase-" + (phaseIndex + 1),
    title: phase.title,
    position: phaseIndex,
    tasks: phase.tasks.map(([title, description, stepA, stepB], position) => {
      const current = ++taskCounter;
      return {
        tempId: "task-" + current,
        title,
        description,
        position,
        priority: (position === 0 ? "high" : "normal") as "high" | "normal",
        estimatedMinutes: 45,
        completionCriteria: ["Reviewed and confirmed by the studio owner"],
        dependsOn: current === 1 ? [] : ["task-" + (current - 1)],
        subtasks: [stepA, stepB].map((stepTitle, subPosition) => ({
          tempId: "step-" + current + "-" + subPosition,
          title: stepTitle,
          instructions: stepTitle + ". Save notes or decisions as evidence before marking the parent task complete.",
          position: subPosition,
          completionCriteria: ["Completed and reviewed"],
        })),
      };
    }),
  })),
};
