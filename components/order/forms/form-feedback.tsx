import type { FieldErrors } from "react-hook-form";

export const inputClassName = "mt-2 min-h-12 w-full rounded-control border border-border-strong bg-panel px-3 text-sm text-text-primary outline-none placeholder:text-text-muted/60 disabled:cursor-not-allowed disabled:bg-disabled-background disabled:text-disabled-text focus:border-primary-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";
export const labelClassName = "block text-sm font-semibold text-text-primary";

export function FieldErrorMessage({ error, id }: { error?: { message?: unknown }; id: string }) {
  if (!error || typeof error.message !== "string") return null;
  return <p id={id} className="mt-2 text-xs text-error">{error.message}</p>;
}

function collectMessages(value: unknown, messages: string[]) {
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (typeof record.message === "string") messages.push(record.message);
  for (const [key, child] of Object.entries(record)) {
    if (key !== "message" && key !== "ref" && key !== "type") collectMessages(child, messages);
  }
}

export function FormErrorSummary({ errors, submitCount }: { errors: FieldErrors; submitCount: number }) {
  if (submitCount === 0) return null;
  const messages: string[] = [];
  collectMessages(errors, messages);
  const uniqueMessages = [...new Set(messages)];
  if (uniqueMessages.length === 0) return null;

  return (
    <div role="alert" tabIndex={-1} className="mb-6 rounded-control border border-error bg-error/5 p-4">
      <p className="text-sm font-semibold text-error">Check the highlighted project details</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-text-primary">{uniqueMessages.map((message) => <li key={message}>{message}</li>)}</ul>
    </div>
  );
}
