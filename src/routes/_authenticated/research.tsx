import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { runResearch } from "@/lib/ai.functions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, Loader2, ExternalLink, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/research")({
  component: ResearchPage,
});

type Source = { title: string; url: string; note: string };
type ResearchRow = {
  id: string;
  query: string;
  summary: string | null;
  key_points: string[];
  sources: Source[];
  created_at: string;
};

const SUGGESTIONS = [
  "Best practices for async standups in distributed teams",
  "EU AI Act compliance basics for B2B SaaS",
  "Comparison of OKRs vs SMART goals for engineering teams",
  "How to run an effective post-mortem",
];

function ResearchPage() {
  const qc = useQueryClient();
  const research = useServerFn(runResearch);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<ResearchRow | null>(null);

  const { data: history = [] } = useQuery({
    queryKey: ["research"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("research_queries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as unknown as ResearchRow[];
    },
  });

  const mutation = useMutation({
    mutationFn: (q: string) => research({ data: { query: q } }),
    onSuccess: (row) => {
      setActive(row as unknown as ResearchRow);
      qc.invalidateQueries({ queryKey: ["research"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function submit(q?: string) {
    const v = (q ?? query).trim();
    if (!v) return;
    setQuery(v);
    mutation.mutate(v);
  }

  return (
    <div>
      <PageHeader
        icon={<Search className="h-5 w-5" />}
        title="AI Research Assistant"
        description="Quick, structured briefings on any workplace topic."
      />
      <div className="p-6">
        <Card className="rounded-2xl p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What do you want to learn about?"
              className="flex-1"
            />
            <Button type="submit" disabled={mutation.isPending || !query.trim()}>
              {mutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Research
            </Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                {s}
              </button>
            ))}
          </div>
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            {!active && !mutation.isPending && (
              <Card className="grid place-items-center rounded-2xl border-dashed py-16 text-center text-sm text-muted-foreground">
                Your research briefing will appear here.
              </Card>
            )}
            {mutation.isPending && (
              <Card className="rounded-2xl p-10 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                <p className="mt-3 text-sm text-muted-foreground">Researching…</p>
              </Card>
            )}
            {active && (
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="rounded-2xl p-6">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Query</p>
                  <h2 className="mt-1 text-lg font-semibold">{active.query}</h2>
                  <p className="mt-4 text-sm leading-relaxed">{active.summary}</p>

                  {active.key_points?.length > 0 && (
                    <div className="mt-6">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <BookOpen className="h-4 w-4 text-primary" /> Key points
                      </div>
                      <ul className="mt-2 space-y-1.5">
                        {active.key_points.map((p, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            <span className="text-primary">•</span> {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {active.sources?.length > 0 && (
                    <div className="mt-6">
                      <p className="text-sm font-semibold">Sources</p>
                      <ul className="mt-3 space-y-2">
                        {active.sources.map((s, i) => (
                          <li key={i} className="rounded-lg border bg-muted/40 px-3 py-2">
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                            >
                              {s.title}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <p className="mt-0.5 text-xs text-muted-foreground">{s.note}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              </motion.div>
            )}
          </div>

          <Card className="h-fit rounded-2xl p-6">
            <h3 className="text-sm font-semibold">Recent</h3>
            {history.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">No research yet.</p>
            ) : (
              <ul className="mt-3 divide-y">
                {history.map((r) => (
                  <li key={r.id} className="py-3">
                    <button
                      type="button"
                      onClick={() => setActive(r)}
                      className="block w-full text-left"
                    >
                      <p className="line-clamp-2 text-sm font-medium">{r.query}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
