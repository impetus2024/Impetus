"use client"

import { useRef, useState } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  DOCUMENT_TYPES_LABEL,
  IMAGE_TYPES_LABEL,
} from "@/lib/storage/upload-constraints"

// Native <input type="file"> renders its own browser-chrome "Choose File"
// button, which can't be restyled directly — this hides that input and
// drives it via a normal icon Button instead, showing the picked filename
// alongside it.
//
// Also enforces MAX_UPLOAD_BYTES client-side via setCustomValidity, same
// native-validation convention the rest of the app's forms rely on (see
// player-form.tsx's :invalid step gate) — this is what actually prevents the
// oversized-upload crash: without it, a big enough file's multipart body
// clears next.config.ts's server-action bodySizeLimit before r2.ts's own
// friendly "file too large" check ever runs, and that framework-level
// rejection surfaces as an unhandled error (the route's error.tsx), not a
// form message.
export function FileInput({
  id,
  name,
  accept,
  required,
  className,
  buttonLabel = "Upload",
  hint,
}: {
  id: string
  name: string
  accept?: string
  required?: boolean
  className?: string
  buttonLabel?: string
  hint?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [sizeError, setSizeError] = useState<string | null>(null)

  const typesLabel = accept === "image/*" ? IMAGE_TYPES_LABEL : DOCUMENT_TYPES_LABEL
  const resolvedHint = hint ?? `${typesLabel} — max ${MAX_UPLOAD_MB}MB`

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setFileName(file?.name ?? null)

    if (file && file.size > MAX_UPLOAD_BYTES) {
      const message = `File is too large — max ${MAX_UPLOAD_MB}MB.`
      e.target.setCustomValidity(message)
      setSizeError(message)
    } else {
      e.target.setCustomValidity("")
      setSizeError(null)
    }
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex h-9 items-center gap-2">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="file"
          accept={accept}
          required={required}
          className="sr-only"
          onChange={handleChange}
        />
        <Button type="button" variant="outline" size="lg" onClick={() => inputRef.current?.click()}>
          <Upload className="size-3.5" />
          {buttonLabel}
        </Button>
        <span className="truncate text-sm text-muted-foreground">
          {fileName ?? "No file chosen"}
        </span>
      </div>
      <p className={cn("text-xs", sizeError ? "text-destructive" : "text-muted-foreground")}>
        {sizeError ?? resolvedHint}
      </p>
    </div>
  )
}
