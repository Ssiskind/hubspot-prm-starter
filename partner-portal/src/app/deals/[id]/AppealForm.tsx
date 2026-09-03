"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dealNoteSchema } from "@/lib/schemas";

export default function AppealForm({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parseResult = dealNoteSchema.safeParse({ note });
    if (!parseResult.success) {
      setError(parseResult.error.issues[0]?.message ?? "Note is invalid");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/deal-registrations/${dealId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseResult.data),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to send");
      }

      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="Respond to the channel manager or provide additional context..."
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
      />
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting || !note.trim()}
        className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        {submitting ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
