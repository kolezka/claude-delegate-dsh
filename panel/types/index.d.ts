export type DshJob = {
  id: string;
  title: string;
  started: number;
  seen: number;
  label: string;
  terminal: boolean;
  stale: boolean;
};
declare module "claude-code" {
  interface PluginState {
    "dsh-tasks": { jobs: Shaped<DshJob[]> };
  }
}
