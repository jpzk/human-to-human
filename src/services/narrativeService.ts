import { QuestionType, type Question } from "@/types/game";

// Enhanced answer with timing metadata (matches server.ts)
export type AnswerWithMeta = {
  value: 
    | { type: "choice"; answerId: string }
    | { type: "slider"; value: number };
  timestamp: number;
  timeToAnswer: number;
  answerOrder: number;
};

export type UserAnswerData = {
  userId: string;
  name: string;
  answers: Map<string, AnswerWithMeta>;
};

export type NarrativeData = {
  totalPlayers: number;
  totalQuestions: number;
  consensus: { questionText: string; questionId: string; answer: string; matchCount: number } | null;
  divider: { questionText: string; questionId: string; variance: number } | null;
  maverick: { name: string; userId: string; outlierCount: number } | null;
  quickdraw: { name: string; userId: string; avgTime: number } | null;
  hesitation: { name: string; userId: string; question: string; questionId: string; time: number } | null;
  secretPair: { names: [string, string]; userIds: [string, string]; question: string; questionId: string; answer: string } | null;
};

/**
 * Calculate variance for slider answers
 */
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Check if a value is an outlier (>1.5 standard deviations from mean)
 */
function isOutlier(value: number, values: number[]): boolean {
  if (values.length < 2) return false;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = calculateVariance(values);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return false;
  return Math.abs(value - mean) > 1.5 * stdDev;
}

/**
 * Get answer text for a question
 */
function getAnswerText(
  question: Question,
  answerMeta: AnswerWithMeta
): string {
  if (answerMeta.value.type === "choice") {
    const answerId = answerMeta.value.answerId;
    if (question.type === QuestionType.MULTIPLE_CHOICE) {
      const answer = question.answers.find((a) => a.id === answerId);
      return answer?.text || answerId;
    }
    return answerId;
  } else {
    // Slider answer
    if (question.type === QuestionType.SLIDER) {
      const position = Math.round(answerMeta.value.value);
      const labels = question.config.labels;
      if (position >= 0 && position < labels.length) {
        return labels[position];
      }
    }
    return `Position ${answerMeta.value.value}`;
  }
}

/**
 * Aggregate narrative insights from all user answers
 */
