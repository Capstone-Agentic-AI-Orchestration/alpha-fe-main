/** Alpha's repository resources currently support GitHub repositories. */
export function normalizeProjectRepositoryUrl(input: string): string {
  const candidate = input.trim();
  if (!candidate) return '';
  const url = new URL(candidate);
  const parts = url.pathname.replace(/\/$/, '').replace(/\.git$/, '').split('/').filter(Boolean);
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com' || url.username || url.password || url.port || parts.length !== 2 || parts.some(part => !/^[\w.-]+$/.test(part) || part === '.' || part === '..')) {
    throw new Error('Use a GitHub repository URL, such as https://github.com/owner/repository.');
  }
  if (url.search || url.hash) throw new Error('Paste the repository URL without query parameters or a fragment.');
  return `https://github.com/${parts.join('/')}`;
}
