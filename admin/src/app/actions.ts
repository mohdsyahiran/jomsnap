"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkCredentials, createToken, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";

export type LoginState = { error?: string; username?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const user = checkCredentials(username, password);

  if (!user) {
    // Slow down password guessing
    await new Promise((r) => setTimeout(r, 800));
    return { error: "Wrong username or password.", username };
  }

  (await cookies()).set(SESSION_COOKIE, createToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
