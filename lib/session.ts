import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function currentUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

export function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

const DEFAULTS = {
  dailyGoal: 40,
  studyOrder: "smart",
  sentenceFirst: false,
  showRoots: true,
  keyboardHints: true,
  speech: false,
  sound: true,
  activeDeckId: null as string | null,
};

export async function settingsFor(userId: string) {
  const row = await prisma.userSettings.findUnique({ where: { userId } });
  return row ?? { userId, ...DEFAULTS };
}
