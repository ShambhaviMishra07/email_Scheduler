import clsx from "clsx";

const STYLES: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700",
  RESCHEDULED: "bg-amber-50 text-amber-700",
  PROCESSING: "bg-purple-50 text-purple-700",
  sent: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "px-2 py-0.5 rounded-full text-xs font-medium capitalize",
        STYLES[status] ?? "bg-gray-100 text-gray-600"
      )}
    >
      {status.toLowerCase()}
    </span>
  );
}