"use client";

import { GOOGLE_LOGIN_URL } from "@/lib/api";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white border border-panelBorder rounded-2xl p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-center mb-6">
          Login
        </h1>

        <a
          href={GOOGLE_LOGIN_URL}
          className="flex items-center justify-center gap-2 w-full border border-panelBorder rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 mb-4"
        >
          <GoogleIcon />
          Login with Google
        </a>

        <div className="flex items-center gap-3 my-4">
          <div className="h-px bg-gray-200 flex-1" />

          <span className="text-xs text-gray-400">
            or sign up through email
          </span>

          <div className="h-px bg-gray-200 flex-1" />
        </div>

        {/* Email field - visual only */}
        <input
          type="email"
          placeholder="Email ID"
          disabled
          className="w-full border border-panelBorder rounded-lg px-3 py-2.5 text-sm mb-3 bg-gray-50 text-gray-400 cursor-not-allowed"
        />

        {/* Password field - visual only */}
        <input
          type="password"
          placeholder="Password"
          disabled
          className="w-full border border-panelBorder rounded-lg px-3 py-2.5 text-sm mb-4 bg-gray-50 text-gray-400 cursor-not-allowed"
        />

        {/* Login button - visual only */}
        <button
          disabled
          title="Use Google login above"
          className="w-full bg-accent/40 text-white rounded-lg py-2.5 text-sm font-medium cursor-not-allowed"
        >
          Login
        </button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />

      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />

      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.1 35.5 26.7 36 24 36c-5.2 0-9.6-3.1-11.3-7.6l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />

      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.2 5.2C40.9 36 44 30.6 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}