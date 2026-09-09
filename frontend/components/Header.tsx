"use client";

import { useState } from "react";
import type { User } from "@/types";

export function Header({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex items-center justify-between border-b border-panelBorder bg-white px-6 py-3">
      <div className="font-semibold text-lg tracking-tight">ONB</div>

      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-full pr-3 pl-1 py-1 hover:bg-gray-50"
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={user.name} className="h-8 w-8 rounded-full" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-accent text-white flex items-center justify-center text-sm font-medium">
              {user.name[0]}
            </div>
          )}
          <div className="text-left leading-tight">
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-xs text-gray-500">{user.email}</div>
          </div>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-40 bg-white border border-panelBorder rounded-lg shadow-lg py-1 z-10">
            <button
              onClick={onLogout}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-50"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}