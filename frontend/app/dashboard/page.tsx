"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { User, ScheduledEmail, SentEmail, Sender } from "@/types";
import { Header } from "@/components/Header";
import { EmailListItem } from "@/components/EmailListItem";
import { EmptyState } from "@/components/EmptyState";
import { Spinner } from "@/components/Spinner";
import { ComposeModal } from "@/components/ComposeModal";

type Tab = "scheduled" | "sent";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sender, setSender] = useState<Sender | null>(null);
  const [tab, setTab] = useState<Tab>("scheduled");
  const [scheduled, setScheduled] = useState<ScheduledEmail[] | null>(null);
  const [sent, setSent] = useState<SentEmail[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);

  const loadLists = useCallback(async () => {
    const [s, se] = await Promise.all([api.getScheduled(), api.getSent()]);
    setScheduled(s);
    setSent(se);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.me();
        setUser(me);

        let senders = await api.getSenders(me.id);
        if (senders.length === 0) {
          const created = await api.createSender(me.id);
          senders = [created];
        }
        setSender(senders[0]);

        await loadLists();
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router, loadLists]);

  // Light polling so Scheduled -> Sent transitions show up without a
  // manual refresh (good enough for a dashboard; swap for websockets/SSE
  // if you want it fully real-time later).
  useEffect(() => {
    const interval = setInterval(loadLists, 8000);
    return () => clearInterval(interval);
  }, [loadLists]);

  async function handleLogout() {
    await api.logout();
    router.push("/login");
  }

  if (loading || !user) return <Spinner />;

  const list = tab === "scheduled" ? scheduled : sent;

  return (
    <div className="h-screen flex flex-col">
      <Header user={user} onLogout={handleLogout} />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 bg-panel text-white flex flex-col border-r border-panelBorder">
          <div className="p-4">
            <button
              onClick={() => setShowCompose(true)}
              className="w-full bg-accent hover:bg-accentDark text-white text-sm font-medium rounded-full py-2"
            >
              Compose
            </button>
          </div>

          <div className="px-4 space-y-1 mb-2">
            <TabButton
              label="Scheduled"
              count={scheduled?.length ?? 0}
              active={tab === "scheduled"}
              onClick={() => setTab("scheduled")}
            />
            <TabButton
              label="Sent"
              count={sent?.length ?? 0}
              active={tab === "sent"}
              onClick={() => setTab("sent")}
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {list === null ? (
              <Spinner />
            ) : list.length === 0 ? (
              <div className="text-gray-500 text-sm text-center mt-10">
                {tab === "scheduled" ? "No scheduled emails yet." : "No sent emails yet."}
              </div>
            ) : (
              list.map((item) =>
                tab === "scheduled" ? (
                  <EmailListItem
                    key={item.id}
                    to={(item as ScheduledEmail).email}
                    subject={item.subject}
                    time={(item as ScheduledEmail).scheduledTime}
                    status={item.status}
                  />
                ) : (
                  <EmailListItem
                    key={item.id}
                    to={(item as SentEmail).email}
                    subject={item.subject}
                    time={(item as SentEmail).sentTime}
                    status={item.status}
                  />
                )
              )
            )}
          </div>
        </div>

        {/* Main pane */}
        <div className="flex-1 bg-gray-50 flex items-center justify-center">
          {list && list.length === 0 ? (
            <EmptyState
              title={tab === "scheduled" ? "Nothing scheduled" : "Nothing sent yet"}
              subtitle="Compose a new email to get started."
            />
          ) : (
            <div className="text-gray-400 text-sm">Select an email to preview it here.</div>
          )}
        </div>
      </div>

      {showCompose && sender && (
        <ComposeModal
          sender={sender}
          onClose={() => setShowCompose(false)}
          onScheduled={loadLists}
        />
      )}
    </div>
  );
}

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
        active ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200"
      }`}
    >
      <span>{label}</span>
      <span className="text-xs text-gray-500">{count}</span>
    </button>
  );
}