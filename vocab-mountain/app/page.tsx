import { Button } from "@/components/pouf/Button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-(--s5) bg-bg px-(--s5) text-center">
      <h1 className="text-4xl font-black text-ink sm:text-5xl">
        Welcome to Vocab Mountain
      </h1>
      <p className="max-w-md text-muted">
        Climb your way to a bigger vocabulary, one word at a time.
      </p>
      <Button size="lg">Get Started</Button>
    </div>
  );
}
