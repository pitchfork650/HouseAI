export type Priority = "P1" | "P2" | "P3" | "P4";
export const PRIORITIES: Priority[] = ["P1", "P2", "P3", "P4"];

export const PRIO = {
  P1: { solid: "#C2410C", tint: "#FDEDE3", border: "#F3B48F", text: "#7C2D12", pillBg: "#FDEDE3", pillText: "#9A3412" },
  P2: { solid: "#0B7285", tint: "#E3F4F6", border: "#8FD0D9", text: "#063F48", pillBg: "#E3F4F6", pillText: "#075563" },
  P3: { solid: "#1A56DB", tint: "#E8EFFC", border: "#A9C1F2", text: "#1E3F9A", pillBg: "#E8EFFC", pillText: "#1E3F9A" },
  P4: { solid: "#52627A", tint: "#F1F5F9", border: "#D3DCE6", text: "#24324A", pillBg: "#EDF1F5", pillText: "#3A4A60" },
} as const;

export const PRIORITY_KEY: Record<Priority, string> = {
  P1: "Urgent: pain, infection, injury",
  P2: "Long / high-value: veneers, surgery",
  P3: "Restorative: fillings, crowns",
  P4: "Routine: checkups, cleanings",
};

export function asPriority(p: string): Priority {
  return (PRIORITIES as string[]).includes(p) ? (p as Priority) : "P4";
}
