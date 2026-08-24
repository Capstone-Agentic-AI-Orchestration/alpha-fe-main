import {
  Agent,
  AnalyticsData,
  ComplexityBand,
  Estimate,
  EstimateLine,
  IntakeAnswers,
  Issue,
  RateCard,
  RequirementDoc
} from '@/shared/types';

/**
 * Cost estimation engine.
 *
 * Three cost classes are computed separately and never blended, because a
 * one-time figure and a monthly figure read identically on an invoice until
 * the second month arrives:
 *
 *   build          one-time   agent tokens + human oversight hours
 *   infrastructure monthly    hosting tier implied by expected load
 *   service        monthly    third-party APIs forced by specific requirements
 *
 * Token figures are derived from the workspace's own recorded agent telemetry
 * rather than hardcoded, so the estimate improves as history accumulates.
 */

export const DEFAULT_RATE_CARD: RateCard = {
  devHourly: 130,
  pmHourly: 130,
  qaHourly: 130,
  tokenRatePerMillion: 4.8,
  contingency: 0
};

/** Agent token passes per requirement, relative to a medium requirement. */
const BAND_TOKEN_MULTIPLIER: Record<ComplexityBand, number> = {
  S: 0.5,
  M: 1,
  L: 2,
  XL: 3.5
};

/** Human oversight the workspace has historically needed, in hours. */
const BAND_HOURS: Record<ComplexityBand, { dev: number; pm: number }> = {
  S: { dev: 4, pm: 1 },
  M: { dev: 12, pm: 2.5 },
  L: { dev: 26, pm: 5 },
  XL: { dev: 48, pm: 9 }
};

/** QA time per acceptance criterion, in hours. */
const HOURS_PER_CRITERION = 0.2;

/**
 * Blended USD per million tokens across whatever model mix is actually in use.
 * Falls back to the rate card default when analytics are empty.
 */
export function blendedTokenRate(analytics: AnalyticsData): number {
  if (!analytics?.totalTokens24h || analytics.totalTokens24h <= 0) {
    return DEFAULT_RATE_CARD.tokenRatePerMillion;
  }
  return (analytics.totalCost24h / analytics.totalTokens24h) * 1_000_000;
}

/**
 * Tokens a single medium requirement consumes across a full agent pass
 * (architect plans, coder implements, reviewer checks, QA verifies), adjusted
 * for the rework implied by the squad's real first-pass success rate.
 */
export function tokensPerMediumRequirement(agents: Agent[]): number {
  const roles: Agent['role'][] = ['Architect', 'Coder', 'Reviewer', 'QA Tester'];

  const perRun = roles.map(role => {
    const agent = agents.find(a => a.role === role && !a.isArchived);
    if (!agent?.stats?.totalRuns) return 5000; // conservative default
    return (agent.stats?.tokensUsed || 0) / agent.stats.totalRuns;
  });

  const baseline = perRun.reduce((sum, t) => sum + t, 0);

  // Rework multiplier: a 94.6% first-pass rate means ~1.06 passes per requirement.
  const coder = agents.find(a => a.role === 'Coder' && !a.isArchived);
  const successRate = coder?.stats?.successRate ?? 95;
  const rework = successRate > 0 ? 100 / successRate : 1;

  return baseline * rework;
}

/** Hosting tiers keyed off expected monthly active users. */
function hostingTier(expectedUsers: number): { name: string; monthly: number; assumption: string } {
  if (expectedUsers <= 10_000) {
    return {
      name: 'Starter tier',
      monthly: 48,
      assumption: 'Under 10,000 monthly users, 50 GB storage, single region'
    };
  }
  if (expectedUsers <= 100_000) {
    return {
      name: 'Growth tier',
      monthly: 210,
      assumption: 'Under 100,000 monthly users, 250 GB storage, managed database replica'
    };
  }
  return {
    name: 'Scale tier',
    monthly: 840,
    assumption: 'Over 100,000 monthly users, multi-region, autoscaling compute'
  };
}

/**
 * Third-party services a requirement forces, matched on what the client
 * actually asked for. Each line names the requirement so the client can drop
 * the feature if the recurring bill is not worth it.
 */
