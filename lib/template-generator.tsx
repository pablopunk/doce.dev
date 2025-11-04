export interface Template {
  name: string
  description: string
  files: Array<{ path: string; content: string }>
}

export const templates: Record<string, Template> = {
  landing: {
    name: "Landing Page",
    description: "A modern landing page with hero, features, and CTA sections",
    files: [
      {
        path: "app/page.tsx",
        content: `export default function Home() {
  return (
    <div className="min-h-screen">
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Brand</h1>
          <div className="flex gap-4">
            <a href="#features" className="hover:underline">Features</a>
            <a href="#pricing" className="hover:underline">Pricing</a>
            <a href="#contact" className="hover:underline">Contact</a>
          </div>
        </div>
      </nav>

      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-5xl font-bold mb-6">Build Something Amazing</h2>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          The best platform to create, deploy, and scale your next project
        </p>
        <button className="bg-primary text-primary-foreground px-8 py-3 rounded-lg text-lg font-semibold hover:opacity-90">
          Get Started
        </button>
      </section>

      <section id="features" className="bg-muted py-20">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">Features</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-background p-6 rounded-lg">
              <h4 className="text-xl font-semibold mb-2">Fast</h4>
              <p className="text-muted-foreground">Lightning-fast performance</p>
            </div>
            <div className="bg-background p-6 rounded-lg">
              <h4 className="text-xl font-semibold mb-2">Secure</h4>
              <p className="text-muted-foreground">Enterprise-grade security</p>
            </div>
            <div className="bg-background p-6 rounded-lg">
              <h4 className="text-xl font-semibold mb-2">Scalable</h4>
              <p className="text-muted-foreground">Grows with your needs</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}`,
      },
    ],
  },
  dashboard: {
    name: "Dashboard",
    description: "A clean admin dashboard with sidebar and stats",
    files: [
      {
        path: "app/page.tsx",
        content: `export default function Dashboard() {
  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r bg-muted/30">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">Dashboard</h1>
        </div>
        <nav className="p-4 space-y-2">
          <a href="#" className="block px-4 py-2 rounded hover:bg-muted">Overview</a>
          <a href="#" className="block px-4 py-2 rounded hover:bg-muted">Analytics</a>
          <a href="#" className="block px-4 py-2 rounded hover:bg-muted">Settings</a>
        </nav>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="border-b p-4">
          <h2 className="text-2xl font-bold">Overview</h2>
        </header>
        
        <div className="p-6">
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-card border rounded-lg p-6">
              <div className="text-sm text-muted-foreground mb-2">Total Users</div>
              <div className="text-3xl font-bold">1,234</div>
            </div>
            <div className="bg-card border rounded-lg p-6">
              <div className="text-sm text-muted-foreground mb-2">Revenue</div>
              <div className="text-3xl font-bold">$12,345</div>
            </div>
            <div className="bg-card border rounded-lg p-6">
              <div className="text-sm text-muted-foreground mb-2">Active</div>
              <div className="text-3xl font-bold">567</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}`,
      },
    ],
  },
  blog: {
    name: "Blog",
    description: "A simple blog layout with posts",
    files: [
      {
        path: "app/page.tsx",
        content: `export default function Blog() {
  const posts = [
    { id: 1, title: 'Getting Started', excerpt: 'Learn the basics...', date: '2024-01-15' },
    { id: 2, title: 'Advanced Tips', excerpt: 'Take it to the next level...', date: '2024-01-20' },
    { id: 3, title: 'Best Practices', excerpt: 'Follow these guidelines...', date: '2024-01-25' },
  ]

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">My Blog</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          {posts.map(post => (
            <article key={post.id} className="border-b pb-8">
              <h2 className="text-2xl font-bold mb-2">{post.title}</h2>
              <p className="text-sm text-muted-foreground mb-4">{post.date}</p>
              <p className="text-muted-foreground">{post.excerpt}</p>
              <a href="#" className="text-primary hover:underline mt-2 inline-block">
                Read more →
              </a>
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}`,
      },
    ],
  },
}

export function getTemplate(name: string): Template | null {
  return templates[name] || null
}

export function listTemplates(): Template[] {
  return Object.values(templates)
}
