import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  CalendarCheck,
  Users,
  Tag,
  UserCog,
  Wallet,
  Package2,
  ClipboardCheck,
  HeartPulse,
  Sparkles,
  User,
  Mail,
  Megaphone,
  Newspaper,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { label?: string; items: NavItem[] };

export const SUPER_ADMIN_NAV: NavGroup[] = [
  { items: [{ href: "/super-admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Management",
    items: [{ href: "/super-admin/centres", label: "Centre Management", icon: Building2 }],
  },
  {
    label: "Content",
    items: [
      { href: "/super-admin/monthly-highlights", label: "Monthly Highlights", icon: Megaphone },
      { href: "/super-admin/news-events", label: "News & Events", icon: Newspaper },
    ],
  },
  {
    label: "Insights",
    items: [{ href: "/super-admin/email-analytics", label: "Email Analytics", icon: Mail }],
  },
];

export const CENTRE_ADMIN_NAV: NavGroup[] = [
  { items: [{ href: "/centre-admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Operations",
    items: [
      { href: "/centre-admin/gate-pass", label: "Gate Pass", icon: DoorOpen },
      { href: "/centre-admin/batches", label: "Batch Management", icon: CalendarCheck },
      { href: "/centre-admin/players", label: "Player Management", icon: Users },
      { href: "/centre-admin/player-types", label: "Program Type", icon: Tag },
      { href: "/centre-admin/5s-model", label: "5S Model", icon: Sparkles },
    ],
  },
  {
    label: "Accounts",
    items: [
      { href: "/centre-admin/administrators", label: "Administrator Management", icon: UserCog },
      { href: "/centre-admin/payments", label: "Payment History", icon: Wallet },
      { href: "/centre-admin/packages", label: "Package Management", icon: Package2 },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/centre-admin/monthly-highlights", label: "Monthly Highlights", icon: Megaphone },
      { href: "/centre-admin/news-events", label: "News & Events", icon: Newspaper },
    ],
  },
  {
    label: "Insights",
    items: [{ href: "/centre-admin/email-analytics", label: "Email Analytics", icon: Mail }],
  },
];

export const COACH_NAV: NavGroup[] = [
  { items: [{ href: "/coach", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Training",
    items: [
      { href: "/coach/batches", label: "Training Batch", icon: CalendarCheck },
      { href: "/coach/attendance", label: "Attendance", icon: ClipboardCheck },
      { href: "/coach/injuries", label: "Injuries", icon: HeartPulse },
      { href: "/coach/5s-model", label: "5S Model", icon: Sparkles },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/coach/monthly-highlights", label: "Monthly Highlights", icon: Megaphone },
      { href: "/coach/news-events", label: "News & Events", icon: Newspaper },
    ],
  },
];

export const MEDICAL_NAV: NavGroup[] = [
  { items: [{ href: "/medical", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Medical",
    items: [{ href: "/medical/injuries", label: "Injuries", icon: HeartPulse }],
  },
  {
    label: "Content",
    items: [
      { href: "/medical/monthly-highlights", label: "Monthly Highlights", icon: Megaphone },
      { href: "/medical/news-events", label: "News & Events", icon: Newspaper },
    ],
  },
];

export const PARENT_NAV: NavGroup[] = [
  { items: [{ href: "/parent", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Family",
    items: [{ href: "/parent/player", label: "Player", icon: User }],
  },
  {
    label: "Content",
    items: [
      { href: "/parent/monthly-highlights", label: "Monthly Highlights", icon: Megaphone },
      { href: "/parent/news-events", label: "News & Events", icon: Newspaper },
    ],
  },
];

// Lucide icon components aren't serializable across the Server -> Client
// boundary (layout.tsx is a Server Component; the shell is Client). So
// layout.tsx passes this string key instead of the NavGroup[] itself, and
// the Client Components resolve it via this same-module import.
export type NavKey = "super-admin" | "centre-admin" | "coach" | "medical" | "parent";

export const NAV_BY_KEY: Record<NavKey, NavGroup[]> = {
  "super-admin": SUPER_ADMIN_NAV,
  "centre-admin": CENTRE_ADMIN_NAV,
  coach: COACH_NAV,
  medical: MEDICAL_NAV,
  parent: PARENT_NAV,
};
