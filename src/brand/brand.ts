import logoUrl from '@/assets/alphaexplora-logo.svg';
import fullLogoUrl from '@/assets/alphaexplora-full.png';
import markUrl from '@/assets/alphaexplora-mark.svg';
import wordmarkUrl from '@/assets/alphaexplora-wordmark.svg';
import metrics from './logoMetrics.json';

/**
 * The public brand in one place: its name and logo files. The SVG files are
 * generated from `alphaexploraMark.json` and DM Sans by `npm run brand:logo`.
 */
export const BRAND_NAME = 'Alphaexplora';
export const BRAND_FULL_LOGO = { url: fullLogoUrl, width: 1500, height: 500 };
export const BRAND_LOGO = { url: logoUrl, ...metrics.logo };
export const BRAND_MARK = { url: markUrl, ...metrics.mark };
export const BRAND_WORDMARK = { url: wordmarkUrl, ...metrics.wordmark };
