import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Simple replacement for class-variance-authority (cva)
export function cva(
  base: ClassValue,
  config?: {
    variants?: Record<string, Record<string, ClassValue>>;
    defaultVariants?: Record<string, string>;
  }
) {
  return (props: Record<string, string | number | boolean | ClassValue | undefined> = {}) => {
    const { className, ...rest } = props;
    const classes = [base];

    // Apply variant classes
    if (config?.variants) {
      const variants = config.variants;
      Object.keys(variants).forEach((variant) => {
        const variantValue = rest[variant] || config.defaultVariants?.[variant];
        if (variantValue && variants[variant] && variants[variant][variantValue as string]) {
          classes.push(variants[variant][variantValue as string]);
        }
      });
    }

    return cn(...classes, className);
  };
}
