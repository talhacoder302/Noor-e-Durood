import { notFound } from "next/navigation";

// Sends unknown paths to the localized not-found page inside the layout.
export default function CatchAll() {
  notFound();
}
