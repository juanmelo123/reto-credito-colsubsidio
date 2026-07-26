"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

// Estados que todo control comparte. `aria-invalid` manda sobre el foco: si el
// dato esta mal, el borde rojo no puede desaparecer al hacer clic en el campo.
const controlBase =
  "w-full rounded-[var(--radius-control)] border border-line-strong bg-surface text-ink " +
  "transition-[border-color,box-shadow] duration-150 " +
  "hover:border-faint " +
  "focus:outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft " +
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-faint disabled:hover:border-line-strong " +
  "aria-[invalid=true]:border-riesgo-alto aria-[invalid=true]:focus:border-riesgo-alto " +
  "aria-[invalid=true]:focus:ring-riesgo-alto-soft";

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "block text-[13px] font-semibold text-muted mb-1.5 peer-disabled:opacity-60",
      className
    )}
    {...props}
  />
));
Label.displayName = "Label";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(controlBase, "h-11 px-3.5 text-[15px]", className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        controlBase,
        "min-h-[120px] resize-y px-3.5 py-3 text-[15px] tabular font-mono",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

// Texto de apoyo bajo un campo. `role="alert"` solo cuando es un error, para no
// hacer que un lector de pantalla interrumpa por una simple pista.
export function FieldHint({
  children,
  error = false,
  className,
}: {
  children: React.ReactNode;
  error?: boolean;
  className?: string;
}) {
  return (
    <p
      role={error ? "alert" : undefined}
      className={cn("mt-1.5 text-[12.5px]", error ? "text-riesgo-alto" : "text-faint", className)}
    >
      {children}
    </p>
  );
}

export { controlBase };
