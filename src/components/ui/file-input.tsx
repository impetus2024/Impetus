"use client"

import { useRef, useState } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Native <input type="file"> renders its own browser-chrome "Choose File"
// button, which can't be restyled directly — this hides that input and
// drives it via a normal icon Button instead, showing the picked filename
// alongside it.
export function FileInput({
  id,
  name,
  accept,
  required,
  className,
  buttonLabel = "Upload",
}: {
  id: string
  name: string
  accept?: string
  required?: boolean
  className?: string
  buttonLabel?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  return (
    <div className={cn("flex h-9 items-center gap-2", className)}>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        required={required}
        className="sr-only"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />
      <Button type="button" variant="outline" size="lg" onClick={() => inputRef.current?.click()}>
        <Upload className="size-3.5" />
        {buttonLabel}
      </Button>
      <span className="truncate text-sm text-muted-foreground">
        {fileName ?? "No file chosen"}
      </span>
    </div>
  )
}
