import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generateEmail } from "@/lib/ai.functions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Sparkles, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/email")({
  component: EmailPage,
});

const PRESETS = [
  { tone: "professional", context: "Follow up with a client who hasn't responded to last week's proposal" },
  { tone: "friendly", context: "Welcome a new teammate to the design team and invite them to coffee" },
  { tone: "concise", context: "Reschedule tomorrow's product review to Thursday at 2pm" },
  { tone: "apologetic", context: "Apologize to a customer for a delayed shipment and offer 15% off next order" },
] as const;

function EmailPage() {
  const qc = useQueryClient();
  const generate = useServerFn(generateEmail);
  const [recipient, setRecipient] = useState("");
  const [tone, setTone] = useState<"professional" | "friendly" | "concise" | "persuasive" | "apologetic">(
    "professional",
  );
  const [context, setContext] = useState("");
  const [result, setResult] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState<"subject" | "body" | null>(null);

  const { data: history = [] } = useQuery({
    queryKey: ["emails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emails")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: () => generate({ data: { recipient, tone, context, save: true } }),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["emails"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Generation failed"),
  });

  async function copy(field: "subject" | "body", text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div>
      <PageHeader
        icon={<Mail className="h-5 w-5" />}
        title="Smart Email Generator"
        description="Describe what you want to say — get a polished draft in seconds."
      />
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_1fr]">
        <Card className="rounded-2xl p-6">
          <h2 className="text-base font-semibold">Compose</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Fill in the basics and the assistant will write the rest.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="r">Recipient (optional)</Label>
              <Input
                id="r"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="e.g. Sarah Chen, Head of Marketing"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="concise">Concise</SelectItem>
                  <SelectItem value="persuasive">Persuasive</SelectItem>
                  <SelectItem value="apologetic">Apologetic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="c">What do you want to say?</Label>
              <Textarea
                id="c"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g. Decline a vendor meeting next Tuesday and suggest revisiting in Q4."
                rows={5}
                className="mt-1.5 resize-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.context}
                  type="button"
                  onClick={() => {
                    setTone(p.tone);
                    setContext(p.context);
                  }}
                  className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                >
                  {p.context.slice(0, 40)}…
                </button>
              ))}
            </div>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || context.length < 5}
              className="w-full"
            >
              {mutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Generate email
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Draft</h2>
              {result && (
                <span className="text-xs text-muted-foreground">Saved to history</span>
              )}
            </div>
            {!result ? (
              <div className="mt-6 grid place-items-center rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
                Your generated email will appear here.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Subject
                    </Label>
                    <button
                      onClick={() => copy("subject", result.subject)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {copied === "subject" ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      Copy
                    </button>
                  </div>
                  <p className="mt-1 rounded-lg bg-muted/60 px-3 py-2 text-sm font-medium">
                    {result.subject}
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Body
                    </Label>
                    <button
                      onClick={() => copy("body", result.body)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {copied === "body" ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      Copy
                    </button>
                  </div>
                  <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/60 px-3 py-3 text-sm font-sans leading-relaxed">
                    {result.body}
                  </pre>
                </div>
              </div>
            )}
          </Card>

          {history.length > 0 && (
            <Card className="rounded-2xl p-6">
              <h2 className="text-base font-semibold">Recent drafts</h2>
              <ul className="mt-3 divide-y">
                {history.map((e) => (
                  <li key={e.id} className="py-3">
                    <button
                      type="button"
                      onClick={() => setResult({ subject: e.subject, body: e.body })}
                      className="block w-full text-left"
                    >
                      <p className="truncate text-sm font-medium">{e.subject}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {e.tone} · {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
