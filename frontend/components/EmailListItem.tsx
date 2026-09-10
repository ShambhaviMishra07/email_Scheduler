import { format } from "date-fns";
import { StatusBadge } from "./StatusBadge";

export function EmailListItem({
  to,
  subject,
  time,
  status,
  active,
  onClick,
}: {
  to: string;
  subject: string;
  time: string | null;
  status: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-start justify-between px-4 py-3 border-b border-panelBorder cursor-pointer ${
        active ? "bg-white/10" : "hover:bg-white/5"
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm text-gray-200 truncate">To: {to}</div>
        <div className="text-sm text-gray-400 truncate">{subject}</div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
        <span className="text-xs text-gray-500">
          {time ? format(new Date(time), "EEE h:mm a") : "—"}
        </span>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}