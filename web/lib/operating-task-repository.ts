import { TaskError, type OperatingTask } from './operating-tasks.ts';

/** Server boundary. Revisions are atomic; the future durable implementation also journals events. */
export interface TaskRepository {
  readonly kind: 'local-file' | 'supabase';
  list(): Promise<OperatingTask[]>;
  create(task: OperatingTask): Promise<OperatingTask>;
  update(input: unknown): Promise<OperatingTask>;
}

/** Prepared contract only. No client, credential lookup, RPC, or network operation exists. */
export class SupabaseTaskRepository implements TaskRepository {
  readonly kind = 'supabase';
  private unavailable(): never { throw new TaskError('Supabase task adapter is not activated; migration and approval required',503); }
  async list(): Promise<OperatingTask[]> { return this.unavailable(); }
  async create(_task: OperatingTask): Promise<OperatingTask> { return this.unavailable(); }
  async update(_input: unknown): Promise<OperatingTask> { return this.unavailable(); }
}
