import { describe, expect, it } from 'vitest';
import { repoNameWithOwner } from './DeleteRepositoryConfirm';

describe('repoNameWithOwner', () => {
  it('reads every form a repository resource is stored in', () => {
    expect(repoNameWithOwner('https://github.com/acme/shop-be')).toBe('acme/shop-be');
    expect(repoNameWithOwner('https://github.com/acme/shop-be.git')).toBe('acme/shop-be');
    expect(repoNameWithOwner('github.com/acme/shop.fe/')).toBe('acme/shop.fe');
    expect(repoNameWithOwner('acme/shop-be')).toBe('acme/shop-be');
  });

  /** No pair, no delete control: a delete must name exactly one repository. */
  it('answers null for anything that is not one GitHub repository', () => {
    expect(repoNameWithOwner('C:/work/shop')).toBeNull();
    expect(repoNameWithOwner('https://gitlab.com/acme/shop')).toBeNull();
    expect(repoNameWithOwner('https://github.com/acme/shop/tree/main')).toBeNull();
    expect(repoNameWithOwner('shop')).toBeNull();
  });
});
