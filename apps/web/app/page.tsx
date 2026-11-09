import { Button } from "@repo/ui/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <p className="text-sm font-medium tracking-wide text-muted-foreground">
        Plataforma de Experts
      </p>
      <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
        Olá, mundo
      </h1>
      <p className="max-w-prose text-base text-muted-foreground">
        A fundação está no ar: web, API, banco local e observabilidade.
      </p>
      <Button asChild variant="secondary">
        <a href="http://localhost:3333/" target="_blank" rel="noreferrer">
          Abrir a API
        </a>
      </Button>
    </main>
  );
}
