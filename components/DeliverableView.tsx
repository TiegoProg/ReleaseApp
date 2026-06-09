"use client";

// Renderiza cada tipo de entregable en lenguaje claro y marketero (no JSON).
// Exporta también deliverableToMarkdown() para descargar/copiar como .md.

import { Icon } from "./Icon";

type AnyPayload = Record<string, any> | null | undefined;

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  if (children == null || children === "" ) return null;
  return (
    <div>
      <div className="label-mono mb-1">{label}</div>
      <div className="text-[13.5px] leading-relaxed text-ink-soft">{children}</div>
    </div>
  );
}

function Chips({ items }: { items: { k?: string; v: string }[] }) {
  const real = items.filter((i) => i.v);
  if (real.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {real.map((i, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-sunken px-2.5 py-0.5 text-[11.5px] font-medium text-ink-soft"
        >
          {i.k && <span className="text-ink-mute">{i.k}:</span>}
          {i.v}
        </span>
      ))}
    </div>
  );
}

export function DeliverableView({
  type,
  title,
  payload,
}: {
  type: string;
  title: string;
  payload: AnyPayload;
}) {
  const p = payload ?? {};

  switch (type) {
    case "brief":
      return (
        <div className="space-y-4">
          <Section label="Audiencia objetivo">{p.audience}</Section>
          {Array.isArray(p.angles) && p.angles.length > 0 && (
            <Section label="Ángulos de campaña">
              <ol className="ml-4 list-decimal space-y-1 marker:text-ink-mute">
                {p.angles.map((a: string, i: number) => (
                  <li key={i}>{a}</li>
                ))}
              </ol>
            </Section>
          )}
          <Section label="Presupuesto">{p.budget}</Section>
          {Array.isArray(p.ad_references) && p.ad_references.length > 0 && (
            <Section label="Referencias de anuncios (scrapeadas)">
              <ul className="ml-1 space-y-1.5">
                {p.ad_references.map((r: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <Icon name="sparkle" size={14} className="mt-0.5 shrink-0 text-area-research" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section label="Resumen estratégico">
            <p className="whitespace-pre-wrap">{p.summary}</p>
          </Section>
        </div>
      );

    case "copy":
      return (
        <div className="space-y-4">
          <Chips items={[{ k: "Formato", v: p.format }, { k: "Ángulo", v: p.angle }]} />
          <Section label="Hook">
            <p className="rounded-xl border border-area-creative/25 bg-area-creative/[0.06] px-3 py-2 font-medium text-ink">
              {p.hook}
            </p>
          </Section>
          <Section label="Cuerpo">
            <p className="whitespace-pre-wrap">{p.body}</p>
          </Section>
          <Section label="Llamado a la acción">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-[13px] font-semibold text-white">
              {p.cta}
              <Icon name="arrow-right" size={14} />
            </span>
          </Section>
        </div>
      );

    case "script":
      return (
        <div className="space-y-4">
          <Chips
            items={[
              { k: "Tema", v: p.topic },
              { k: "Duración", v: p.duration_seconds ? `${p.duration_seconds}s` : "" },
            ]}
          />
          <Section label="Gancho (primeros segundos)">
            <p className="rounded-xl border border-area-content/25 bg-area-content/[0.06] px-3 py-2 font-medium text-ink">
              {p.hook}
            </p>
          </Section>
          <Section label="Desarrollo">
            <p className="whitespace-pre-wrap">{p.body}</p>
          </Section>
          <Section label="Cierre / CTA">{p.cta}</Section>
        </div>
      );

    case "calendar":
      return (
        <div className="space-y-2">
          {(p.items ?? []).map((it: any, i: number) => (
            <div key={i} className="flex gap-3 rounded-xl border border-line bg-surface-sunken px-3 py-2.5">
              <span className="shrink-0 rounded-md bg-ink px-2 py-0.5 text-[11px] font-semibold text-white">
                {it.day}
              </span>
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium text-ink">
                  {it.topic} <span className="text-ink-mute">· {it.format}</span>
                </div>
                {it.notes && <div className="text-[12.5px] text-ink-soft">{it.notes}</div>}
              </div>
            </div>
          ))}
        </div>
      );

    case "budget":
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-area-media/25 bg-area-media/[0.06] px-4 py-3">
            <div className="label-mono">Presupuesto total</div>
            <div className="font-display text-[24px] font-bold tracking-tighter-2 text-ink">{p.total}</div>
          </div>
          <Section label="Distribución">
            <div className="space-y-1.5">
              {(p.splits ?? []).map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2">
                  <span className="text-[13.5px] font-medium text-ink">{s.channel}</span>
                  <span className="flex items-center gap-2">
                    {s.phase && (
                      <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-mute">{s.phase}</span>
                    )}
                    <span className="font-display text-[14px] font-bold text-ink">{s.amount}</span>
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      );

    case "channel_plan":
      return (
        <div className="space-y-3">
          {(p.channels ?? []).map((c: any, i: number) => (
            <div key={i} className="rounded-2xl border border-line bg-surface-sunken p-3.5">
              <div className="mb-1.5 font-display text-[15px] font-bold tracking-tighter-2 text-ink">{c.channel}</div>
              <Section label="Objetivo">{c.objective}</Section>
              {c.testing && (
                <div className="mt-2">
                  <Section label="Estructura de testing">{c.testing}</Section>
                </div>
              )}
              {c.kpis && (
                <div className="mt-2">
                  <Section label="KPIs de corte">{c.kpis}</Section>
                </div>
              )}
            </div>
          ))}
        </div>
      );

    case "image":
    case "video":
      return (
        <div className="space-y-4">
          {p.headline && (
            <Section label="Titular del anuncio">
              <p className="font-display text-[18px] font-bold tracking-tighter-2 text-ink">“{p.headline}”</p>
            </Section>
          )}
          {p.url &&
            (type === "video" ? (
              <video src={p.url} controls className="w-full rounded-xl border border-line" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.url} alt={title} className="w-full rounded-xl border border-line" />
            ))}
          <Chips
            items={[
              { k: "Marca", v: p.brand },
              { k: "Referencia", v: p.referenceUsed ? "foto del producto" : "" },
              { k: "Motor", v: p.mode },
            ]}
          />
          {(p.rawPrompt || p.prompt) && (
            <Section label="Brief visual">
              <p className="whitespace-pre-wrap text-[12.5px] text-ink-mute">{p.rawPrompt || p.prompt}</p>
            </Section>
          )}
        </div>
      );

    default:
      return (
        <pre className="scroll-thin overflow-x-auto whitespace-pre-wrap rounded-xl border border-line bg-surface-sunken p-3 font-mono text-[12px] text-ink-soft">
          {JSON.stringify(p, null, 2)}
        </pre>
      );
  }
}

// ---- Export a Markdown ----

export function deliverableToMarkdown(type: string, title: string, payload: AnyPayload): string {
  const p = payload ?? {};
  const L: string[] = [`# ${title}`, ""];

  const add = (s: string) => L.push(s);

  switch (type) {
    case "brief":
      add(`**Audiencia:** ${p.audience ?? "—"}`);
      add("");
      add("## Ángulos de campaña");
      (p.angles ?? []).forEach((a: string, i: number) => add(`${i + 1}. ${a}`));
      add("");
      if (p.budget) add(`**Presupuesto:** ${p.budget}\n`);
      if (Array.isArray(p.ad_references) && p.ad_references.length) {
        add("## Referencias de anuncios");
        p.ad_references.forEach((r: string) => add(`- ${r}`));
        add("");
      }
      add("## Resumen estratégico");
      add(p.summary ?? "");
      break;
    case "copy":
      add(`- **Formato:** ${p.format ?? "—"}`);
      if (p.angle) add(`- **Ángulo:** ${p.angle}`);
      add("");
      add(`**Hook:** ${p.hook ?? ""}`);
      add("");
      add(`**Cuerpo:** ${p.body ?? ""}`);
      add("");
      add(`**CTA:** ${p.cta ?? ""}`);
      break;
    case "script":
      add(`- **Tema:** ${p.topic ?? "—"}`);
      if (p.duration_seconds) add(`- **Duración:** ${p.duration_seconds}s`);
      add("");
      add(`**Gancho:** ${p.hook ?? ""}`);
      add("");
      add(`**Desarrollo:** ${p.body ?? ""}`);
      add("");
      add(`**Cierre/CTA:** ${p.cta ?? ""}`);
      break;
    case "calendar":
      add("| Día | Tema | Formato | Notas |");
      add("| --- | --- | --- | --- |");
      (p.items ?? []).forEach((it: any) =>
        add(`| ${it.day ?? ""} | ${it.topic ?? ""} | ${it.format ?? ""} | ${it.notes ?? ""} |`)
      );
      break;
    case "budget":
      add(`**Total:** ${p.total ?? "—"}`);
      add("");
      add("| Canal | Monto | Fase |");
      add("| --- | --- | --- |");
      (p.splits ?? []).forEach((s: any) =>
        add(`| ${s.channel ?? ""} | ${s.amount ?? ""} | ${s.phase ?? ""} |`)
      );
      break;
    case "channel_plan":
      (p.channels ?? []).forEach((c: any) => {
        add(`## ${c.channel ?? "Canal"}`);
        if (c.objective) add(`- **Objetivo:** ${c.objective}`);
        if (c.testing) add(`- **Testing:** ${c.testing}`);
        if (c.kpis) add(`- **KPIs:** ${c.kpis}`);
        add("");
      });
      break;
    case "image":
    case "video":
      if (p.headline) add(`**Titular:** “${p.headline}”`);
      if (p.brand) add(`**Marca:** ${p.brand}`);
      if (p.url) add(`\n![${title}](${p.url})\n`);
      if (p.rawPrompt || p.prompt) {
        add("## Brief visual");
        add(p.rawPrompt || p.prompt);
      }
      break;
    default:
      add("```json");
      add(JSON.stringify(p, null, 2));
      add("```");
  }

  return L.join("\n");
}
