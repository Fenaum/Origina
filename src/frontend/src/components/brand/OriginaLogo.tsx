import Image from "next/image";
import Link from "next/link";

type OriginaLogoProps = {
  href?: string;
  subtitle?: string;
  compact?: boolean;
  mode?: "with-title" | "mark-wordmark" | "mark-only";
  className?: string;
};

export function OriginaLogo({
  href,
  subtitle,
  compact = false,
  mode = "mark-wordmark",
  className = "",
}: OriginaLogoProps) {
  const isFullLogo = mode === "with-title";
  const isMarkOnly = compact || mode === "mark-only";
  const content = (
    <>
      <Image
        className={
          isFullLogo ? "origina-logo-image with-title" : "origina-logo-mark"
        }
        src={isFullLogo ? "/origina-logo-with-title.webp" : "/origina-logo-mark.webp"}
        alt={isFullLogo ? "Origina" : ""}
        aria-hidden={isFullLogo ? undefined : "true"}
        width={1024}
        height={1024}
        priority
      />
      {!isFullLogo && !isMarkOnly ? (
        <span className="origina-logo-text">
          <strong>Origina</strong>
          {subtitle ? <small>{subtitle}</small> : null}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link className={`origina-logo ${className}`} href={href} aria-label="Origina">
        {content}
      </Link>
    );
  }

  return (
    <div className={`origina-logo ${className}`} aria-label="Origina">
      {content}
    </div>
  );
}
