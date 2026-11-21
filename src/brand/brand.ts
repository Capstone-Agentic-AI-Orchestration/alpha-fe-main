import logoUrl from '@/assets/alphaexplora-logo.svg';
import markUrl from '@/assets/alphaexplora-mark.svg';
import wordmarkUrl from '@/assets/alphaexplora-wordmark.svg';
import metrics from './logoMetrics.json';

/**
 * The public brand in one place: its name and logo files. The logo files are
 * generated from `alphaexploraMark.json` and DM Sans by `npm run brand:logo`.
 */
export const BRAND_NAME = 'Alphaexplora';
export const BRAND_LOGO = { url: logoUrl, ...metrics.logo };
export const BRAND_MARK = { url: markUrl, ...metrics.mark };
export const BRAND_WORDMARK = { url: wordmarkUrl, ...metrics.wordmark };
/** Below this width the headers show the mark alone; the full lockup is too wide beside the header actions. */
export const BRAND_NARROW_MEDIA = '(max-width: 420px)';
