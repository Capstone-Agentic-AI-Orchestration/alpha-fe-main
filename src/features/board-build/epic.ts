/** Labels an epic: a feature card that holds a spec and is built on its own. */
export const EPIC_LABEL = 'alpha:epic';
export const isEpic = (labels: readonly string[]) => labels.includes(EPIC_LABEL);
