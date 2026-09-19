import type { JobApplicationStatus } from "@judeu/db";

import { displayName } from "./catalog";
import { prisma } from "./db";
import { notifyUser } from "./notifications";

// ---------------------------------------------------------------------------
// Candidatura a uma vaga (jobs.ts): qualquer usuário autenticado pode se
// candidatar a uma vaga OPEN; a empresa aceita ou recusa. Uma candidatura por
// usuário por vaga (@@unique([jobPostingId, applicantId]) no schema).
// ---------------------------------------------------------------------------

export type ApplicationDTO = {
  id: string;
  status: JobApplicationStatus;
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
  applicant: { id: string; name: string };
};

export type MyApplicationDTO = {
  id: string;
  status: JobApplicationStatus;
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
  jobPosting: { id: string; title: string; companyName: string; status: string };
};

export type ApplyToJobInput = { message?: string };

export async function applyToJob(
  userId: string,
  jobPostingId: string,
  input: ApplyToJobInput,
): Promise<MyApplicationDTO | { error: string; status: number }> {
  const posting = await prisma.jobPosting.findUnique({
    where: { id: jobPostingId },
    include: { provider: { include: { user: { select: { fullName: true } } } } },
  });
  if (!posting || posting.status !== "OPEN" || posting.provider.status !== "APPROVED") {
    return { error: "Vaga não encontrada ou indisponível", status: 404 };
  }
  if (posting.provider.userId === userId) {
    return { error: "Você não pode se candidatar à própria vaga", status: 403 };
  }

  try {
    const application = await prisma.jobApplication.create({
      data: { jobPostingId, applicantId: userId, message: input.message?.trim() || null },
    });

    void notifyUser(posting.provider.userId, "JOB", {
      title: posting.title,
      body: "Você recebeu uma nova candidatura",
      data: { type: "job", jobId: jobPostingId, role: "provider" },
    });

    return {
      id: application.id,
      status: application.status,
      message: application.message,
      createdAt: application.createdAt.toISOString(),
      respondedAt: null,
      jobPosting: {
        id: posting.id,
        title: posting.title,
        companyName: displayName(posting.provider),
        status: posting.status,
      },
    };
  } catch (e) {
    // Violação da @@unique([jobPostingId, applicantId]) → já se candidatou.
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return { error: "Você já se candidatou a esta vaga", status: 409 };
    }
    throw e;
  }
}

export async function listApplicationsForJob(
  userId: string,
  jobPostingId: string,
): Promise<ApplicationDTO[] | { error: string; status: number }> {
  const posting = await prisma.jobPosting.findUnique({
    where: { id: jobPostingId },
    include: { provider: { select: { userId: true } } },
  });
  if (!posting) return { error: "Vaga não encontrada", status: 404 };
  if (posting.provider.userId !== userId) return { error: "Você não é o dono desta vaga", status: 403 };

  const rows = await prisma.jobApplication.findMany({
    where: { jobPostingId },
    include: { applicant: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((a) => ({
    id: a.id,
    status: a.status,
    message: a.message,
    createdAt: a.createdAt.toISOString(),
    respondedAt: a.respondedAt?.toISOString() ?? null,
    applicant: { id: a.applicant.id, name: a.applicant.fullName },
  }));
}

export async function listMyApplications(userId: string): Promise<MyApplicationDTO[]> {
  const rows = await prisma.jobApplication.findMany({
    where: { applicantId: userId },
    include: {
      jobPosting: { include: { provider: { include: { user: { select: { fullName: true } } } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((a) => ({
    id: a.id,
    status: a.status,
    message: a.message,
    createdAt: a.createdAt.toISOString(),
    respondedAt: a.respondedAt?.toISOString() ?? null,
    jobPosting: {
      id: a.jobPosting.id,
      title: a.jobPosting.title,
      companyName: displayName(a.jobPosting.provider),
      status: a.jobPosting.status,
    },
  }));
}

export async function respondToApplication(
  userId: string,
  jobPostingId: string,
  applicationId: string,
  action: "accept" | "reject",
): Promise<ApplicationDTO | { error: string; status: number }> {
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    include: {
      applicant: { select: { id: true, fullName: true } },
      jobPosting: { include: { provider: { select: { userId: true } } } },
    },
  });
  if (!application || application.jobPostingId !== jobPostingId) {
    return { error: "Candidatura não encontrada", status: 404 };
  }
  if (application.jobPosting.provider.userId !== userId) {
    return { error: "Você não é o dono desta vaga", status: 403 };
  }
  if (application.status !== "PENDING") {
    return { error: "Esta candidatura já foi respondida", status: 409 };
  }

  const status: JobApplicationStatus = action === "accept" ? "ACCEPTED" : "REJECTED";
  const updated = await prisma.jobApplication.update({
    where: { id: applicationId },
    data: { status, respondedAt: new Date() },
  });

  void notifyUser(application.applicantId, "JOB", {
    title: application.jobPosting.title,
    body: action === "accept" ? "Sua candidatura foi aceita!" : "Sua candidatura foi recusada",
    data: { type: "job", jobId: jobPostingId, role: "candidate" },
  });

  return {
    id: updated.id,
    status: updated.status,
    message: updated.message,
    createdAt: updated.createdAt.toISOString(),
    respondedAt: updated.respondedAt?.toISOString() ?? null,
    applicant: { id: application.applicant.id, name: application.applicant.fullName },
  };
}
