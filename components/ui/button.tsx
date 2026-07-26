"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // `disabled:pointer-events-none` evita el hover fantasma en un boton apagado,
  // que es el detalle que delata un prototipo.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] font-semibold transition-[background-color,border-color,box-shadow,transform] duration-150 disabled:pointer-events-none disabled:opacity-55 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white hover:bg-brand-dark shadow-sm",
        ghost:
          "bg-surface text-ink border border-line-strong hover:bg-surface-2 hover:border-faint",
        quiet: "bg-transparent text-muted hover:bg-surface-2 hover:text-ink",
        accent:
          "bg-accent text-[#4d3b00] hover:brightness-95 shadow-sm font-bold",
      },
      size: {
        md: "h-11 px-5 text-sm [&_svg]:size-4",
        sm: "h-9 px-3.5 text-[13px] [&_svg]:size-3.5",
        icon: "size-9 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
