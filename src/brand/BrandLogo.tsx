import { BRAND_FULL_LOGO, BRAND_NAME } from './brand';

/** CSS sets the rendered size. The attributes reserve the logo's aspect ratio. */
export function BrandLogo({ height }: { height: number }) {
  const width = Math.round(BRAND_FULL_LOGO.width * height / BRAND_FULL_LOGO.height);
  return <img src={BRAND_FULL_LOGO.url} alt={`${BRAND_NAME} home`} width={width} height={height} />;
}