export function aggregateNarrativeData(
  users: UserAnswerData[],
  questions: Question[]
): NarrativeData {
  const totalPlayers = users.length;
  const totalQuestions = questions.length;

  if (totalPlayers === 0 || totalQuestions === 0) {
    return {
      totalPlayers,
      totalQuestions,
      consensus: null,
      divider: null,
      maverick: null,
      quickdraw: null,
      hesitation: null,
      secretPair: null,
    };
  }

  // Find consensus (question where everyone or nearly everyone agreed)
  let consensus: NarrativeData["consensus"] = null;
  let maxMatchCount = 0;

  // Find divider (question with highest variance)
  let divider: NarrativeData["divider"] = null;
  let maxVariance = 0;

  // Track outliers per user
  const outlierCounts = new Map<string, number>();
  users.forEach((u) => outlierCounts.set(u.userId, 0));

  // Track average answer times per user
  const avgTimes = new Map<string, { total: number; count: number }>();
  users.forEach((u) => avgTimes.set(u.userId, { total: 0, count: 0 }));

  // Track longest hesitation
  let longestHesitation: { name: string; userId: string; question: string; questionId: string; time: number } | null = null;

  // Analyze each question
  for (const question of questions) {
    const questionAnswers = users
      .map((u) => {
        const answerMeta = u.answers.get(question.id);
        return answerMeta ? { user: u, answerMeta } : null;
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    if (questionAnswers.length === 0) continue;

    // For multiple choice: find most common answer
    if (question.type === QuestionType.MULTIPLE_CHOICE) {
      const answerCounts = new Map<string, number>();
      questionAnswers.forEach(({ answerMeta }) => {
        if (answerMeta.value.type === "choice") {
          const count = answerCounts.get(answerMeta.value.answerId) || 0;
          answerCounts.set(answerMeta.value.answerId, count + 1);
        }
      });

      // Find most common answer
      let maxCount = 0;
      let mostCommonAnswerId = "";
      answerCounts.forEach((count, answerId) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonAnswerId = answerId;
        }
      });

      // Check if this is a consensus (80%+ match)
      const matchPercentage = maxCount / questionAnswers.length;
      if (matchPercentage >= 0.8 && maxCount > maxMatchCount) {
        const answer = question.answers.find((a) => a.id === mostCommonAnswerId);
        consensus = {
          questionText: question.text,
          questionId: question.id,
          answer: answer?.text || mostCommonAnswerId,
          matchCount: maxCount,
        };
        maxMatchCount = maxCount;
      }

      // Track outliers (users who picked unpopular answers)
      questionAnswers.forEach(({ user, answerMeta }) => {
        if (answerMeta.value.type === "choice") {
          const answerCount = answerCounts.get(answerMeta.value.answerId) || 0;
          // If this answer was chosen by <30% of players, it's an outlier
          if (answerCount / questionAnswers.length < 0.3) {
            const count = outlierCounts.get(user.userId) || 0;
            outlierCounts.set(user.userId, count + 1);
          }
        }
      });
    }

    // For slider: calculate variance
    if (question.type === QuestionType.SLIDER) {
      const sliderValues = questionAnswers
        .map(({ answerMeta }) => {
          if (answerMeta.value.type === "slider") {
            return answerMeta.value.value;
          }
          return null;
        })
        .filter((v): v is number => v !== null);

      if (sliderValues.length > 0) {
        const variance = calculateVariance(sliderValues);
        if (variance > maxVariance) {
          divider = {
            questionText: question.text,
            questionId: question.id,
            variance,
          };
          maxVariance = variance;
        }

        // Track outliers
        questionAnswers.forEach(({ user, answerMeta }) => {
          if (answerMeta.value.type === "slider") {
            if (isOutlier(answerMeta.value.value, sliderValues)) {
              const count = outlierCounts.get(user.userId) || 0;
              outlierCounts.set(user.userId, count + 1);
            }
          }
        });
      }
    }

    // Track answer times
    questionAnswers.forEach(({ user, answerMeta }) => {
      const timeData = avgTimes.get(user.userId);
      if (timeData) {
        timeData.total += answerMeta.timeToAnswer;
        timeData.count += 1;
      }

      // Track longest hesitation
      if (!longestHesitation || answerMeta.timeToAnswer > longestHesitation.time) {
        longestHesitation = {
          name: user.name,
          userId: user.userId,
          question: question.text,
          questionId: question.id,
          time: answerMeta.timeToAnswer,
        };
      }
    });
  }

  // Find maverick (user with most outliers)
  let maverick: NarrativeData["maverick"] = null;
  let maxOutliers = 0;
  outlierCounts.forEach((count, userId) => {
    if (count > maxOutliers) {
      maxOutliers = count;
      const user = users.find((u) => u.userId === userId);
      if (user) {
        maverick = {
          name: user.name,
          userId: user.userId,
          outlierCount: count,
        };
      }
    }
  });

  // Find quickdraw (fastest average answer time)
  let quickdraw: NarrativeData["quickdraw"] = null;
  let minAvgTime = Infinity;
  avgTimes.forEach(({ total, count }, userId) => {
    if (count > 0) {
      const avgTime = total / count;
      if (avgTime < minAvgTime) {
        minAvgTime = avgTime;
        const user = users.find((u) => u.userId === userId);
        if (user) {
          quickdraw = {
            name: user.name,
            userId: user.userId,
            avgTime,
          };
        }
      }
    }
  });

  // Find secret pair (two users who uniquely matched on an unpopular answer)
  let secretPair: NarrativeData["secretPair"] = null;
  for (const question of questions) {
    const questionAnswers = users
      .map((u) => {
        const answerMeta = u.answers.get(question.id);
        return answerMeta ? { user: u, answerMeta } : null;
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    if (questionAnswers.length < 2) continue;

    // Group by answer
    const answerGroups = new Map<string, typeof questionAnswers>();
    questionAnswers.forEach(({ user, answerMeta }) => {
      const answerKey =
        answerMeta.value.type === "choice"
          ? answerMeta.value.answerId
          : `slider_${answerMeta.value.value}`;
      const group = answerGroups.get(answerKey) || [];
      group.push({ user, answerMeta });
      answerGroups.set(answerKey, group);
    });

    // Find pairs who uniquely matched (only 2 people chose this answer, and it's unpopular)
    answerGroups.forEach((group, answerKey) => {
      if (group.length === 2 && questionAnswers.length > 2) {
        // Check if this answer was chosen by <30% of players
        if (group.length / questionAnswers.length < 0.3) {
          const [user1, user2] = group;
          const answerText = getAnswerText(question, user1.answerMeta);
          secretPair = {
            names: [user1.user.name, user2.user.name] as [string, string],
            userIds: [user1.user.userId, user2.user.userId] as [string, string],
            question: question.text,
            questionId: question.id,
            answer: answerText,
          };
        }
      }
    });

    if (secretPair) break; // Found one, stop searching
  }

  // Only include hesitation if >5 seconds
  let finalHesitation: NarrativeData["hesitation"] = null;
  if (longestHesitation !== null) {
    const hesitation: { name: string; userId: string; question: string; questionId: string; time: number } = longestHesitation;
    if (hesitation.time > 5) {
      finalHesitation = hesitation;
    }
  }

  return {
    totalPlayers,
    totalQuestions,
    consensus,
    divider,
    maverick: maxOutliers > 0 ? maverick : null,
    quickdraw: minAvgTime < Infinity ? quickdraw : null,
    hesitation: finalHesitation,
    secretPair,
  };
}
