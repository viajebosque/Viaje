type CompletionRpc = 'complete_mission' | 'complete_mission_initial_choice';
type RpcResult = {
  data: unknown;
  error: { code?: string; message: string } | null;
};

export class MissionCompletionSetupError extends Error {
  constructor() {
    super('The guided mission completion function is unavailable.');
    this.name = 'MissionCompletionSetupError';
  }
}

// La función anterior puede completar misiones que aún tienen ocho respuestas
// guardadas. No agrega respuestas ficticias a las opciones A–D sin elegir.
export async function completeMissionWithFallback(
  callRpc: (name: CompletionRpc) => Promise<RpcResult>,
  hasInitialChoice: boolean
): Promise<boolean> {
  const preferred = hasInitialChoice ? 'complete_mission_initial_choice' : 'complete_mission';
  const result = await callRpc(preferred);
  if (!result.error) return Boolean(result.data);
  if (!hasInitialChoice || result.error.code !== 'PGRST202') throw result.error;

  const legacy = await callRpc('complete_mission');
  if (legacy.error) throw legacy.error;
  if (!legacy.data) throw new MissionCompletionSetupError();
  return true;
}
