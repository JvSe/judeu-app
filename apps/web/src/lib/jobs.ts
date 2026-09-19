import type { JobApplicationStatus, JobContractType, JobStatus, Prisma, WeekDay } from "@judeu/db";

import { displayName } from "./catalog";
import { prisma } from "./db";

// ---------------------------------------------------------------------------
// Vagas de emprego: empresas (ProviderProfile.isCompany=true) publicam vagas
// com escala de trabalho; qualquer usuário autenticado pode se candidatar
// (ver job-applications.ts).
// ---------------------------------------------------------------------------

export type JobShiftDTO = { weekday: WeekDay; startTime: string; endTime: string };

const jobPostingInclude = {
  category: { select: { id: true, name: true } },
  provider: { include: { user: { select: { fullName: true } } } },
  shifts: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
  _count: { select: { applications: true } },
} satisfies Prisma.JobPostingInclude;

type JobPostingRow = Prisma.JobPostingGetPayload<{ include: typeof jobPostingInclude }>;

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

function toDTO(
  j: JobPostingRow,
  myApplication: JobPostingDTO["myApplication"] = null,
): JobPostingDTO {
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
    shifts: j.shifts.map((s) => ({ weekday: s.weekday, startTime: s.startTime, endTime: s.endTime })),
    applicantCount: j._count.applications,
    myApplication,
    createdAt: j.createdAt.toISOString(),
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
  const provider = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!provider) return { error: "Cadastro de prestador não encontrado", status: 404 };
  if (!provider.isCompany) return { error: "Só empresas podem publicar vagas", status: 403 };
  if (provider.status !== "APPROVED") {
    return { error: "Seu cadastro ainda não foi aprovado", status: 403 };
  }

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) return { error: "Categoria inválida", status: 400 };

  const [posting] = await prisma.$transaction([
    prisma.jobPosting.create({
      data: {
        providerId: provider.id,
        categoryId: input.categoryId,
        title: input.title,
        description: input.description,
        contractType: input.contractType,
        salaryCents: input.salaryCents ?? null,
        shifts: { create: input.shifts },
      },
      include: jobPostingInclude,
    }),
    prisma.providerProfile.update({ where: { id: provider.id }, data: { hiringEmployees: true } }),
  ]);

  return toDTO(posting);
}

export type JobFilters = { categoryId?: string; contractType?: JobContractType; q?: string };

export async function listOpenJobs(filters: JobFilters): Promise<JobPostingDTO[]> {
  const q = filters.q?.trim();
  const rows = await prisma.jobPosting.findMany({
    where: {
      status: "OPEN",
      provider: { status: "APPROVED" },
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.contractType ? { contractType: filters.contractType } : {}),
      ...(q && q.length >= 2
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: jobPostingInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => toDTO(r));
}

export async function getJob(id: string, userId?: string): Promise<JobPostingDTO | null> {
  const row = await prisma.jobPosting.findUnique({ where: { id }, include: jobPostingInclude });
  if (!row) return null;

  let myApplication: JobPostingDTO["myApplication"] = null;
  if (userId) {
    const app = await prisma.jobApplication.findUnique({
      where: { jobPostingId_applicantId: { jobPostingId: id, applicantId: userId } },
      select: { id: true, status: true },
    });
    if (app) myApplication = app;
  }
  return toDTO(row, myApplication);
}

export async function listMyJobPostings(userId: string): Promise<JobPostingDTO[]> {
  const provider = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!provider) return [];
  const rows = await prisma.jobPosting.findMany({
    where: { providerId: provider.id },
    include: jobPostingInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => toDTO(r));
}

export async function getMyJobPosting(
  id: string,
  userId: string,
): Promise<JobPostingDTO | { error: string; status: number }> {
  const row = await prisma.jobPosting.findUnique({ where: { id }, include: jobPostingInclude });
  if (!row) return { error: "Vaga não encontrada", status: 404 };
  if (row.provider.userId !== userId) return { error: "Você não é o dono desta vaga", status: 403 };
  return toDTO(row);
}

export async function setJobPostingStatus(
  id: string,
  userId: string,
  status: JobStatus,
): Promise<JobPostingDTO | { error: string; status: number }> {
  const existing = await prisma.jobPosting.findUnique({
    where: { id },
    include: { provider: { select: { id: true, userId: true } } },
  });
  if (!existing) return { error: "Vaga não encontrada", status: 404 };
  if (existing.provider.userId !== userId) return { error: "Você não é o dono desta vaga", status: 403 };

  const updated = await prisma.jobPosting.update({
    where: { id },
    data: { status },
    include: jobPostingInclude,
  });

  const openCount = await prisma.jobPosting.count({
    where: { providerId: existing.provider.id, status: "OPEN" },
  });
  await prisma.providerProfile.update({
    where: { id: existing.provider.id },
    data: { hiringEmployees: openCount > 0 },
  });

  return toDTO(updated);
}
