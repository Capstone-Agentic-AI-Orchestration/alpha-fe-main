import type { ReactNode } from 'react';

interface ProjectSettingsSectionProps {
  id: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function ProjectSettingsSection({ id, title, description, action, children }: ProjectSettingsSectionProps) {
  return (
    <section aria-labelledby={id} className="grid min-w-0 gap-4 py-6 xl:grid-cols-[14rem_minmax(0,1fr)] xl:gap-8">
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2 self-start xl:flex-col">
        <div className="min-w-0">
          <h2 id={id} className="text-base font-semibold tracking-tight text-content">{title}</h2>
          {description && <p className="mt-1.5 text-xs leading-relaxed text-content-muted">{description}</p>}
        </div>
        {action}
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
