import { describe, expect, it } from 'vitest';
import { deliveryActionFor } from './OrchestrationDeliveryPanel';
import type { OrchestrationDelivery } from '@/shared/types/delivery';

const delivery = (stage: string, extra = {}) => ({ stage, repairAttempts: 0, ...extra }) as OrchestrationDelivery;
describe('delivery approval controls', () => {
  it('requires control rights for every release action', () => {
    for (const stage of ['dev_approval', 'uat_prepare', 'uat_approval', 'repair_required']) {
      expect(deliveryActionFor(delivery(stage), false, true)).toBeNull();
    }
  });
  it('offers automatic UAT delivery to a developer without PM permission', () => {
    expect(deliveryActionFor(delivery('dev_approval'), true, false)?.action).toBe('enable_uat');
    expect(deliveryActionFor(delivery('uat_prepare'), true, false)?.action).toBe('enable_uat');
    expect(deliveryActionFor(delivery('uat_approval'), true, false)?.action).toBe('enable_uat');
  });
  it('offers no action when blocked, superseded or already ready', () => {
    for (const stage of ['uat_ready', 'blocked', 'superseded']) {
      expect(deliveryActionFor(delivery(stage), true, true)).toBeNull();
    }
  });
  it('lets enabled delivery proceed without another approval and exposes resume when paused', () => {
    expect(deliveryActionFor(delivery('uat_approval', { authorization: { paused: false } }), true, false)).toBeNull();
    expect(deliveryActionFor(delivery('uat_approval', { authorization: { paused: true } }), true, false)?.action).toBe('resume_delivery');
  });
  it('prevents repeated or unbounded repair proposals', () => {
    expect(deliveryActionFor(delivery('repair_required'), true, false)?.action).toBe('prepare_repair');
    expect(deliveryActionFor(delivery('repair_required', { repairAttempts: 2 }), true, true)).toBeNull();
    expect(deliveryActionFor(delivery('repair_required', { repairRunId: 'repair' }), true, true)).toBeNull();
  });
});
