import { NavLink as RouterNavLink, NavLinkProps, useLocation, useResolvedPath } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { confirmDraftDiscard } from "@/lib/draftGuard";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, ...props }, ref) => {
    const location = useLocation();
    const resolvedPath = useResolvedPath(to);

    return (
      <RouterNavLink
        ref={ref}
        to={to}
        onClick={(event) => {
          props.onClick?.(event);
          if (event.defaultPrevented) return;
          if (location.pathname === resolvedPath.pathname) return;
          if (!confirmDraftDiscard()) {
            event.preventDefault();
          }
        }}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
