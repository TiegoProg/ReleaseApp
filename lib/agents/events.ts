import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import type { AgentEvent, AgentEventType } from "../types";

/**
 * Bus de eventos en proceso.
 * - Publica eventos a los suscriptores SSE (transporte en vivo hacia la UI).
 * - Mantiene un log por campaña para que un suscriptor tardío pueda reproducir lo ocurrido.
 *
 * Vive en globalThis para sobrevivir el HMR de `next dev`.
 */

interface Bus {
  emitter: EventEmitter;
  logs: Map<string, AgentEvent[]>;
}

const g = globalThis as unknown as { __orbitaBus?: Bus };
if (!g.__orbitaBus) {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0); // sin limite de suscriptores SSE
  g.__orbitaBus = { emitter, logs: new Map() };
}
const bus = g.__orbitaBus;

const MAX_LOG = 2000;

export function makeEvent(
  type: AgentEventType,
  fields: Partial<Omit<AgentEvent, "id" | "type" | "ts">> & { campaignId: string }
): AgentEvent {
  return {
    id: randomUUID(),
    type,
    ts: new Date().toISOString(),
    ...fields,
  };
}

export function publish(event: AgentEvent): void {
  let log = bus.logs.get(event.campaignId);
  if (!log) {
    log = [];
    bus.logs.set(event.campaignId, log);
  }
  log.push(event);
  if (log.length > MAX_LOG) log.splice(0, log.length - MAX_LOG);
  bus.emitter.emit(event.campaignId, event);
}

export function getLog(campaignId: string): AgentEvent[] {
  return bus.logs.get(campaignId) ?? [];
}

export function subscribe(
  campaignId: string,
  listener: (event: AgentEvent) => void
): () => void {
  bus.emitter.on(campaignId, listener);
  return () => bus.emitter.off(campaignId, listener);
}
