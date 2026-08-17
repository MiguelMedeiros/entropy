import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { CircleHelp } from "lucide-react";
import { useState, type ReactNode } from "react";

export const GlossaryProvider = TooltipPrimitive.Provider;

export function GlossaryTerm({
  children,
  definition,
}: {
  children: ReactNode;
  definition: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipPrimitive.Root open={open} onOpenChange={setOpen}>
      <TooltipPrimitive.Trigger asChild>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-1 border-b border-dotted border-muted/60 text-inherit outline-none transition hover:border-accent hover:text-accent focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-accent"
        >
          {children}
          <CircleHelp className="size-3 shrink-0 text-muted" />
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={7}
          className="z-50 max-w-72 rounded-xl border border-line bg-ink px-3 py-2 text-left text-xs font-normal leading-5 text-canvas shadow-lift"
        >
          {definition}
          <TooltipPrimitive.Arrow className="fill-ink" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
