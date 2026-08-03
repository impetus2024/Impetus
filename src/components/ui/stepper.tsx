import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export type StepperStep = { label: string }

// Numbered progress indicator for multi-step forms/wizards — circles
// connected by a line, filled in as steps are completed. First use case is
// the Add Player wizard; kept generic (arbitrary step count/labels) since
// any future multi-step form can reuse it as-is.
export function Stepper({
  steps,
  currentStep,
  className,
}: {
  steps: StepperStep[]
  currentStep: number
  className?: string
}) {
  return (
    <ol className={cn("grid", className)} style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
      {steps.map((step, index) => {
        const stepNumber = index + 1
        const isCompleted = stepNumber < currentStep
        const isActive = stepNumber === currentStep

        return (
          <li key={step.label} className="relative flex flex-col items-center gap-1.5">
            {index > 0 && (
              <div
                className={cn(
                  "absolute top-4 right-1/2 h-px w-full",
                  isCompleted || isActive ? "bg-primary" : "bg-border"
                )}
              />
            )}
            <div
              className={cn(
                "relative flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
                (isActive || isCompleted) && "border-primary bg-primary text-primary-foreground",
                !isActive && !isCompleted && "border-border bg-background text-muted-foreground"
              )}
            >
              {isCompleted ? <Check className="size-4" /> : stepNumber}
            </div>
            <span
              className={cn(
                "text-xs font-medium whitespace-nowrap",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
