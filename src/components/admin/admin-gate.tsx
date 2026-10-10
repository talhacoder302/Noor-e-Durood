import type { ReactNode } from "react";
import { isAdmin } from "@/server/admin-auth";
import { LoginForm } from "./login-form";

/** Renders children only for a signed-in admin; otherwise the login form. */
export async function AdminGate({ children }: { children: ReactNode }) {
  if (!(await isAdmin())) return <LoginForm />;
  return <>{children}</>;
}
