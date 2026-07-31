import { Zap, Activity, Dumbbell, Flame, Target, type LucideIcon } from "lucide-react";

export type FiveSCategory = "speed" | "stamina" | "strength" | "spirit" | "skill";

export const FIVE_S_CATEGORY_META: Record<
  FiveSCategory,
  { label: string; icon: LucideIcon; description: string }
> = {
  speed: {
    label: "Speed",
    icon: Zap,
    description:
      "A quick, focused test to measure a player's acceleration and top-end speed across short sprint distances.",
  },
  stamina: {
    label: "Stamina",
    icon: Activity,
    description:
      "Assesses a player's cardiovascular endurance and ability to sustain effort over an extended period of play.",
  },
  strength: {
    label: "Strength",
    icon: Dumbbell,
    description:
      "Measures a player's physical power, useful in duels, shielding the ball, and other physical contests on the pitch.",
  },
  spirit: {
    label: "Spirit",
    icon: Flame,
    description:
      "Evaluates a player's mentality, determination, and competitive drive during training and matches.",
  },
  skill: {
    label: "Skill",
    icon: Target,
    description:
      "Tests a player's technical ability on the ball — control, passing, and finishing under pressure.",
  },
};

export const FIVE_S_CATEGORY_ORDER: FiveSCategory[] = ["speed", "stamina", "strength", "spirit", "skill"];
