import { getActiveProfileId } from '@/lib/profile-server';
import { MemoryDashboard } from './MemoryDashboard';
import { db } from '@/lib/db';
import { coachingInsights, conversationSummaries } from '@/lib/db/coaching-memory';
import { eq, and, desc, isNull, gte, or } from 'drizzle-orm';

export default async function MemoryPage() {
  const profileId = await getActiveProfileId();

  // Fetch all active insights
  const insights = await db
    .select()
    .from(coachingInsights)
    .where(
      and(
        eq(coachingInsights.profileId, profileId),
        eq(coachingInsights.isActive, true),
        or(
          isNull(coachingInsights.expiresAt),
          gte(coachingInsights.expiresAt, new Date().toISOString())
        )
      )
    )
    .orderBy(desc(coachingInsights.confidence), desc(coachingInsights.createdAt));

  // Fetch recent conversation summaries
  const summaries = await db
    .select()
    .from(conversationSummaries)
    .where(eq(conversationSummaries.profileId, profileId))
    .orderBy(desc(conversationSummaries.conversationDate))
    .limit(10);

  // Group insights by category
  const groupedInsights = insights.reduce((acc, insight) => {
    if (!acc[insight.category]) {
      acc[insight.category] = [];
    }
    acc[insight.category].push({
      ...insight,
      metadata: insight.metadata ? JSON.parse(insight.metadata) : null,
    });
    return acc;
  }, {} as Record<string, typeof insights>);

  // Format summaries
  const formattedSummaries = summaries.map(s => ({
    ...s,
    keyDecisions: s.keyDecisions ? JSON.parse(s.keyDecisions) : [],
    keyPreferences: s.keyPreferences ? JSON.parse(s.keyPreferences) : [],
    keyFeedback: s.keyFeedback ? JSON.parse(s.keyFeedback) : [],
    tags: s.tags ? JSON.parse(s.tags) : [],
  }));

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold text-primary">Coaching Memory</h1>
        <p className="text-textSecondary mt-1">What your coach has learned about you</p>
      </div>

      <MemoryDashboard
        groupedInsights={groupedInsights}
        summaries={formattedSummaries}
        profileId={profileId}
      />
    </div>
  );
}