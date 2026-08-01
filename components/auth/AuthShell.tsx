import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <Link href="/" className="auth-brand" aria-label="SoriTarae 홈">
          <span className="auth-logo" aria-hidden="true">
            {[10, 18, 28, 18, 10].map((height, index) => (
              <span key={index} style={{ height }} />
            ))}
          </span>
          <strong>SoriTarae</strong>
        </Link>

        <div className="auth-heading">
          <span className="eyebrow">{eyebrow}</span>
          <h1 id="auth-title">{title}</h1>
          <p>{description}</p>
        </div>

        {children}

        <div className="auth-footer">{footer}</div>
      </section>
    </main>
  );
}
