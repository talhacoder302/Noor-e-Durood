import type { NextRequest } from "next/server";
import { signup } from "@/server/accounts";
import { handleCredentials } from "@/server/auth-route";

export async function POST(request: NextRequest) {
  return handleCredentials(request, signup);
}
