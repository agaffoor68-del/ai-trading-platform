import * as React from "react";
import { cn } from "@/lib/utils";

/** Text input styled for the dark terminal theme. */
const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-9 w-full rounded-lg border border-border bg-background/60 px-3 py-1 text-sm text-foreground",
      "placeholder:text-text-muted transition-colors duration-200",
      "focus-visible:outline-none focus-visible:border-primary/60 focus-visible:shadow-glow-sm",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

/** Native select with terminal styling. */
const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-9 w-full appearance-none rounded-lg border border-border bg-background/60 px-3 py-1 text-sm text-foreground",
      "focus-visible:outline-none focus-visible:border-primary/60 focus-visible:shadow-glow-sm transition-colors duration-200",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export { Input, Select };
