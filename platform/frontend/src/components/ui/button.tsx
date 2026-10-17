import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "success" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg hover:opacity-90 shadow-sm",
  secondary: "bg-surface-2 text-fg hover:bg-border/70",
  ghost: "text-fg hover:bg-surface-2",
  outline: "border border-border bg-surface hover:bg-surface-2",
  success: "bg-success text-white dark:text-black hover:opacity-90",
  danger: "bg-danger text-white dark:text-black hover:opacity-90",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
  icon: "h-9 w-9",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(
      "inline-flex items-center justify-center rounded-xl font-medium transition disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
      variants[variant], sizes[size], className,
    )}
    {...props}
  />
));
Button.displayName = "Button";
