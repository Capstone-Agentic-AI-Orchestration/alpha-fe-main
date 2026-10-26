type Status = 'done' | 'waiting' | 'progress';

const ITEMS: { name: string; status: Status; percent: number }[] = [
  { name: 'Homepage', status: 'done', percent: 100 },
  { name: 'Contact page', status: 'waiting', percent: 60 },
  { name: 'Brand assets', status: 'done', percent: 100 },
  { name: 'Booking flow', status: 'progress', percent: 45 },
];
const STATUS_LABEL: Record<Status, string> = { done: 'Done', waiting: 'Awaiting you', progress: 'In progress' };
const MILESTONES = ['Inquiry sent', 'Invited', 'In progress', 'Delivered'];
/** Milestones already reached in the example project. */
const REACHED = 3;
const OVERALL = ITEMS.reduce((sum, item) => sum + item.percent, 0) / ITEMS.length;
const RING = 2 * Math.PI * 19;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

type Props = {
  /** Caption in focus: 0 progress, 1 your say, 2 all in one place; -1 shows the finished state. */
  beat: number;
  /** 0–1 fill of the first beat: rows appear and their bars grow. */
  fill: number;
};

/**
 * Illustrative client project window for the "Your project" section.
 * Decorative: the captions beside it carry the meaning for assistive tech.
 */
export function ProjectWindow({ beat, fill }: Readonly<Props>) {
  const final = beat < 0;
  const progress = final ? 1 : fill;
  const ring = OVERALL * progress;
  const classes = ['cl-pw', beat === 1 && 'is-ask', (final || beat >= 2) && 'is-timeline', final && 'is-final'].filter(Boolean).join(' ');

  return <div className={classes} aria-hidden="true">
    <div className="cl-pw-head">
      <div className="cl-pw-title">
        <span className="cl-mono">Example project</span>
        <strong>Website refresh</strong>
      </div>
      <div className="cl-pw-ring">
        <svg viewBox="0 0 44 44" width="52" height="52">
          <circle cx="22" cy="22" r="19" className="cl-pw-ring-track" />
          <circle cx="22" cy="22" r="19" className="cl-pw-ring-value" strokeDasharray={RING} strokeDashoffset={RING * (1 - ring / 100)} />
        </svg>
        <span>{Math.round(ring)}%</span>
      </div>
    </div>
    <ul className="cl-pw-rows">
      {ITEMS.map(({ name, status, percent }, index) => {
        const grow = clamp((progress - index * 0.18) / 0.32);
        const focus = beat === 1 && status === 'waiting';
        return <li key={name} className={`cl-pw-row is-${status}${grow > 0 ? ' is-on' : ''}${focus ? ' is-focus' : ''}`}>
          <div className="cl-pw-row-top">
            <span className="cl-pw-name">{name}</span>
            <span className="cl-pw-chip">{STATUS_LABEL[status]}</span>
          </div>
          <span className="cl-pw-bar"><i style={{ transform: `scaleX(${(percent / 100) * grow})` }} /></span>
          {status === 'waiting' && <div className="cl-pw-msg">
            <div className="cl-pw-msg-in">
              <span className="cl-pw-avatar">M</span>
              <div>
                <span className="cl-pw-from">Maya · Project manager</span>
                <p>Could you confirm your opening hours for this page?</p>
              </div>
              <span className="cl-pw-reply">Reply</span>
            </div>
          </div>}
        </li>;
      })}
    </ul>
    <ol className="cl-pw-timeline">
      {MILESTONES.map((label, index) => <li key={label} className={index < REACHED ? 'is-done' : ''} style={{ transitionDelay: `${index * 90}ms` }}>
        <i /><span>{label}</span>
      </li>)}
    </ol>
  </div>;
}
