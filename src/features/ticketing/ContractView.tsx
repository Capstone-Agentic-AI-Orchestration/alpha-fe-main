import { useEffect, useRef } from 'react';
import { Printer } from 'lucide-react';
import { stageDay } from './stageDates';
import type { Contract } from './projectStages';
import './projectStages.css';

const PRINTING = 'ps-printing';

/** Prints just this contract (the browser's print dialog also saves it as a PDF). */
function usePrintContract() {
  const node = useRef<HTMLElement>(null);
  useEffect(() => () => document.body.classList.remove(PRINTING), []);
  const print = () => {
    const element = node.current;
    if (!element) return;
    element.classList.add('ps-contract-print');
    document.body.classList.add(PRINTING);
    const done = () => { element.classList.remove('ps-contract-print'); document.body.classList.remove(PRINTING); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  };
  return { node, print };
}

/** The development contract as both parties read and sign it. */
export function ContractView({ contract, printable = true }: Readonly<{ contract: Contract; printable?: boolean }>) {
  const { terms } = contract;
  const { node, print } = usePrintContract();
  const signature = (name: string | null, at: string | null, waiting: string) => name
    ? <><strong>{name}</strong><span>Signed {stageDay(at)}</span></>
    : <span className="ps-signature-waiting">{waiting}</span>;
  return <article ref={node} className="ps-contract" aria-label={`Development contract for ${terms.projectName}`}>
    <header className="ps-contract-head">
      <div>
        <h3>Development contract</h3>
        <p className="ps-note">{terms.projectName} · between Alphaexplora and {terms.clientName}
          {contract.issuedAt && <> · issued {stageDay(contract.issuedAt)}</>}</p>
      </div>
      {printable && <button type="button" className="ps-link ps-no-print" onClick={print}><Printer size={13} aria-hidden="true" /> Print or save as PDF</button>}
    </header>
    <section>
      {/* Contracts issued before the POC became a stage marker name the POC version they were drafted from. */}
      <h4>{terms.scope.pocNumber ? `Scope (approved POC v${terms.scope.pocNumber})` : 'Scope'}</h4>
      <p className="ps-copy"><strong>{terms.scope.title}.</strong>{terms.scope.summary && <> {terms.scope.summary}</>}</p>
      {terms.scope.screens && terms.scope.screens.length > 0 && <p className="ps-copy">Screens and pages: {terms.scope.screens.join(', ')}</p>}
      {terms.scope.outOfScope && <p className="ps-copy">Not included: {terms.scope.outOfScope}</p>}
    </section>
    {terms.deliverables.length > 0 && <section>
      <h4>Deliverables</h4>
      <ul className="ps-list">{terms.deliverables.map((item, index) => <li key={index}>{item}</li>)}</ul>
    </section>}
    <section>
      <h4>Terms</h4>
      <ol className="ps-clauses">
        {terms.clauses.map((clause, index) => <li key={index}><strong>{clause.title}.</strong> {clause.body}</li>)}
      </ol>
    </section>
    {terms.notes && <section><h4>Notes</h4><p className="ps-copy">{terms.notes}</p></section>}
    <footer className="ps-signatures">
      <div><span className="ps-signature-role">Client</span>{signature(contract.clientSignedName, contract.clientSignedAt, 'Not signed yet')}</div>
      <div><span className="ps-signature-role">Alphaexplora</span>{signature(contract.pmSignedName, contract.pmSignedAt, 'Not signed yet')}</div>
    </footer>
  </article>;
}
