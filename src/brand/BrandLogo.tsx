import { BRAND_LOGO, BRAND_MARK, BRAND_NAME, BRAND_NARROW_MEDIA } from './brand';

const sized = (box: { width: number; height: number }, height: number) => ({ width: Math.round(box.width * height / box.height), height });

/** The header logo: mark and wordmark, or the mark alone on narrow screens. Height is set by CSS; `height` only reserves space. */
export function BrandLogo({ height }: { height: number }) {
  return <picture>
    <source media={BRAND_NARROW_MEDIA} srcSet={BRAND_MARK.url} {...sized(BRAND_MARK, height)} />
    <img src={BRAND_LOGO.url} alt={`${BRAND_NAME} home`} {...sized(BRAND_LOGO, height)} />
  </picture>;
}
