import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  /** Optional greeting shown above the eyebrow. */
  greeting?: string;
  /** Optional slot for badges, chips, or quick stats rendered to the right. */
  trailing?: ReactNode;
  /** Optional hero variant — adds gradient backdrop and larger type. */
  variant?: "default" | "hero";
};

export function PageHeader({
  eyebrow,
  title,
  description,
  greeting,
  trailing,
  variant = "default",
}: PageHeaderProps) {
  return (
    <div className={`page-header page-header--${variant} fade-slide-in`}>
      <div className="page-header-text">
        {greeting ? <p className="page-header-greeting">{greeting}</p> : null}
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {trailing ? <div className="page-header-trailing">{trailing}</div> : null}
    </div>
  );
}