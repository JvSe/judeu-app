import type { CreateJobPostingInput, JobShift } from "@/lib/api";

// Rascunho em memória do fluxo de IA (chat -> revisão). O formulário manual
// publica direto, sem passar por aqui. Nada parcial vai ao banco — a única
// chamada de API real acontece na confirmação final.

export type JobDraftBasics = Omit<CreateJobPostingInput, "shifts">;
export type JobDraft = { basics: JobDraftBasics; shifts: JobShift[] };

let draft: JobDraft | null = null;

export function setJobDraft(input: CreateJobPostingInput): void {
  const { shifts, ...basics } = input;
  draft = { basics, shifts };
}

export function getJobDraft(): JobDraft | null {
  return draft;
}

export function clearJobDraft(): void {
  draft = null;
}

export function jobDraftToInput(d: JobDraft): CreateJobPostingInput {
  return { ...d.basics, shifts: d.shifts };
}
