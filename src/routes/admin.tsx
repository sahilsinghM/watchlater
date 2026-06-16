import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getAdminStats, getAdminLeads, loginAdmin } from "@/lib/admin.functions";
import { getCookie } from "@tanstack/react-start/server";
import { createHmac, timingSafeEqual } from "node:crypto";

const statsQueryOptions = queryOptions({
  queryKey: ["admin-stats"],
  queryFn: () => getAdminStats(),
  staleTime: 60_000,
});

const leadsQueryOptions = queryOptions({
  queryKey: ["admin-leads"],
  queryFn: () => getAdminLeads({ data: { limit: 100, offset: 0 } }),
  staleTime: 60_000,
});

export const Route = createFileRoute("/admin")({
  loader: async ({ context }) => {
    const secret = process.env.ADMIN_SECRET;
    const cookie = getCookie("admin_auth") ?? "";
    const expected = secret ? createHmac("sha256", secret).update("admin-session").digest("hex") : "";
    const authed =
      !!secret &&
      cookie.length === expected.length &&
      timingSafeEqual(Buffer.from(cookie), Buffer.from(expected));
    if (!authed) return { authed: false as const };
    await Promise.all([
      context.queryClient.ensureQueryData(statsQueryOptions),
      context.queryClient.ensureQueryData(leadsQueryOptions),
    ]);
    return { authed: true as const };
  },
  head: () => ({ meta: [{ title: "Admin · WatchLater" }] }),
  component: AdminRoute,
});

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl brutal-border bg-card p-5 brutal-shadow-sm">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
        {label}
      </div>
      <div className="font-display text-4xl font-extrabold">{value}</div>
    </div>
  );
}

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await loginAdmin({ data: { password } });
      window.location.reload();
    } catch {
      setError("Incorrect password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="rounded-3xl brutal-border bg-card p-8 brutal-shadow w-full max-w-sm space-y-5">
        <h1 className="font-display text-2xl font-extrabold">Admin access</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl brutal-border bg-background px-4 py-3 text-sm font-mono focus:outline-none focus:border-foreground"
            autoFocus
          />
          {error && <p className="text-destructive text-sm font-medium">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl brutal-border bg-primary text-primary-foreground font-bold py-3 brutal-shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-transform"
          >
            {loading ? "Checking…" : "Enter →"}
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminRoute() {
  const { authed } = Route.useLoaderData();
  if (!authed) return <LoginForm />;
  return <Admin />;
}

function Admin() {
  const { data: stats } = useSuspenseQuery(statsQueryOptions);
  const { data: leads } = useSuspenseQuery(leadsQueryOptions);

  const feedbackTotal = stats.feedbackSentiment.useful + stats.feedbackSentiment.notUseful;
  const usefulPct =
    feedbackTotal > 0 ? Math.round((stats.feedbackSentiment.useful / feedbackTotal) * 100) : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto max-w-5xl px-4 sm:px-6 pt-8 pb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">Admin</h1>
        <a href="/" className="font-mono text-xs text-muted-foreground hover:text-foreground">
          ← Home
        </a>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 pb-24 space-y-10">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Unique videos" value={stats.uniqueVideoCount} />
          <StatCard label="Leads collected" value={stats.leadCount} />
          <StatCard label="Quiz completions" value={stats.quizCompletionCount} />
          <StatCard label="Useful feedback" value={feedbackTotal > 0 ? `${usefulPct}%` : "—"} />
        </div>

        {stats.videosPerDay.length > 0 && (
          <section>
            <h2 className="font-display text-lg font-extrabold mb-4">
              Videos processed — last 30 days
            </h2>
            <div className="rounded-3xl brutal-border bg-card p-5 brutal-shadow-sm">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={stats.videosPerDay}
                  margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                >
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                    tickFormatter={(d: string) => d.slice(5)}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 12,
                      borderRadius: 12,
                    }}
                  />
                  <Bar dataKey="count" name="Videos" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        <section>
          <h2 className="font-display text-lg font-extrabold mb-4">
            Emails collected{" "}
            <span className="text-muted-foreground font-normal text-sm">
              ({leads.length} shown)
            </span>
          </h2>
          {leads.length === 0 ? (
            <p className="text-muted-foreground">No emails yet.</p>
          ) : (
            <div className="rounded-3xl brutal-border bg-card overflow-hidden brutal-shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-[3px] border-foreground">
                    <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Email
                    </th>
                    <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Source
                    </th>
                    <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Date
                    </th>
                    <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground hidden sm:table-cell">
                      Video
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, i) => (
                    <tr key={lead.id} className={i % 2 === 0 ? "bg-card" : "bg-background/50"}>
                      <td className="px-5 py-3 font-medium">{lead.email}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-lg bg-primary/10 text-primary px-2 py-0.5 font-mono text-[10px] uppercase font-bold">
                          {lead.source}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px] text-muted-foreground">
                        {new Date(lead.created_at).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px] text-muted-foreground hidden sm:table-cell">
                        {lead.lesson_video_id ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
