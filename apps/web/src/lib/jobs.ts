import { randomUUID } from "node:crypto";

import type { JobApplicationStatus, JobContractType, JobStatus, WeekDay } from "@judeu/db";

import { displayName } from "./catalog";
import { supabase } from "./db";

export type JobShiftDTO = { weekday: WeekDay; startTime: string; endTime: string };

const JOB_SELECT = `
  *,
  category:category(id, name),
  provider:providerprofile(*, user:user!inner(fullName)),
  shifts:jobshift(*),
  applications:jobapplication(id)
`;

type JobRow = {
  id: string;
  title: string;
  description: string;
  contractType: JobContractType;
  salaryCents: number | null;
  status: JobStatus;
  createdAt: string;
  category: { id: string; name: string };
  provider: {
    id: string;
    userId: string;
    isCompany: boolean;
    responsibleName: string | null;
    companyName: string | null;
    user: { fullName: string };
  };
  shifts: { weekday: WeekDay; startTime: string; endTime: string }[];
  applications: { id: string }[];
};

export type JobPostingDTO = {
  id: string;
  title: string;
  description: string;
  contractType: JobContractType;
  salaryCents: number | null;
  status: JobStatus;
  category: { id: string; name: string };
  providerCompany: { id: string; name: string; companyName: string | null };
  shifts: JobShiftDTO[];
  applicantCount: number;
  myApplication: { id: string; status: JobApplicationStatus } | null;
  createdAt: string;
};

function toDTO(j: JobRow, myApplication: JobPostingDTO["myApplication"] = null): JobPostingDTO {
  return {
    id: j.id,
    title: j.title,
    description: j.description,
    contractType: j.contractType,
    salaryCents: j.salaryCents,
    status: j.status,
    category: j.category,
    providerCompany: {
      id: j.provider.id,
      name: displayName(j.provider),
      companyName: j.provider.isCompany ? j.provider.companyName : null,
    },
    shifts: [...(j.shifts ?? [])]
      .sort((a, b) => a.weekday.localeCompare(b.weekday) || a.startTime.localeCompare(b.startTime))
      .map((s) => ({ weekday: s.weekday, startTime: s.startTime, endTime: s.endTime })),
    applicantCount: j.applications?.length ?? 0,
    myApplication,
    createdAt: j.createdAt,
  };
}

export type CreateJobPostingInput = {
  categoryId: string;
  title: string;
  description: string;
  contractType: JobContractType;
  salaryCents?: number;
  shifts: JobShiftDTO[];
};

export async function createJobPosting(
  userId: string,
  input: CreateJobPostingInput,
): Promise<JobPostingDTO | { error: string; status: number }> {
  const { data: provider } = await supabase
    .from("providerprofile")
    .select("*")
    .eq("userId", userId)
    .maybeSingle();
  if (!provider) return { error: "Cadastro de prestador não encontrado", status: 404 };
  if (!provider.isCompany) return { error: "Só empresas podem publicar vagas", status: 403 };
  if (provider.status !== "APPROVED") {
    return { error: "Seu cadastro ainda não foi aprovado", status: 403 };
  }

  const { data: category } = await supabase
    .from("category")
    .select("id")
    .eq("id", input.categoryId)
    .maybeSingle();
  if (!category) return { error: "Categoria inválida", status: 400 };

  const jobId = randomUUID();
  const { data: posting, error } = await supabase.rpc("create_job_with_shifts", {
    p_job: {
      id: jobId,
      providerId: provider.id,
      categoryId: input.categoryId,
      title: input.title,
      description: input.description,
      contractType: input.contractType,
      salaryCents: input.salaryCents ?? null,
      status: "OPEN",
    },
    p_shifts: input.shifts,
  });
  if (error || !posting) return { error: error?.message ?? "Falha ao criar vaga", status: 500 };

  await supabase
    .from("providerprofile")
    .update({ hiringEmployees: true, updatedAt: new Date().toISOString() })
    .eq("id", provider.id);

  const full = await getJob(posting.id);
  if (!full) return { error: "Vaga criada mas não encontrada", status: 500 };
  return full;
}

export type JobFilters = { categoryId?: string; contractType?: JobContractType; q?: string };

export async function listOpenJobs(filters: JobFilters): Promise<JobPostingDTO[]> {
  let q = supabase
    .from("jobposting")
    .select(JOB_SELECT)
    .eq("status", "OPEN")
    .eq("provider.status", "APPROVED")
    .order("createdAt", { ascending: false });

  if (filters.categoryId) q = q.eq("categoryId", filters.categoryId);
  if (filters.contractType) q = q.eq("contractType", filters.contractType);
  const term = filters.q?.trim();
  if (term && term.length >= 2) {
    q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);
  return ((rows ?? []) as unknown as JobRow[]).map((r) => toDTO(r));
}

export async function getJob(id: string, userId?: string): Promise<JobPostingDTO | null> {
  const { data: row } = await supabase.from("jobposting").select(JOB_SELECT).eq("id", id).maybeSingle();
  if (!row) return null;

  let myApplication: JobPostingDTO["myApplication"] = null;
  if (userId) {
    const { data: app } = await supabase
      .from("jobapplication")
      .select("id, status")
      .eq("jobPostingId", id)
      .eq("applicantId", userId)
      .maybeSingle();
    if (app) myApplication = app;
  }
  return toDTO(row as unknown as JobRow, myApplication);
}

export async function listMyJobPostings(userId: string): Promise<JobPostingDTO[]> {
  const { data: provider } = await supabase
    .from("providerprofile")
    .select("id")
    .eq("userId", userId)
    .maybeSingle();
  if (!provider) return [];
  const { data: rows } = await supabase
    .from("jobposting")
    .select(JOB_SELECT)
    .eq("providerId", provider.id)
    .order("createdAt", { ascending: false });
  return ((rows ?? []) as unknown as JobRow[]).map((r) => toDTO(r));
}

export async function getMyJobPosting(
  id: string,
  userId: string,
): Promise<JobPostingDTO | { error: string; status: number }> {
  const row = await getJob(id);
  if (!row) return { error: "Vaga não encontrada", status: 404 };
  const { data: posting } = await supabase
    .from("jobposting")
    .select("provider:providerprofile(userId)")
    .eq("id", id)
    .maybeSingle();
  const provider = posting?.provider as unknown as { userId: string } | null;
  if (provider?.userId !== userId) return { error: "Você não é o dono desta vaga", status: 403 };
  return row;
}

export async function setJobPostingStatus(
  id: string,
  userId: string,
  status: JobStatus,
): Promise<JobPostingDTO | { error: string; status: number }> {
  const { data: existing } = await supabase
    .from("jobposting")
    .select("*, provider:providerprofile(id, userId)")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { error: "Vaga não encontrada", status: 404 };
  const provider = existing.provider as unknown as { id: string; userId: string };
  if (provider.userId !== userId) return { error: "Você não é o dono desta vaga", status: 403 };

  await supabase
    .from("jobposting")
    .update({ status, updatedAt: new Date().toISOString() })
    .eq("id", id);

  const { count } = await supabase
    .from("jobposting")
    .select("*", { count: "exact", head: true })
    .eq("providerId", provider.id)
    .eq("status", "OPEN");
  await supabase
    .from("providerprofile")
    .update({ hiringEmployees: (count ?? 0) > 0, updatedAt: new Date().toISOString() })
    .eq("id", provider.id);

  const updated = await getJob(id);
  if (!updated) return { error: "Vaga não encontrada", status: 404 };
  return updated;
}
