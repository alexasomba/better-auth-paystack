import { cn } from "@/lib/utils";

export interface OperationMessage {
  tone: "success" | "error" | "info";
  text: string;
}

export function ActionMessageBanner({ message }: { message: OperationMessage | null }) {
  if (message === null) return null;

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-xs",
        message.tone === "error" && "border-red-200 bg-red-50 text-red-700",
        message.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        message.tone === "info" && "border-blue-200 bg-blue-50 text-blue-700",
      )}
    >
      {message.text}
    </div>
  );
}
