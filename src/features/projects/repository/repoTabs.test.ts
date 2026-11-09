import { describe, expect, it } from 'vitest';
import { isRepoTab, REPO_TABS, tabForKey } from './repoTabs';

describe('moving between repository tabs by keyboard', () => {
  it('steps with the arrows and wraps at both ends', () => {
    expect(tabForKey('overview', 'ArrowRight')).toBe('code');
    expect(tabForKey('environment', 'ArrowRight')).toBe('overview');
    expect(tabForKey('overview', 'ArrowLeft')).toBe('environment');
  });

  it('jumps to the ends with Home and End, and leaves every other key alone', () => {
    expect(tabForKey('logs', 'Home')).toBe('overview');
    expect(tabForKey('code', 'End')).toBe('environment');
    expect(tabForKey('code', 'Enter')).toBeNull();
    expect(tabForKey('code', 'Tab')).toBeNull();
  });
});

describe('project sections', () => {
  it('recognizes supported sections and rejects retired or unknown tab values', () => {
    expect(REPO_TABS.every(tab => isRepoTab(tab.id))).toBe(true);
    expect(isRepoTab('settings')).toBe(false);
    expect(isRepoTab('hosting')).toBe(false);
    expect(isRepoTab(null)).toBe(false);
  });
});
