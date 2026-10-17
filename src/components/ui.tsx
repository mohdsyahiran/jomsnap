"use client";

import { useEffect } from "react";

export function Icon({ name, className = "", filled = false }: { name: string; className?: string; filled?: boolean }) {
  return (
    <span
      aria-hidden
      className={`material-symbols-outlined ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "soft" | "ghost" | "danger"; icon?: string };

export function Button({ variant = "soft", icon, className = "", children, ...rest }: BtnProps) {
  const v = {
    primary: "bg-primary hover:bg-primary-container text-on-primary shadow-sm",
    soft: "bg-surface-container-high hover:bg-surface-container-highest text-on-surface",
    ghost: "hover:bg-surface-container text-on-surface-variant hover:text-on-surface",
    danger: "bg-error-container hover:bg-error hover:text-white text-on-error-container",
  }[variant];
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-label-md font-semibold transition-all disabled:opacity-40 disabled:pointer-events-none ${v} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} className="text-base" />}
      {children}
    </button>
  );
}

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-xl bg-surface-container-lowest shadow-sm ${className}`}>{children}</section>;
}

export function Pill({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm font-semibold whitespace-nowrap ${className}`}>{children}</span>;
}

export function PanelHeader({
  icon,
  iconClass = "bg-secondary-fixed text-on-secondary-fixed",
  title,
  subtitle,
  children,
}: {
  icon: string;
  iconClass?: string;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconClass}`}>
          <Icon name={icon} className="text-xl" />
        </div>
        <div>
          <h2 className="text-headline-sm text-primary font-bold">{title}</h2>
          <p className="text-body-sm text-on-surface-variant">{subtitle}</p>
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-primary/40 backdrop-blur-sm p-0 sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-surface-container-lowest shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 bg-surface-container-lowest border-b border-outline-variant/30">
          <h3 className="text-headline-sm font-bold text-primary">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container" aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-label-md font-semibold text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant/50 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary";

export function Empty({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-on-surface-variant text-body-sm">
      <Icon name={icon} className="text-3xl text-outline" />
      {children}
    </div>
  );
}
