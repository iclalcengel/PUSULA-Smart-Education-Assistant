import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fixTurkishText } from "@/lib/fixTurkishText";
import { cn } from "@/lib/utils";

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
};

const typeTone = (type: string) => {
  if (type === "reward") return "text-secondary";
  if (type === "success") return "text-primary";
  if (type === "milestone") return "text-violet-500";
  return "text-foreground";
};

export const NotificationBell = ({ userId }: { userId: string }) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [busy, setBusy] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  const loadNotifications = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, title, message, type, is_read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12);

    setNotifications(data ?? []);
  };

  useEffect(() => {
    loadNotifications();
  }, [userId]);

  const markRead = async (id: string) => {
    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", userId);
  };

  const markAllRead = async () => {
    if (!unreadCount) return;

    setBusy(true);
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    setBusy(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) loadNotifications();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black leading-none text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[360px] rounded-3xl p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="font-display text-lg font-black">Bildirimler</p>
            <p className="text-xs text-muted-foreground">Okunmamış: {unreadCount}</p>
          </div>
          <Button variant="ghost" size="sm" disabled={!unreadCount || busy} onClick={markAllRead} className="rounded-full">
            <CheckCheck className="mr-1 h-4 w-4" /> Tümünü okundu yap
          </Button>
        </div>

        <ScrollArea className="max-h-[420px]">
          <div className="space-y-2 p-3">
            {notifications.length === 0 ? (
              <div className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
                Henüz bildirimin yok.
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => !item.is_read && markRead(item.id)}
                  className={cn(
                    "w-full rounded-2xl border p-3 text-left transition-all",
                    item.is_read ? "border-border bg-card opacity-85" : "border-primary/25 bg-primary/5 shadow-soft"
                  )}
                >
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <p className={cn("font-bold", typeTone(item.type))}>{fixTurkishText(item.title)}</p>
                    {!item.is_read && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                        Yeni
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{fixTurkishText(item.message)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("tr-TR")}</p>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
