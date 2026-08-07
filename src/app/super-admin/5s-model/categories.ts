export const FIVE_S_CATEGORIES = [
  { slug: "speed", label: "Speed" },
  { slug: "stamina", label: "Stamina" },
  { slug: "strength", label: "Strength" },
  { slug: "skill", label: "Skill" },
  { slug: "spirit", label: "Spirit" },
] as const;

export type FiveSCategorySlug = (typeof FIVE_S_CATEGORIES)[number]["slug"];
