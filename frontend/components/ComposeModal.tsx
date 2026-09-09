"use client";

import { useState, useRef } from "react";
import Papa from "papaparse";
import type { Sender } from "@/types";
import { api } from "@/lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const QUICK_TIMES = [
  { label: "Tomorrow, 10:00 AM", hoursFromNow: 24 },
  { label: "Tomorrow, 11:00 AM", hoursFromNow: 25 },
  { label: "Tomorrow, 3:00 PM", hoursFromNow: 29 },
];

export function ComposeModal({
  sender,
  onClose,
  onScheduled,
}: {
  sender: Sender;
  onClose: () => void;
  onScheduled: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [rawRecipientInput, setRawRecipientInput] = useState("");
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(sender.maxPerHour);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [showSendLater, setShowSendLater] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addManualRecipient() {
    const trimmed = rawRecipientInput.trim();
    if (trimmed && EMAIL_RE.test(trimmed) && !recipients.includes(trimmed)) {
      setRecipients((r) => [...r, trimmed]);
      setRawRecipientInput("");
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<string[]>(file, {
      complete: (results) => {
        const found = new Set<string>();
        for (const row of results.data) {
          for (const cell of row) {
            const candidate = String(cell).trim();
            if (EMAIL_RE.test(candidate)) found.add(candidate);
          }
        }
        setRecipients((prev) => Array.from(new Set([...prev, ...found])));
      },
      error: () => setError("Could not parse that file — expected a CSV or plain text list."),
    });
    e.target.value = "";
  }

  async function handleSchedule() {
    setError(null);
    if (!subject.trim() || !body.trim()) return setError("Subject and body are required.");
    if (recipients.length === 0) return setError("Add at least one recipient.");
    if (!startTime) return setError("Pick a send time.");

    setSubmitting(true);
    try {
      await api.scheduleEmail({
        senderId: sender.id,
        subject,
        body,
        recipients,
        startTime: startTime.toISOString(),
        delayMs,
        hourlyLimit,
      });
      onScheduled();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-panelBorder">
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-sm">
            ← Compose New Email
          </button>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowSendLater((s) => !s)}
                className="text-sm border border-panelBorder rounded-full px-4 py-1.5 hover:bg-gray-50"
              >
                {startTime ? startTime.toLocaleString() : "Send Later"}
              </button>
              {showSendLater && (
                <SendLaterPopover
                  onPick={(d) => {
                    setStartTime(d);
                    setShowSendLater(false);
                  }}
                  onClose={() => setShowSendLater(false)}
                />
              )}
            </div>
            <button
              onClick={handleSchedule}
              disabled={submitting}
              className="bg-accent text-white text-sm font-medium rounded-full px-5 py-1.5 hover:bg-accentDark disabled:opacity-50"
            >
              {submitting ? "Scheduling…" : "Schedule"}
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          <Field label="From">
            <div className="text-sm text-gray-600 py-2">{sender.fromEmail}</div>
          </Field>

          <Field label="To">
            <div className="flex flex-wrap gap-1.5 items-center border-b border-panelBorder pb-2">
              {recipients.map((r) => (
                <span
                  key={r}
                  className="bg-gray-100 text-xs rounded-full px-2.5 py-1 flex items-center gap-1"
                >
                  {r}
                  <button
                    onClick={() => setRecipients((list) => list.filter((x) => x !== r))}
                    className="text-gray-400 hover:text-gray-700"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                value={rawRecipientInput}
                onChange={(e) => setRawRecipientInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addManualRecipient();
                  }
                }}
                placeholder="recipient@example.com"
                className="flex-1 min-w-[160px] text-sm outline-none py-1"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-accentDark font-medium whitespace-nowrap"
              >
                ↑ Upload List
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            {recipients.length > 0 && (
              <div className="text-xs text-gray-400 mt-1">
                {recipients.length} email address{recipients.length !== 1 ? "es" : ""} detected
              </div>
            )}
          </Field>

          <Field label="Subject">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full text-sm outline-none border-b border-panelBorder pb-2"
            />
          </Field>

          <div className="flex gap-6">
            <Field label="Delay between 2 emails (ms)">
              <input
                type="number"
                min={0}
                value={delayMs}
                onChange={(e) => setDelayMs(parseInt(e.target.value || "0", 10))}
                className="w-28 text-sm outline-none border-b border-panelBorder pb-2"
              />
            </Field>
            <Field label="Hourly Limit">
              <input
                type="number"
                min={1}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value || "1", 10))}
                className="w-28 text-sm outline-none border-b border-panelBorder pb-2"
              />
            </Field>
          </div>

          <Field label="">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type Your Reply..."
              rows={6}
              className="w-full text-sm outline-none resize-none"
            />
          </Field>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <label className="block text-xs text-gray-500 mb-1">{label}</label>}
      {children}
    </div>
  );
}

function SendLaterPopover({
  onPick,
  onClose,
}: {
  onPick: (date: Date) => void;
  onClose: () => void;
}) {
  const [customDate, setCustomDate] = useState("");

  return (
    <div className="absolute right-0 mt-2 w-64 bg-white border border-panelBorder rounded-xl shadow-lg p-3 z-20">
      <div className="text-xs text-gray-500 mb-2">Send Later</div>
      <input
        type="datetime-local"
        value={customDate}
        onChange={(e) => setCustomDate(e.target.value)}
        className="w-full text-sm border border-panelBorder rounded-lg px-2 py-1.5 mb-3"
      />
      <div className="text-xs text-gray-400 mb-1">Tomorrow</div>
      <div className="space-y-1 mb-3">
        {QUICK_TIMES.map((qt) => (
          <button
            key={qt.label}
            onClick={() => onPick(new Date(Date.now() + qt.hoursFromNow * 3600 * 1000))}
            className="block w-full text-left text-sm text-gray-700 hover:bg-gray-50 rounded px-2 py-1"
          >
            {qt.label}
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="text-xs text-gray-500 px-3 py-1.5">
          Cancel
        </button>
        <button
          onClick={() => customDate && onPick(new Date(customDate))}
          disabled={!customDate}
          className="text-xs bg-accent text-white rounded-full px-4 py-1.5 disabled:opacity-40"
        >
          Done
        </button>
      </div>
    </div>
  );
}