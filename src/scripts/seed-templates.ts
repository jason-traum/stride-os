/**
 * Seed Workout Templates
 *
 * Run with: npx tsx src/scripts/seed-templates.ts
 */

import { db } from '../lib/db';
import { workoutTemplates } from '../lib/schema';
import { ALL_WORKOUT_TEMPLATES } from '../lib/training/workout-templates';

async function seedWorkoutTemplates() {
  console.log('Seeding workout templates...');

  for (const template of ALL_WORKOUT_TEMPLATES) {
    await db.insert(workoutTemplates).values({
      id: template.id,
      name: template.name,
      category: template.category,
      phaseAppropriate: JSON.stringify(template.phaseAppropriate),
      description: template.description,
      structure: JSON.stringify(template.structure),
      targetEffortMin: template.targetEffortMin,
      targetEffortMax: template.targetEffortMax,
      typicalDistanceMilesMin: template.typicalDistanceMilesMin,
      typicalDistanceMilesMax: template.typicalDistanceMilesMax,
      purpose: template.purpose,
      progressionNotes: template.progressionNotes,
      isKeyWorkout: template.isKeyWorkout,
      intensityLevel: template.intensityLevel,
      isCustom: false,
      createdAt: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: workoutTemplates.id,
      set: {
        name: template.name,
        category: template.category,
        phaseAppropriate: JSON.stringify(template.phaseAppropriate),
        description: template.description,
        structure: JSON.stringify(template.structure),
        targetEffortMin: template.targetEffortMin,
        targetEffortMax: template.targetEffortMax,
        typicalDistanceMilesMin: template.typicalDistanceMilesMin,
        typicalDistanceMilesMax: template.typicalDistanceMilesMax,
        purpose: template.purpose,
        progressionNotes: template.progressionNotes,
        isKeyWorkout: template.isKeyWorkout,
        intensityLevel: template.intensityLevel,
      },
    });

    console.log(`  ✓ ${template.name}`);
  }

  console.log(`\nSeeded ${ALL_WORKOUT_TEMPLATES.length} workout templates.`);
}

seedWorkoutTemplates()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error seeding templates:', err);
    process.exit(1);
  });
