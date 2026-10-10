"use client";

import { isUuid, randomUuid } from "./uuid";

const STORAGE_KEY = "noor.deviceId";

let pending: Promise<string> | null = null;

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function write(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private mode or storage blocked: the httpOnly cookie still works.
  }
}

/**
 * Anonymous device id, kept in localStorage and in an httpOnly cookie so it
 * survives either one being cleared. On first visit (nothing in storage) the
 * server is asked whether the cookie already holds an id.
 */
export function getDeviceId(): Promise<string> {
  pending ??= (async () => {
    const stored = read();
    if (isUuid(stored)) return stored;

    let id = randomUuid();
    try {
      const res = await fetch("/api/device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: id }),
      });
      const data: unknown = await res.json();
      if (
        typeof data === "object" &&
        data !== null &&
        "deviceId" in data &&
        isUuid(data.deviceId)
      ) {
        id = data.deviceId;
      }
    } catch {
      // Offline: keep the new id; the cookie is set on the next submit.
    }
    write(id);
    return id;
  })();
  return pending;
}

/** The server decides the effective id (cookie wins); keep storage in step. */
export function rememberDeviceId(id: string) {
  if (!isUuid(id)) return;
  write(id);
  pending = Promise.resolve(id);
}
