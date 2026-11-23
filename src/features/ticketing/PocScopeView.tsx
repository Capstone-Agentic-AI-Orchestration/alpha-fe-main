import type { PocVersion } from './projectStages';
import './projectStages.css';

const day = (value: string | null) => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

/** A proof of concept as written: what will be built, on which screens, and what is not included. */
export function PocScopeView({ poc, compact = false }: Readonly<{ poc: PocVersion; compact?: boolean }>) {
  return <div className={'ps-scope' + (compact ? ' is-compact' : '')}>
    <div className="ps-scope-title">
      <h3>{poc.title}</h3>
      <span className="ps-tag">v{poc.number}{poc.publishedAt ? ' · ' + day(poc.publishedAt) : ' · Draft'}</span>
    </div>
    <p className="ps-copy">{poc.summary}</p>
    <h4>Features</h4>
    <ul className="ps-list">
      {poc.features.map((feature, index) => <li key={index}><strong>{feature.title}</strong>{feature.detail && <span> — {feature.detail}</span>}</li>)}
    </ul>
    {poc.screens.length > 0 && <>
      <h4>Screens and pages</h4>
      <p className="ps-copy">{poc.screens.join(' · ')}</p>
    </>}
    {poc.outOfScope && <>
      <h4>Not included</h4>
      <p className="ps-copy">{poc.outOfScope}</p>
    </>}
    {poc.note && <>
      <h4>Note</h4>
      <p className="ps-copy">{poc.note}</p>
    </>}
  </div>;
}

export { day as stageDay };
