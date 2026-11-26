import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "sun" | "ghost";

const variantClass: Record<Variant, string> = {
  primary: "pods-btn-primary",
  outline: "pods-btn-outline",
  sun: "pods-btn-sun",
  ghost: "pods-btn-ghost",
};

type Base = {
  variant?: Variant;
  block?: boolean;
  className?: string;
  children: ReactNode;
};

type AsButton = Base &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: never;
  };

type AsLink = Base & {
  href: string;
  "aria-label"?: string;
  onClick?: () => void;
};

export function PodsButton(props: AsButton | AsLink) {
  const { variant = "primary", block, className, children } = props;
  const classes = cn("pods-btn", variantClass[variant], block && "pods-btn-block", className);

  if ("href" in props && props.href) {
    return (
      <Link
        to={props.href}
        onClick={props.onClick}
        className={classes}
        aria-label={props["aria-label"]}
      >
        {children}
      </Link>
    );
  }

  const buttonProps = props as AsButton;
  const {
    variant: _v,
    block: _b,
    className: _c,
    children: _ch,
    href: _h,
    type = "button",
    ...rest
  } = buttonProps as AsButton & { href?: never };

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
