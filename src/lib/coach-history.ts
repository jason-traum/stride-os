'use server';

import { db } from '@/lib/db';
import { coachInteractions } from '@/lib/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';

export interface CoachInteraction {
  id: string;
  userMessage: string;
  coachResponse: string;
  context?: {
    workoutId?: string;
    readinessScore?: number;
    phase?: string;
    [key: string]: any;
  };
  createdAt: string;
  tags: string[];
}

export interface GroupedInteractions {
  date: string;
  interactions: CoachInteraction[];
}

/**
 * Get recent coach interactions grouped by date
 */
export async function getCoachHistory(limit: number = 30): Promise<GroupedInteractions[]> {
  try {
    const profileId = await getActiveProfileId();
    if (!profileId) return [];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const interactions = await db
      .select({
        id: coachInteractions.id,
        userMessage: coachInteractions.userMessage,
        coachResponse: coachInteractions.coachResponse,
        context: coachInteractions.context,
        createdAt: coachInteractions.createdAt,
      })
      .from(coachInteractions)
      .where(
        and(
          eq(coachInteractions.profileId, profileId),
          gte(coachInteractions.createdAt, thirtyDaysAgo.toISOString())
        )
      )
      .orderBy(desc(coachInteractions.createdAt))
      .limit(limit);

    // Process and tag interactions
    const processedInteractions = interactions.map(interaction => {
      const tags = extractTags(interaction.userMessage, interaction.coachResponse);

      return {
        ...interaction,
        context: interaction.context as CoachInteraction['context'],
        tags,
      };
    });

    // Group by date
    const grouped = new Map<string, CoachInteraction[]>();

    processedInteractions.forEach(interaction => {
      const date = new Date(interaction.createdAt).toISOString().split('T')[0];

      if (!grouped.has(date)) {
        grouped.set(date, []);
      }

      grouped.get(date)!.push(interaction);
    });

    // Convert to array and sort
    return Array.from(grouped.entries())
      .map(([date, interactions]) => ({ date, interactions }))
      .sort((a, b) => b.date.localeCompare(a.date));

  } catch (error) {
    console.error('Error fetching coach history:', error);
    return [];
  }
}

/**
 * Search coach history by keyword
 */
export async function searchCoachHistory(query: string): Promise<CoachInteraction[]> {
  try {
    const profileId = await getActiveProfileId();
    if (!profileId) return [];

    const interactions = await db
      .select({
        id: coachInteractions.id,
        userMessage: coachInteractions.userMessage,
        coachResponse: coachInteractions.coachResponse,
        context: coachInteractions.context,
        createdAt: coachInteractions.createdAt,
      })
      .from(coachInteractions)
      .where(eq(coachInteractions.profileId, profileId))
      .orderBy(desc(coachInteractions.createdAt));

    // Filter by search query
    const searchLower = query.toLowerCase();
    const filtered = interactions.filter(interaction =>
      interaction.userMessage.toLowerCase().includes(searchLower) ||
      interaction.coachResponse.toLowerCase().includes(searchLower)
    );

    // Add tags and return
    return filtered.map(interaction => ({
      ...interaction,
      context: interaction.context as CoachInteraction['context'],
      tags: extractTags(interaction.userMessage, interaction.coachResponse),
    }));

  } catch (error) {
    console.error('Error searching coach history:', error);
    return [];
  }
}

/**
 * Extract tags from interaction content
 */
function extractTags(userMessage: string, coachResponse: string): string[] {
  const tags = new Set<string>();
  const content = `${userMessage} ${coachResponse}`.toLowerCase();

  // Topic tags
  if (content.includes('workout') || content.includes('training')) tags.add('training');
  if (content.includes('pace') || content.includes('speed')) tags.add('pacing');
  if (content.includes('injury') || content.includes('pain')) tags.add('injury');
  if (content.includes('race') || content.includes('marathon') || content.includes('5k')) tags.add('racing');
  if (content.includes('recovery') || content.includes('rest')) tags.add('recovery');
  if (content.includes('nutrition') || content.includes('fuel') || content.includes('hydration')) tags.add('nutrition');
  if (content.includes('shoe') || content.includes('gear')) tags.add('gear');
  if (content.includes('weather') || content.includes('temperature')) tags.add('conditions');
  if (content.includes('motivation') || content.includes('mental')) tags.add('mental');

  // Question type tags
  if (userMessage.includes('?')) {
    if (userMessage.includes('should i') || userMessage.includes('can i')) tags.add('advice');
    if (userMessage.includes('what') || userMessage.includes('how')) tags.add('how-to');
    if (userMessage.includes('why')) tags.add('explanation');
  }

  return Array.from(tags);
}

/**
 * Get interaction stats for the user
 */
export async function getCoachStats(): Promise<{
  totalInteractions: number;
  topTopics: { topic: string; count: number }[];
  averagePerWeek: number;
  mostActiveTime: string;
} | null> {
  try {
    const profileId = await getActiveProfileId();
    if (!profileId) return null;

    const interactions = await db
      .select({
        createdAt: coachInteractions.createdAt,
        userMessage: coachInteractions.userMessage,
        coachResponse: coachInteractions.coachResponse,
      })
      .from(coachInteractions)
      .where(eq(coachInteractions.profileId, profileId));

    if (interactions.length === 0) return null;

    // Calculate total
    const totalInteractions = interactions.length;

    // Calculate topics
    const topicCounts = new Map<string, number>();
    interactions.forEach(interaction => {
      const tags = extractTags(interaction.userMessage, interaction.coachResponse);
      tags.forEach(tag => {
        topicCounts.set(tag, (topicCounts.get(tag) || 0) + 1);
      });
    });

    const topTopics = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => ({ topic, count }));

    // Calculate average per week
    const oldestDate = new Date(Math.min(...interactions.map(i => new Date(i.createdAt).getTime())));
    const weeksActive = Math.max(1, Math.floor((Date.now() - oldestDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    const averagePerWeek = Math.round(totalInteractions / weeksActive * 10) / 10;

    // Find most active time of day
    const hourCounts = new Array(24).fill(0);
    interactions.forEach(interaction => {
      const hour = new Date(interaction.createdAt).getHours();
      hourCounts[hour]++;
    });

    const mostActiveHour = hourCounts.indexOf(Math.max(...hourCounts));
    const mostActiveTime = mostActiveHour < 12
      ? `${mostActiveHour === 0 ? 12 : mostActiveHour} AM`
      : `${mostActiveHour === 12 ? 12 : mostActiveHour - 12} PM`;

    return {
      totalInteractions,
      topTopics,
      averagePerWeek,
      mostActiveTime,
    };

  } catch (error) {
    console.error('Error calculating coach stats:', error);
    return null;
  }
}