import { format } from "date-fns";
import type { EmailDetail } from "@/types";
import { StatusBadge } from "./StatusBadge";

export function EmailPreview({ detail }: { detail: EmailDetail }) {
  // lastError on a SENT row holds the Ethereal "preview: <url>" string we
  // stashed in the worker - surface it as a real link so you can show the
  // actual rendered email during the demo.
  const previewUrl = detail.lastError?.startsWith("preview: ")
    ? detail.lastError.replace("preview: ", "")
    : null;

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-xl border border-panelBorder p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{detail.subject}</h2>
        <StatusBadge status={detail.status} />
      </div>

      <div className="text-sm text-gray-500 mb-1">
        From: {detail.fromEmail}
      </div>

      <div className="text-sm text-gray-500 mb-4">
        To: {detail.email}
      </div>

      <div className="text-xs text-gray-400 mb-4">
        {detail.sentTime
          ? `Sent ${format(new Date(detail.sentTime), "PPpp")}`
          : `Scheduled for ${format(
              new Date(detail.scheduledTime),
              "PPpp"
            )}`}
      </div>

      <div
        className="prose prose-sm max-w-none border-t border-panelBorder pt-4"
        dangerouslySetInnerHTML={{ __html: detail.body }}
      />

      {previewUrl && (
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-4 text-xs text-accentDark underline"
        >
          View live Ethereal preview →
        </a>
      )}
    </div>
  );
}