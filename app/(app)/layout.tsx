import { redirect } from "next/navigation";
import { AppNav } from "@/components/navigation/AppNav";
import { currentUserId } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (!(await currentUserId())) redirect("/");

  return (
    // A viewport-height column so a screen can claim the remaining space with
    // `h-full` (the study loop does) instead of guessing the chrome's height.
    // Bottom padding clears the fixed BottomNav and the iOS home indicator.
    <div className="mx-auto flex h-[100svh] w-full max-w-3xl flex-col px-(--s4) pt-(--s4) pb-(--s4) max-[900px]:pb-[calc(104px+env(safe-area-inset-bottom,0px))]">
      <div className="shrink-0">
        <AppNav />
      </div>
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
