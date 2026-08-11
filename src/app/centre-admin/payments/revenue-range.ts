// Plain module (no "use client") so both the server page and the client
// dropdown can import the same options -- a client-component export of a
// bare constant doesn't reliably cross back into a Server Component under
// this app's RSC bundling (confirmed: it arrives as something other than
// the real array, breaking .some()/.find() calls on the server side).
export const REVENUE_RANGE_OPTIONS = [
  { id: "6", name: "Last 6 Months" },
  { id: "12", name: "Last 12 Months" },
  { id: "24", name: "Last 24 Months" },
  { id: "all", name: "All Time" },
] as const;

export const DEFAULT_REVENUE_RANGE = "6";
