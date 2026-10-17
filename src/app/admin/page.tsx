import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";
import { loadSnapshot } from "@/lib/db";
import { SESSION_COOKIE, verifyToken } from "@/lib/session";
import { StoreProvider } from "@/lib/store";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-on-surface-variant text-body-sm">Loading JomSnap Admin…</div>}>
      <AuthedDashboard />
    </Suspense>
  );
}

async function AuthedDashboard() {
  // The proxy already redirects signed-out visitors; this re-checks on the server.
  // connection() marks this as request-time, since token expiry compares against the clock.
  await connection();
  const session = verifyToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  const initial = await loadSnapshot();
  return (
    <StoreProvider user={session.user} initial={initial}>
      <Dashboard user={session.user} />
    </StoreProvider>
  );
}
