"use client";

import { useActionState, useEffect, useState } from "react";
import { login, type LoginState } from "../../actions";
import { Icon, inputClass } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);
  // A full page load (not a client-side navigation) so no page cached for another account is reused
  useEffect(() => {
    if (state.ok) window.location.replace("/admin");
  }, [state.ok]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-label-md font-semibold text-on-surface-variant">Username</span>
        <input name="username" required autoComplete="username" autoCapitalize="none" defaultValue={state.username} className={inputClass} autoFocus />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-label-md font-semibold text-on-surface-variant">Password</span>
        <span className="relative">
          <input name="password" required type={show ? "text" : "password"} autoComplete="current-password" className={`${inputClass} pr-10`} />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-outline hover:text-on-surface"
            aria-label={show ? "Hide password" : "Show password"}
          >
            <Icon name={show ? "visibility_off" : "visibility"} className="text-lg" />
          </button>
        </span>
      </label>

      {state.error && (
        <p role="alert" className="flex items-center gap-1.5 text-body-sm text-error">
          <Icon name="error" className="text-base" />
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || state.ok}
        className="mt-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-body-md font-semibold disabled:opacity-60"
      >
        <Icon name={pending || state.ok ? "progress_activity" : "login"} className={`text-lg ${pending || state.ok ? "animate-spin" : ""}`} />
        {pending || state.ok ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
