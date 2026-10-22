import { ProductionRuntime } from './operating-runtime.ts';

export function manualRunAvailability(flag: boolean) {
  const reasons: string[] = [];
  if(!flag) reasons.push('Ручний LIVE-аналіз вимкнений feature flag.');
  if(!new ProductionRuntime().available) reasons.push('Production runtime/provider не налаштований.');
  reasons.push('Durable run storage і failure recovery ще не активовані.');
  return {enabled:false as const,reasons};
}

/** Fail closed before collecting data or invoking a provider. Flag alone never enables execution. */
export async function requestManualRun(flag: boolean) {
  return {status:'BLOCKED' as const,...manualRunAvailability(flag)};
}
