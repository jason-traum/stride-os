'use client';

/**
 * Demo Protection Layer
 *
 * When a demo profile is active, this layer intercepts database writes
 * and stores them in localStorage instead. Reads merge the localStorage
 * overlay with the original database data.
 */

import type { DemoOverlay, DemoEntity, DemoEntityOverlay } from './profile-context';

const DEMO_OVERLAY_PREFIX = 'stride_demo_overlay_';

type EntityType = 'workouts' | 'settings' | 'assessments' | 'shoes';
type Operation = 'create' | 'update' | 'delete';

interface DemoProtectionOptions<T> {
  profileId: number;
  isDemo: boolean;
  entityType: EntityType;
  operation: Operation;
  entityId?: number;
  data?: T;
}

/**
 * Get the demo overlay for a specific profile
 */
export function getDemoOverlay(profileId: number): DemoOverlay | null {
  if (typeof window === 'undefined') return null;

  const key = `${DEMO_OVERLAY_PREFIX}${profileId}`;
  const stored = localStorage.getItem(key);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Save the demo overlay for a specific profile
 */
export function saveDemoOverlay(profileId: number, overlay: DemoOverlay): void {
  if (typeof window === 'undefined') return;

  const key = `${DEMO_OVERLAY_PREFIX}${profileId}`;
  localStorage.setItem(key, JSON.stringify(overlay));
}

/**
 * Clear the demo overlay (reset to original data)
 */
export function clearDemoOverlay(profileId: number): void {
  if (typeof window === 'undefined') return;

  const key = `${DEMO_OVERLAY_PREFIX}${profileId}`;
  localStorage.removeItem(key);
}

/**
 * Get default empty overlay structure
 */
function getDefaultOverlay(): DemoOverlay {
  return {
    workouts: { created: [], updated: {}, deleted: [] },
    settings: {},
    assessments: { created: [], updated: {}, deleted: [] },
    shoes: { created: [], updated: {}, deleted: [] },
  };
}

/**
 * Store a create operation in the demo overlay
 */
export function storeCreateInOverlay<T extends DemoEntity>(
  profileId: number,
  entityType: EntityType,
  data: T
): T {
  const overlay = getDemoOverlay(profileId) || getDefaultOverlay();

  // Generate a temporary ID for the new entity
  const tempId = Date.now();
  const newEntity = { ...data, id: tempId, _isDemo: true } as T;

  if (entityType === 'settings') {
    overlay.settings = { ...overlay.settings, ...data };
  } else {
    const entityOverlay = overlay[entityType] as DemoEntityOverlay;
    entityOverlay.created.push(newEntity);
  }

  saveDemoOverlay(profileId, overlay);
  return newEntity;
}

/**
 * Store an update operation in the demo overlay
 */
export function storeUpdateInOverlay<T extends DemoEntity>(
  profileId: number,
  entityType: EntityType,
  entityId: number,
  data: Partial<T>
): void {
  const overlay = getDemoOverlay(profileId) || getDefaultOverlay();

  if (entityType === 'settings') {
    overlay.settings = { ...overlay.settings, ...data };
  } else {
    const entityOverlay = overlay[entityType] as DemoEntityOverlay;

    // Check if this entity was created in demo mode
    const createdIndex = entityOverlay.created.findIndex(
      (e) => e.id === entityId
    );

    if (createdIndex >= 0) {
      // Update the demo-created entity directly
      entityOverlay.created[createdIndex] = {
        ...entityOverlay.created[createdIndex],
        ...data,
      };
    } else {
      // Store as an update to a real entity
      entityOverlay.updated[entityId] = {
        ...(entityOverlay.updated[entityId] || {}),
        ...data,
      };
    }
  }

  saveDemoOverlay(profileId, overlay);
}

/**
 * Store a delete operation in the demo overlay
 */
export function storeDeleteInOverlay(
  profileId: number,
  entityType: EntityType,
  entityId: number
): void {
  if (entityType === 'settings') {
    // Can't delete settings, ignore
    return;
  }

  const overlay = getDemoOverlay(profileId) || getDefaultOverlay();
  const entityOverlay = overlay[entityType] as DemoEntityOverlay;

  // Check if this entity was created in demo mode
  const createdIndex = entityOverlay.created.findIndex(
    (e) => e.id === entityId
  );

  if (createdIndex >= 0) {
    // Remove from created array entirely
    entityOverlay.created.splice(createdIndex, 1);
    // Also remove from updated if present
    delete entityOverlay.updated[entityId];
  } else {
    // Mark real entity as deleted
    if (!entityOverlay.deleted.includes(entityId)) {
      entityOverlay.deleted.push(entityId);
    }
    // Remove from updated if present
    delete entityOverlay.updated[entityId];
  }

  saveDemoOverlay(profileId, overlay);
}

/**
 * Merge database results with demo overlay
 * Returns the merged data with demo changes applied
 */
export function mergeWithDemoOverlay<T extends DemoEntity>(
  profileId: number,
  entityType: EntityType,
  dbData: T[]
): T[] {
  const overlay = getDemoOverlay(profileId);
  if (!overlay) return dbData;

  if (entityType === 'settings') {
    // Settings is a single object, not an array
    return dbData;
  }

  const entityOverlay = overlay[entityType] as DemoEntityOverlay;

  // Filter out deleted entities
  let result = dbData.filter(item => !entityOverlay.deleted.includes(item.id!));

  // Apply updates to existing entities
  result = result.map(item => {
    const updates = entityOverlay.updated[item.id!];
    if (updates) {
      return { ...item, ...updates } as T;
    }
    return item;
  });

  // Add demo-created entities
  result = [...result, ...(entityOverlay.created as T[])];

  return result;
}

/**
 * Merge settings with demo overlay
 */
export function mergeSettingsWithOverlay<T extends object>(
  profileId: number,
  dbSettings: T | null
): T | null {
  const overlay = getDemoOverlay(profileId);
  if (!overlay || !dbSettings) return dbSettings;

  return { ...dbSettings, ...overlay.settings } as T;
}

/**
 * Check if an entity was created in demo mode
 */
export function isDemoCreated(
  profileId: number,
  entityType: EntityType,
  entityId: number
): boolean {
  const overlay = getDemoOverlay(profileId);
  if (!overlay || entityType === 'settings') return false;

  const entityOverlay = overlay[entityType] as DemoEntityOverlay;
  return entityOverlay.created.some((e) => e.id === entityId);
}

/**
 * Check if an entity is deleted in demo mode
 */
export function isDemoDeleted(
  profileId: number,
  entityType: EntityType,
  entityId: number
): boolean {
  const overlay = getDemoOverlay(profileId);
  if (!overlay || entityType === 'settings') return false;

  const entityOverlay = overlay[entityType] as DemoEntityOverlay;
  return entityOverlay.deleted.includes(entityId);
}

/**
 * Wrapper function for protecting server actions
 * For demo profiles, operations are stored in localStorage instead of DB
 */
export async function withDemoProtection<T extends DemoEntity>(
  action: () => Promise<T>,
  options: DemoProtectionOptions<T>
): Promise<T> {
  const { profileId, isDemo, entityType, operation, entityId, data } = options;

  // If not demo mode, execute the real action
  if (!isDemo) {
    return action();
  }

  // Demo mode: store in localStorage overlay
  switch (operation) {
    case 'create':
      if (data) {
        return storeCreateInOverlay(profileId, entityType, data);
      }
      return {} as T;

    case 'update':
      if (entityId !== undefined && data) {
        storeUpdateInOverlay(profileId, entityType, entityId, data);
      }
      return (data || {}) as T;

    case 'delete':
      if (entityId !== undefined) {
        storeDeleteInOverlay(profileId, entityType, entityId);
      }
      return {} as T;

    default:
      return action();
  }
}
