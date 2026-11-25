// Escape sequences a build tool colours its output with. Shown raw they are
// noise (a box and "[32m" in the middle of a line). Built from the ESC char
// code so the source carries no literal control character.
const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'g');

export function stripAnsi(message: string): string {
  return message.replace(ANSI_PATTERN, '');
}
