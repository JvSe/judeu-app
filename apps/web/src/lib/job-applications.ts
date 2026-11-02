import { randomUUID } from "node:crypto";

import type { JobApplicationStatus } from "@judeu/db";

import { displayName } from "./catalog";
import { supabase } from "./db";
import { notifyUser } from "./notifications";

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
  const { data: posting } = await supabase
    .from("jobposting")
    .select("*, provider:providerprofile(*, user:user!inner(fullName))")
    .eq("id", jobPostingId)
    .maybeSingle();
  if (!posting) return { error: "Vaga não encontrada ou indisponível", status: 404 };
  const provider = posting.provider as unknown as {
    userId: string;
    status: string;
    isCompany: boolean;
    responsibleName: string | null;
    companyName: string | null;
    user: { fullName: string };
  };
  if (posting.status !== "OPEN" || provider.status !== "APPROVED") {
    return { error: "Vaga não encontrada ou indisponível", status: 404 };
  }
  if (provider.userId === userId) {
    return { error: "Você não pode se candidatar à própria vaga", status: 403 };
  }

  const { data: application, error } = await supabase
    .from("jobapplication")
    .insert({
      id: randomUUID(),
      jobPostingId,
      applicantId: userId,
      message: input.message?.trim() || null,
    })
    .select("*")
    .single();

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { error: "Você já se candidatou a esta vaga", status: 409 };
    }
    throw new Error(error.message);
  }

  void notifyUser(provider.userId, "JOB", {
    title: posting.title,
    body: "Você recebeu uma nova candidatura",
    data: { type: "job", jobId: jobPostingId, role: "provider" },
  });

  return {
    id: application.id,
    status: application.status,
    message: application.message,
    createdAt: application.createdAt,
    respondedAt: null,
    jobPosting: {
      id: posting.id,
      title: posting.title,
      companyName: displayName(provider),
      status: posting.status,
    },
  };
}

export async function listApplicationsForJob(
  userId: string,
  jobPostingId: string,
): Promise<ApplicationDTO[] | { error: string; status: number }> {
  const { data: posting } = await supabase
    .from("jobposting")
    .select("*, provider:providerprofile(userId)")
    .eq("id", jobPostingId)
    .maybeSingle();
  if (!posting) return { error: "Vaga não encontrada", status: 404 };
  const provider = posting.provider as unknown as { userId: string };
  if (provider.userId !== userId) return { error: "Você não é o dono desta vaga", status: 403 };

  const { data: rows } = await supabase
    .from("jobapplication")
    .select("*, applicant:user!inner(id, fullName)")
    .eq("jobPostingId", jobPostingId)
    .order("createdAt", { ascending: false });

  return (rows ?? []).map((a) => {
    const applicant = a.applicant as unknown as { id: string; fullName: string };
    return {
      id: a.id,
      status: a.status,
      message: a.message,
      createdAt: a.createdAt,
      respondedAt: a.respondedAt,
      applicant: { id: applicant.id, name: applicant.fullName },
    };
  });
}

export async function listMyApplications(userId: string): Promise<MyApplicationDTO[]> {
  const { data: rows } = await supabase
    .from("jobapplication")
    .select(
      `
      *,
      jobPosting:jobposting(*, provider:providerprofile(*, user:user!inner(fullName)))
    `,
    )
    .eq("applicantId", userId)
    .order("createdAt", { ascending: false });

  return (rows ?? []).map((a) => {
    const job = a.jobPosting as unknown as {
      id: string;
      title: string;
      status: string;
      provider: {
        isCompany: boolean;
        responsibleName: string | null;
        companyName: string | null;
        user: { fullName: string };
      };
    };
    return {
      id: a.id,
      status: a.status,
      message: a.message,
      createdAt: a.createdAt,
      respondedAt: a.respondedAt,
      jobPosting: {
        id: job.id,
        title: job.title,
        companyName: displayName(job.provider),
        status: job.status,
      },
    };
  });
}

export async function respondToApplication(
  userId: string,
  jobPostingId: string,
  applicationId: string,
  action: "accept" | "reject",
): Promise<ApplicationDTO | { error: string; status: number }> {
  const { data: application } = await supabase
    .from("jobapplication")
    .select(
      `
      *,
      applicant:user!inner(id, fullName),
      jobPosting:jobposting(*, provider:providerprofile(userId))
    `,
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (!application || application.jobPostingId !== jobPostingId) {
    return { error: "Candidatura não encontrada", status: 404 };
  }
  const job = application.jobPosting as unknown as {
    title: string;
    provider: { userId: string };
  };
  if (job.provider.userId !== userId) {
    return { error: "Você não é o dono desta vaga", status: 403 };
  }
  if (application.status !== "PENDING") {
    return { error: "Esta candidatura já foi respondida", status: 409 };
  }

  const status: JobApplicationStatus = action === "accept" ? "ACCEPTED" : "REJECTED";
  const { data: updated, error } = await supabase
    .from("jobapplication")
    .update({ status, respondedAt: new Date().toISOString() })
    .eq("id", applicationId)
    .select("*")
    .single();
  if (error || !updated) throw new Error(error?.message ?? "Falha");

  void notifyUser(application.applicantId, "JOB", {
    title: job.title,
    body: action === "accept" ? "Sua candidatura foi aceita!" : "Sua candidatura foi recusada",
    data: { type: "job", jobId: jobPostingId, role: "candidate" },
  });

  const applicant = application.applicant as unknown as { id: string; fullName: string };
  return {
    id: updated.id,
    status: updated.status,
    message: updated.message,
    createdAt: updated.createdAt,
    respondedAt: updated.respondedAt,
    applicant: { id: applicant.id, name: applicant.fullName },
  };
}
