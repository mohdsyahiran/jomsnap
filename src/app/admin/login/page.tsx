import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in · JomSnap Admin" };

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F5E0C0]/60 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <Image src="/logo.png" alt="JomSnap" width={180} height={150} priority className="h-24 w-auto object-contain" />
          <h1 className="mt-3 text-headline-md font-bold text-primary">JomSnap Admin</h1>
          <p className="text-body-sm text-on-surface-variant">Bookings, payments &amp; money in/out</p>
        </div>
        <div className="rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 p-6">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-label-md text-on-surface-variant">JomSnap (KT0620473-X) · Staff only</p>
      </div>
    </main>
  );
}
