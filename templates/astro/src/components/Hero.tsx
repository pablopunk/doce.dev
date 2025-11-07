export function Hero() {
  return (
    <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-24 text-center">
      <span className="rounded-full border border-white/20 px-4 py-1 text-sm uppercase tracking-wide text-white/70">
        Astro + React + Tailwind
      </span>
      <h1 className="text-balance text-4xl font-bold leading-tight text-white md:text-6xl">
        Build blazing-fast sites with islands of interactivity
      </h1>
      <p className="text-balance text-white/70 md:text-lg">
        Combine Astro's content-first architecture with React components when you need client-side interactivity. Tailwind
        keeps styling consistent and fast.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <a
          href="https://docs.astro.build"
          className="rounded-lg bg-white px-6 py-3 font-medium text-slate-900 transition hover:bg-slate-200"
          target="_blank"
          rel="noreferrer"
        >
          Read the docs
        </a>
        <a
          href="https://astro.build/themes"
          className="rounded-lg border border-white/30 px-6 py-3 font-medium text-white transition hover:border-white"
          target="_blank"
          rel="noreferrer"
        >
          Explore themes
        </a>
      </div>
    </section>
  );
}