const SERVICE_RULES: {
  match: RegExp;
  /** Phrases that mean the requirement explicitly does NOT need this service. */
  exclude?: RegExp;
  label: string;
  monthly: number;
  cadence: 'monthly' | 'per_transaction';
  display?: string;
  basis: string;
}[] = [
  {
    match: /payment|card|checkout|deposit|billing|subscription|invoice/i,
    label: 'Payment processing',
    monthly: 0,
    cadence: 'per_transaction',
    display: '2.9% + 30¢',
    basis: 'Charged per successful transaction, not a fixed monthly fee'
  },
  {
    match: /\bsms\b|text message|reminder|notify by phone/i,
    label: 'SMS delivery',
    monthly: 31,
    cadence: 'monthly',
    basis: 'Approx. 4,000 messages per month at published per-message rate'
  },
  {
    match: /email|newsletter|receipt|confirmation/i,
    label: 'Transactional email',
    monthly: 15,
    cadence: 'monthly',
    basis: 'Up to 50,000 emails per month'
  },
  {
    // "branch" alone is not a mapping need — a clinic has branches without a map.
    match: /\bmaps?\b|geocod|directions|where .* located|nearby|street address/i,
    label: 'Maps and geocoding',
    monthly: 40,
    cadence: 'monthly',
    basis: 'Approx. 28,000 map loads per month after free tier'
  },
  {
    // A calendar attachment on an email is not object storage.
    match: /upload|photo|scan|file storage|image librar|media librar|document librar/i,
    label: 'Object storage and CDN',
    monthly: 22,
    cadence: 'monthly',
    basis: '250 GB stored, 500 GB egress per month'
  },
  {
    match: /\blog ?in\b|sign in|sign-in|authenticat|\bsso\b|user account|identity provider/i,
    exclude: /without (a |an )?(log ?in|account|sign ?in)|no log ?in|without authenticat/i,
    label: 'Managed authentication',
    monthly: 35,
    cadence: 'monthly',
    basis: 'Up to 7,500 monthly active users'
  },
  {
    match: /\bai\b|llm|chatbot|assistant|summar|recommend/i,
    label: 'Model inference (delivered system)',
    monthly: 90,
    cadence: 'monthly',
    basis: 'Inference the built product consumes in production, separate from build cost'
  }
];

