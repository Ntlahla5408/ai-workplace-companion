import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();
  const { data: threads, isLoading } = useQuery({
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

  const createThread = useMutation({
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
    onSuccess: (t) => navigate({ to: "/chat/$threadId", params: { threadId: t.id } }),
  });

  useEffect(() => {
    if (!isLoading && threads && threads.length > 0) {
      navigate({
        to: "/chat/$threadId",
        params: { threadId: threads[0].id },
        replace: true,
      });
    }
  }, [isLoading, threads, navigate]);

  if (isLoading) return null;

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">Start a new conversation</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask the assistant to draft an email, summarize a doc, brainstorm a strategy, or anything
          else on your plate today.
        </p>
        <Button
          className="mt-6"
          onClick={() => createThread.mutate()}
          disabled={createThread.isPending}
        >
          New conversation
        </Button>
      </div>
    </div>
  );
}
