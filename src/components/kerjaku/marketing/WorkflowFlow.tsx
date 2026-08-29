/** Lightweight, dependency-free workflow diagram used on Build Log pages. */
export function WorkflowFlow({ steps, label }: { steps: string[]; label: string }) {
  if (!steps.length) return null;
  return (
    <figure className="mt-8" aria-label={label}>
      <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-2">
            <span className="rounded-2xl glass-panel px-4 py-3 text-xs leading-tight text-foreground">
              <span className="mr-2 text-[10px] tracking-[0.24em] text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              {step}
            </span>
            {i < steps.length - 1 ? (
              <span aria-hidden="true" className="text-primary/70">
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <figcaption className="mt-3 text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  );
}
