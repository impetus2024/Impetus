// Shared by every paginated list page — one page size, one way to turn a
// `page` search param into a Postgres/PostgREST .range() pair, so each page
// doesn't reinvent (and risk mis-computing) the off-by-one math.
export const PAGE_SIZE = 25;

export function parsePageParam(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function pageRange(page: number, pageSize = PAGE_SIZE): [number, number] {
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
}

export function totalPages(count: number | null, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil((count ?? 0) / pageSize));
}
