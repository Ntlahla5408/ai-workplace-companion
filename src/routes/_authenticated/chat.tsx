import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatLayout,
});

function ChatLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const activeId = path.startsWith("/chat/") ? path.slice("/chat/".length) : null;

  const { data: threads } = useQuery({
    queryKey: ["chat-threads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const newThread = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("chat_threads")
        .insert({ user_id: user.user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });

  const deleteThread = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_threads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      if (activeId === id) navigate({ to: "/chat" });
      toast.success("Conversation deleted");
    },
  });

  return (
    <div className="grid h-[calc(100vh-3rem)] grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="hidden flex-col border-r bg-card md:flex">
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="text-sm font-semibold">Conversations</h2>
          <Button
            size="sm"
            onClick={() => newThread.mutate()}
            disabled={newThread.isPending}
          >
            <Plus className="mr-1 h-4 w-4" />
            New
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {threads?.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                No conversations yet. Start a new one.
              </p>
            )}
            {threads?.map((t) => (
              <div
                key={t.id}
                className={`group mb-1 flex items-center gap-1 rounded-lg ${
                  activeId === t.id ? "bg-primary/10" : "hover:bg-muted"
                }`}
              >
                <Link
                  to="/chat/$threadId"
                  params={{ threadId: t.id }}
                  className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2"
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => deleteThread.mutate(t.id)}
                  className="mr-1 rounded p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  aria-label="Delete conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>
      <main className="min-w-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