function currency(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Build-class lines: human oversight first, agent compute last and honest. */
export function estimateBuildLines(
  doc: RequirementDoc,
  agents: Agent[],
  analytics: AnalyticsData,
  rateCard: RateCard
): EstimateLine[] {
  const included = doc.functionalRequirements.filter(r => r.included);
  if (included.length === 0) return [];

  let devHours = 0;
  let pmHours = 0;
  let tokenUnits = 0;
  let criteria = 0;

  for (const req of included) {
    devHours += BAND_HOURS[req.band].dev;
    pmHours += BAND_HOURS[req.band].pm;
    tokenUnits += BAND_TOKEN_MULTIPLIER[req.band];
    criteria += req.acceptanceCriteria.length;
  }

  const qaHours = criteria * HOURS_PER_CRITERION;
  const mediumTokens = tokensPerMediumRequirement(agents);
  const totalTokens = tokenUnits * mediumTokens;
  const tokenRate = rateCard.tokenRatePerMillion || blendedTokenRate(analytics);

  const lines: EstimateLine[] = [
    {
      id: 'ln-dev',
      label: 'Engineering oversight',
      costClass: 'build',
      cadence: 'one_time',
      basis: `${Math.round(devHours)} h across ${included.length} requirement${included.length === 1 ? '' : 's'}`,
      amount: currency(devHours * rateCard.devHourly),
      confidence: 0.18
    },
    {
      id: 'ln-pm',
      label: 'Project management',
      costClass: 'build',
      cadence: 'one_time',
      basis: `${Math.round(pmHours)} h review, client communication, and approval gates`,
      amount: currency(pmHours * rateCard.pmHourly),
      confidence: 0.12
    },
    {
      id: 'ln-qa',
      label: 'QA and acceptance',
      costClass: 'build',
      cadence: 'one_time',
      basis: `${criteria} acceptance criteria to verify`,
      amount: currency(qaHours * rateCard.qaHourly),
      confidence: 0.25
    },
    {
      id: 'ln-tokens',
      label: 'Agent compute',
      costClass: 'build',
      cadence: 'one_time',
      basis: `~${Math.round(totalTokens / 1000)}k tokens at $${tokenRate.toFixed(2)} per million`,
      amount: currency((totalTokens / 1_000_000) * tokenRate),
      confidence: 0.3
    }
  ];

  if (rateCard.contingency > 0) {
    const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
    lines.push({
      id: 'ln-contingency',
      label: 'Risk contingency',
      costClass: 'build',
      cadence: 'one_time',
      basis: `${Math.round(rateCard.contingency * 100)}% applied by the project manager`,
      amount: currency(subtotal * rateCard.contingency),
      confidence: 0
    });
  }

  return lines;
}

/** Infrastructure the delivered system runs on, monthly. */
export function estimateInfraLines(answers: IntakeAnswers): EstimateLine[] {
  const tier = hostingTier(answers.expectedUsers || 0);
  return [
    {
      id: 'ln-hosting',
      label: `Hosting — ${tier.name.toLowerCase()}`,
      costClass: 'infrastructure',
      cadence: 'monthly',
      basis: tier.assumption,
      amount: tier.monthly,
      confidence: 0.35
    }
  ];
}

/** Third-party APIs the requirements force, monthly or per-transaction. */
export function estimateServiceLines(doc: RequirementDoc): EstimateLine[] {
  const lines: EstimateLine[] = [];
  const seen = new Set<string>();

  for (const req of doc.functionalRequirements) {
    if (!req.included) continue;
    const haystack = `${req.clientWording} ${req.requirement}`;

    for (const rule of SERVICE_RULES) {
      if (seen.has(rule.label) || !rule.match.test(haystack)) continue;
      // A requirement that explicitly rules the service out must not be billed for it.
      if (rule.exclude?.test(haystack)) continue;
      seen.add(rule.label);
      lines.push({
        id: `ln-svc-${seen.size}`,
        label: rule.label,
        costClass: 'service',
        cadence: rule.cadence,
        basis: rule.basis,
        amount: rule.monthly,
        confidence: 0.4,
        forcedBy: req.clientWording,
        displayOverride: rule.display
      });
    }
  }

  return lines;
}

/* ---------------------------------------------------------------------------
 * Calibration
 *
 * What in this file is measured, and what is assumed:
 *
 *   MEASURED   token rate (live analytics), tokens per requirement and the
 *              rework multiplier (recorded AgentStats). These move on their own.
 *
 *   ASSUMED    BAND_TOKEN_MULTIPLIER, BAND_HOURS, HOURS_PER_CRITERION, hosting
 *              tiers and vendor prices. These are seeded defaults. They are
 *              plausible, not evidenced, and the hours dominate the total —
 *              so until closed projects exist, the estimate is an informed
 *              guess and must present itself as one.
 *
 * Confidence therefore has to come from history rather than assertion. The
 * count below is of real closed requirements; when there are too few, the
 * bands widen and the estimate is flagged uncalibrated rather than quoting a
 * precision it has not earned.
 * ------------------------------------------------------------------------ */

/** Closed requirements needed before the bands are treated as evidenced. */
export const MIN_CALIBRATION_SAMPLE = 5;

/** Penalty applied to every confidence band while history is thin. */
const UNCALIBRATED_SPREAD = 1.6;

/**
 * Counts genuinely comparable finished work: issues closed in the same
 * complexity bands this estimate uses. Returns 0 when there is no history,
 * which is the honest answer for a new workspace.
 */
export function countComparables(closedIssues: Issue[], bands: ComplexityBand[]): number {
  if (!closedIssues?.length || !bands.length) return 0;
  const wanted = new Set(bands.map(b => `band-${b.toLowerCase()}`));
  return closedIssues.filter(
    i => i.status === 'done' && i.labels?.some(l => wanted.has(l))
  ).length;
}

/** Compose a full estimate from an approved-shape specification. */
export function buildEstimate(
  doc: RequirementDoc,
  agents: Agent[],
  analytics: AnalyticsData,
  rateCard: RateCard = DEFAULT_RATE_CARD,
  previous?: Estimate,
  closedIssues: Issue[] = []
): Estimate {
  const resolvedCard: RateCard = {
    ...rateCard,
    tokenRatePerMillion: rateCard.tokenRatePerMillion || blendedTokenRate(analytics)
  };

  const included = doc.functionalRequirements.filter(r => r.included);
  const bandsUsed = [...new Set(included.map(r => r.band))];
  const comparableSampleSize = countComparables(closedIssues, bandsUsed);
  const calibrated = comparableSampleSize >= MIN_CALIBRATION_SAMPLE;

  const rawLines = [
    ...estimateBuildLines(doc, agents, analytics, resolvedCard),
    ...estimateInfraLines(doc.answers),
    ...estimateServiceLines(doc)
  ];

  // Without comparable history the bands are assumptions, so widen them rather
  // than presenting a precision the workspace has not earned.
  const lines = calibrated
    ? rawLines
    : rawLines.map(l => ({ ...l, confidence: Math.min(l.confidence * UNCALIBRATED_SPREAD, 0.75) }));

  const buildLines = lines.filter(l => l.costClass === 'build');
  const recurringLines = lines.filter(
    l => l.costClass !== 'build' && l.cadence === 'monthly'
  );

  const buildTotal = buildLines.reduce((sum, l) => sum + l.amount, 0);
  const buildSpread = buildLines.reduce((sum, l) => sum + l.amount * l.confidence, 0);
  const monthlyTotal = recurringLines.reduce((sum, l) => sum + l.amount, 0);
  const monthlySpread = recurringLines.reduce((sum, l) => sum + l.amount * l.confidence, 0);

  return {
    id: previous?.id ?? `est-${Date.now()}`,
    identifier: previous?.identifier ?? `EST-${doc.identifier.split('-')[1] ?? '1000'}`,
    docId: doc.id,
    revision: (previous?.revision ?? 0) + 1,
    status: 'draft',
    lines,
    rateCard: resolvedCard,
    buildTotal: currency(buildTotal),
    buildLow: currency(buildTotal - buildSpread),
    buildHigh: currency(buildTotal + buildSpread),
    monthlyTotal: currency(monthlyTotal),
    monthlyLow: currency(monthlyTotal - monthlySpread),
    monthlyHigh: currency(monthlyTotal + monthlySpread),
    comparableSampleSize,
    calibrated,
    createdAt: new Date().toISOString()
  };
}

/** Format a figure for client-facing display. Never a bare number. */
export function formatMoney(amount: number, opts: { cents?: boolean } = {}): string {
  const showCents = opts.cents ?? amount < 100;
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0
  })}`;
}
