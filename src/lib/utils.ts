import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Base UI's Select.Value only knows an item's label once the popup has
// registered it via interaction; a pre-set value (edit forms, URL-driven
// selects) renders as the raw id until then. Pass this as SelectValue's
// children to look the label up directly instead.
export function selectLabel<T extends { id: string; name: string }>(
  options: T[],
  placeholder: string
) {
  return (value: string) => options.find((o) => o.id === value)?.name ?? placeholder;
}
