import { describe, expect, it } from 'vitest';
import { offersComputerCopy } from './ProjectWorkspaceCard';

describe('who is offered a copy of the code on this computer', () => {
  it('offers it to people who open the code themselves', () => {
    expect(offersComputerCopy('dev')).toBe(true);
    expect(offersComputerCopy('admin')).toBe(true);
  });

  it('leaves it to the build for project managers and clients', () => {
    expect(offersComputerCopy('pm')).toBe(false);
    expect(offersComputerCopy('client')).toBe(false);
  });
});
