"use client";

import { useState } from "react";
import { Select, Switch } from "@/components/pouf/controls";
import { ErrorNote } from "@/components/pouf/feedback";
import { Field } from "@/components/pouf/Input";
import { Row, Stack } from "@/components/pouf/layout";
import { Segmented } from "@/components/pouf/Segmented";
import { Card } from "@/components/pouf/surface";
import { Heading, Text } from "@/components/pouf/text";

const GOALS = [20, 40, 60, 100] as const;
const ORDERS = ["smart", "inorder", "shuffle"] as const;
type Order = (typeof ORDERS)[number];

const ORDER_LABEL: Record<Order, string> = {
  smart: "Smart",
  inorder: "In order",
  shuffle: "Shuffle",
};

export type Settings = {
  dailyGoal: number;
  studyOrder: string;
  sentenceFirst: boolean;
  showRoots: boolean;
  keyboardHints: boolean;
  speech: boolean;
  sound: boolean;
  activeDeckId: string | null;
};

const TOGGLES = [
  { key: "sound", label: "Sound", hint: "Short cues when you grade a word." },
  { key: "sentenceFirst", label: "Sentence first", hint: "Show the blanked sentence on the front." },
  { key: "showRoots", label: "Show roots", hint: "Include the word's root on the back." },
  { key: "keyboardHints", label: "Keyboard hints", hint: "Show the shortcut row while studying." },
  { key: "speech", label: "Speech", hint: "Read words aloud. Not wired up yet." },
] as const;

export function SettingsForm({
  initial,
  decks,
}: {
  initial: Settings;
  decks: { id: string; title: string }[];
}) {
  const [settings, setSettings] = useState(initial);
  const [error, setError] = useState(false);

  // Optimistic: paint the change, then PATCH. On failure roll back to the value
  // we actually had, not to `initial` — several fields may have changed since.
  async function save(patch: Partial<Settings>) {
    const previous = settings;
    setSettings({ ...settings, ...patch });
    setError(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setSettings(previous);
      setError(true);
    }
  }

  return (
    <Stack gap={5}>
      <Heading level={1}>Settings</Heading>

      {error && <ErrorNote>Couldn&apos;t save that change.</ErrorNote>}

      <Card variant="tight">
        <Stack gap={5}>
          <Field label="Daily goal" hint="Words offered per session.">
            {(id) => (
              <div id={id}>
                <Segmented
                  label="Daily goal"
                  value={String(settings.dailyGoal)}
                  onChange={(v) => void save({ dailyGoal: Number(v) })}
                  options={GOALS.map((g) => ({ value: String(g), label: String(g) }))}
                />
              </div>
            )}
          </Field>

          <Field label="Study order" hint="Smart puts the shakiest words first.">
            {(id) => (
              <div id={id}>
                <Segmented
                  label="Study order"
                  value={(ORDERS as readonly string[]).includes(settings.studyOrder)
                    ? (settings.studyOrder as Order)
                    : "smart"}
                  onChange={(v: Order) => void save({ studyOrder: v })}
                  options={ORDERS.map((o) => ({ value: o, label: ORDER_LABEL[o] }))}
                />
              </div>
            )}
          </Field>

          <Field label="Deck" hint="Decks filter the queue. Progress stays global.">
            {(id, describedBy) => (
              <Select
                id={id}
                describedBy={describedBy}
                label="Deck"
                placeholder="All words"
                value={settings.activeDeckId ?? ""}
                onChange={(v) => void save({ activeDeckId: v || null })}
                options={[
                  { value: "", label: "All words" },
                  ...decks.map((d) => ({ value: d.id, label: d.title })),
                ]}
              />
            )}
          </Field>
        </Stack>
      </Card>

      <Card variant="tight">
        <Stack gap={4}>
          {TOGGLES.map((t) => (
            <Row key={t.key} justify="between" align="top">
              <Stack gap={1}>
                <Text>{t.label}</Text>
                <Text size="sm" muted>
                  {t.hint}
                </Text>
              </Stack>
              <Switch
                label={t.label}
                checked={settings[t.key]}
                onChange={(checked) => void save({ [t.key]: checked })}
              />
            </Row>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}
