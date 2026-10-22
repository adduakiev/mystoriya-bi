import { type InputPacket, type Specialist, DOMAINS, validateInput, qualityGate } from './operating-core.ts';

export interface AgentRuntime {
  readonly kind: 'codex-cli' | 'replay' | 'production';
  readonly mode: 'live' | 'replay';
  readonly version: string;
  readonly available: boolean;
  invoke(agent: string, packet: InputPacket): Promise<Specialist>;
}

export function validateSpecialist(result: unknown, agent: string, ids: Set<string>): Specialist {
  const r = result as Specialist;
  if (!r || Object.keys(r).some(k => !['agent','summary','findings'].includes(k)) || r.agent !== agent ||
      typeof r.summary !== 'string' || r.summary.length > 4000 || !Array.isArray(r.findings) || r.findings.length > 40)
    throw Error('Invalid specialist result');
  const keys = new Set<string>();
  for (const f of r.findings) {
    if (!f || Object.keys(f).some(k => !['key','kind','insight','action','evidence_ids','impact_uah','impact_basis'].includes(k)) ||
        typeof f.key !== 'string' || !/^[a-zA-Z0-9_.:-]{1,200}$/.test(f.key) || keys.has(f.key) ||
        !['fact','hypothesis','blocked'].includes(f.kind) ||
        !['insight','action','impact_basis'].every(k => typeof f[k as keyof typeof f] === 'string' && String(f[k as keyof typeof f]).trim().length > 0 && String(f[k as keyof typeof f]).length <= 4000) ||
        !Array.isArray(f.evidence_ids) || f.evidence_ids.length>64 ||
        f.evidence_ids.some(id => typeof id!=='string' || id.trim().length===0 || id.length>200 || !ids.has(id)) ||
        (f.kind === 'fact' && !f.evidence_ids.length) ||
        (f.impact_uah !== null && (!Number.isFinite(f.impact_uah) || f.kind !== 'fact')))
      throw Error('Invalid specialist finding');
    keys.add(f.key);
  }
  return structuredClone(r);
}

export function assertDomainPacket(agent: string, packet: InputPacket) {
  validateInput(packet);
  if (!DOMAINS[agent] || packet.evidence.some(e => e.domain !== DOMAINS[agent])) throw Error('Runtime domain violation');
  if(qualityGate(packet).some(q=>q.status==='BLOCK'))throw Error('Runtime received blocked evidence');
}

export class ReplayRuntime implements AgentRuntime {
  readonly kind = 'replay'; readonly mode = 'replay'; readonly available = true; readonly version = 'replay-v2';
  private readonly results: Record<string, unknown>;
  constructor(results: Record<string, unknown>) { this.results = structuredClone(results); }
  async invoke(agent: string, packet: InputPacket) {
    assertDomainPacket(agent, packet);
    return validateSpecialist(this.results[agent], agent, new Set(packet.evidence.map(e => e.id)));
  }
}

/** No credentials, provider SDK or network path. Enabling an env flag cannot activate this stub. */
export class ProductionRuntime implements AgentRuntime {
  readonly kind = 'production'; readonly mode = 'live'; readonly available = false; readonly version = 'production-unconfigured-v2';
  async invoke(_agent: string, _packet: InputPacket): Promise<Specialist> { throw Error('Production provider is not configured'); }
}
