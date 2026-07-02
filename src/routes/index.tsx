import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Activity, ArrowRight, Calendar, Brain, MessageCircle, ShieldCheck, FileText, LineChart } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AtivaMente — Plataforma de gestão para clínicas de saúde mental" },
      { name: "description", content: "Prontuário digital, agenda inteligente, financeiro e IA para clínicas multidisciplinares. Ciência, conexão e transformação." },
      { property: "og:title", content: "AtivaMente — Gestão inteligente para sua clínica" },
      { property: "og:description", content: "Prontuário por IA, agenda com confirmação por WhatsApp, financeiro completo e agendamento online pelo paciente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Brain, label: "Prontuário por IA" },
  { icon: FileText, label: "PDF + Word automático" },
  { icon: Calendar, label: "Agenda inteligente" },
  { icon: MessageCircle, label: "WhatsApp integrado" },
  { icon: LineChart, label: "Financeiro com IA" },
  { icon: ShieldCheck, label: "LGPD + CFP 06/2019" },
];

function Landing() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-hero)" }}>
      {/* Nav */}
      <header className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-white border shadow-sm grid place-items-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <span className="font-serif italic text-xl text-gradient-brand">AtivaMente</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost" size="sm">Entrar</Button>
          </Link>
          <Link to="/login">
            <Button size="sm" className="btn-gold btn-gold-hover rounded-full px-5">
              Começar grátis <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-12 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-white/60 backdrop-blur px-4 py-1.5 text-xs text-muted-foreground mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          Ciência · Conexão · Transformação
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-primary leading-[1.05]">
          Inteligência que cuida.
          <br />
          <span className="font-serif italic text-gradient-brand">Tecnologia que transforma.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Prontuário digital com IA, agenda com confirmação por WhatsApp, financeiro completo e
          agendamento online pelo paciente — tudo em uma plataforma feita para clínicas multidisciplinares.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/login">
            <Button size="lg" className="btn-gold btn-gold-hover rounded-full px-8 h-12 text-base">
              Testar grátis <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link to="/agendar">
            <Button size="lg" variant="outline" className="rounded-full px-8 h-12 text-base">
              Ver agendamento online
            </Button>
          </Link>
        </div>
      </section>

      {/* Ticker de recursos */}
      <section className="border-y bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-6 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm">
          {features.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-primary/80">
              <Icon className="w-4 h-4 text-accent" />
              <span className="font-medium">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-6 py-10 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} AtivaMente · Feito com cuidado para profissionais de saúde mental.
      </footer>
    </div>
  );
}
