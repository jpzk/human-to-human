import type { CompatibilityScore } from "@/types/messages";

type User = {
  name: string;
  color: string;
  x: number | null;
  y: number | null;
};

export function getTotalPlayers(users: Record<string, User>): number {
  return Object.keys(users).length;
}

export function getAnsweredCount(
  questionId: string,
  answeredBy: Record<string, string[]>
): number {
  return answeredBy[questionId]?.length ?? 0;
}

export function hasUserAnsweredQuestion(
  questionId: string,
  userName: string | null,
  answeredBy: Record<string, string[]>
): boolean {
  if (!userName) return false;
  return answeredBy[questionId]?.includes(userName) ?? false;
}
