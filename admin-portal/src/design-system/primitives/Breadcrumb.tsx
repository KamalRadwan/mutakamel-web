import { forwardRef } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";

export const Breadcrumb = forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>((props, ref) => (
  <nav ref={ref} aria-label="Breadcrumb" {...props} />
));
Breadcrumb.displayName = "Breadcrumb";

export const BreadcrumbList = forwardRef<HTMLOListElement, React.OlHTMLAttributes<HTMLOListElement>>(
  ({ className, ...props }, ref) => (
    <ol
      ref={ref}
      className={cn("flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground", className)}
      {...props}
    />
  ),
);
BreadcrumbList.displayName = "BreadcrumbList";

export const BreadcrumbItem = forwardRef<HTMLLIElement, React.LiHTMLAttributes<HTMLLIElement>>(
  ({ className, ...props }, ref) => (
    <li ref={ref} className={cn("inline-flex items-center gap-1.5", className)} {...props} />
  ),
);
BreadcrumbItem.displayName = "BreadcrumbItem";

export const BreadcrumbLink = forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ className, ...props }, ref) => (
    <a ref={ref} className={cn("transition-colors hover:text-foreground motion-reduce:transition-none", className)} {...props} />
  ),
);
BreadcrumbLink.displayName = "BreadcrumbLink";

export function BreadcrumbPage({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span role="link" aria-current="page" className={cn("font-medium text-foreground", className)} {...props} />;
}

export function BreadcrumbSeparator({ className, ...props }: React.HTMLAttributes<HTMLLIElement>) {
  return (
    <li role="presentation" aria-hidden="true" className={cn("[&>svg]:size-3.5", className)} {...props}>
      {/* Logical chevron: points toward "forward" (end) in LTR, flips
          automatically in RTL via rtl:rotate-180. */}
      <ChevronRight className="rtl:rotate-180" />
    </li>
  );
}
