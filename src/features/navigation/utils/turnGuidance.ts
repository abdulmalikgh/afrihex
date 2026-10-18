import type { RoutePoint, RouteStep } from '../../../api/route';
import { projectRoute, snapToRoute, type RouteProjection } from './geo';

/**
 * How close the device counts as having arrived.
 *
 * Matches `useArrivalReport`'s 60 m: a fix in Accra is routinely 10–20 m out and
 * destination pins sit at hex centroids rather than doorways, so a tighter
 * radius would mostly report failures for journeys that plainly succeeded.
 */
export const ARRIVAL_RADIUS_M = 60;

/**
 * One announcement tier, expressed in seconds of travel rather than metres.
 *
 * Distance is the wrong unit for this and it is the mistake that makes voice
 * guidance feel broken. A single 200 m pre-alert is 24 seconds of warning at
 * Accra city pace and 7 seconds on the Tema Motorway — the same number, one
 * useful and one too late to act on. Google and Apple both scale the tiers with
 * speed, which is what `seconds` here does; the clamps keep the result sane at
 * the extremes, where speed alone would put a walking pre-alert 8 m before the
 * corner and a motorway one 3 km out.
 */
export type GuidanceBand = {
  /** Seconds before the junction at which this tier is spoken. */
  seconds: number;
  /** Floor, so a crawl still gets usable warning distance. */
  minM: number;
  /** Ceiling, so a long approach is not announced absurdly early. */
  maxM: number;
};

export type GuidanceThresholds = {
  /** The distant heads-up, e.g. "In 2 kilometres, turn left". */
  farAlert: GuidanceBand;
  /** The actionable warning, e.g. "In 200 metres, turn left". */
  preAlert: GuidanceBand;
  /** The manoeuvre itself — spoken without a distance. */
  commit: GuidanceBand;
  /**
   * How close a second junction has to be to the first for the two to be spoken
   * as one instruction. See {@link buildChain}.
   */
  chain: GuidanceBand;
  /** Distance at which the destination is called out, ahead of the arrival. */
  destinationAheadM: number;
  /**
   * How far past a junction counts as having passed it.
   *
   * Sized to the local GPS error rather than to the junction: a fix that is 15 m
   * short of the turn has still turned. Without this, every manoeuvre announces
   * late, and a fix that jitters across the junction re-announces it forever.
   */
  passToleranceM: number;
  /** Offset from the route line beyond which the device counts as off it. */
  offRouteM: number;
  /** Consecutive off-route fixes required before it is believed. */
  offRouteFixes: number;
};

/**
 * Tuned for Accra, from city streets to the motorway.
 *
 * The seconds are the tuning surface; the metre clamps only catch the extremes.
 * `preAlert.seconds` is 24 because that was the figure the original fixed 200 m
 * band encoded — 200 m at 30 km/h, the pace most of this app's driving happens
 * at — and it held up: long enough to change lanes for a turn obscured by
 * buildings, short enough that the driver has not stopped listening by the time
 * it comes.
 *
 * `farAlert` almost never fires in town. Its 800 m floor means it only speaks on
 * a step longer than 800 m, which is the case it exists for: a stretch where the
 * driver would otherwise hear nothing for minutes and start wondering whether
 * guidance is still running.
 */
export const DEFAULT_THRESHOLDS: GuidanceThresholds = {
  farAlert: { seconds: 70, minM: 800, maxM: 3000 },
  preAlert: { seconds: 24, minM: 150, maxM: 700 },
  commit: { seconds: 5, minM: 30, maxM: 170 },
  chain: { seconds: 9, minM: 60, maxM: 250 },
  destinationAheadM: 250,
  passToleranceM: 25,
  offRouteM: 60,
  offRouteFixes: 3,
};

/**
 * Pace assumed when neither the fix nor the plan offers one.
 *
 * 30 km/h — Accra city traffic, and the pace the band seconds were tuned
 * against, so this fallback reproduces the thresholds the fixed-distance
 * version used.
 */
const FALLBACK_SPEED_MPS = 8.33;

export type RouteJunctions = {
  projection: RouteProjection;
  /**
   * `metresM[i]` is the distance from the route start to the point where step
   * `i` ends and step `i+1` begins.
   *
   * That shared point is what makes the step geometry unambiguous. The API's own
   * fields disagree about which end of a step owns its manoeuvre — a single
   * captured response has `instruction: "Drive south."` with
   * `verbal_instruction: "Drive south. Then Turn right."`, which reads as the
   * turn belonging to the *next* step, while `bearing_before`/`bearing_after` on
   * the same step put the turn at this step's *end*. Rather than pick a reading
   * and be wrong half the time, guidance anchors on the boundary itself, which
   * both interpretations agree is the same physical junction.
   */
  metresM: number[];
};

/**
 * Locates every step boundary along the route, once per planned route.
 *
 * Each boundary is snapped with a full scan rather than a windowed one. This runs
 * on route change, not per fix, so the cost is paid a handful of times over the
 * life of a route — and a windowed scan here would silently pin a boundary to
 * the window edge whenever two junctions fell close together, which is common
 * where a turn immediately feeds another.
 */
export function buildJunctions(steps: RouteStep[], coordinates: Array<[number, number]>): RouteJunctions {
  const projection = projectRoute(coordinates);
  const metresM: number[] = [];

  let cursorM = 0;

  for (let index = 1; index < steps.length; index += 1) {
    const start = steps[index].coordinates[0];

    if (!start) {
      // A step with no geometry cannot anchor a junction. Reusing the previous
      // cursor keeps the remaining boundaries monotonic instead of resetting the
      // device's progress to the route start.
      metresM.push(cursorM);
      continue;
    }

    const snap = snapToRoute({ lat: start[1], lng: start[0] }, projection);

    // Boundaries are ascending along the route, so a backwards result is the
    // snapping picking a nearer point on an earlier loop of the line rather than
    // the boundary itself. Clamping keeps step progress monotonic.
    cursorM = Math.max(cursorM, snap.travelledM);
    metresM.push(cursorM);
  }

  return { projection, metresM };
}

export type AnnouncementKind =
  /** The first instruction, spoken on the first fix so the trip starts out loud. */
  | 'departure'
  | 'farAlert'
  | 'alert'
  | 'commit'
  | 'pass'
  | 'destinationAhead'
  | 'arrival'
  | 'offRoute'
  | 'resumed';

export type GuidanceAnnouncement = {
  kind: AnnouncementKind;
  text: string;
};

/**
 * The announcement tiers for one manoeuvre, in increasing urgency.
 *
 * Ranked rather than independent, which is the only way the latching works. A
 * slot per tier looks equivalent and is not: the tiers overlap by construction —
 * a junction 30 m away is inside the commit band *and* the pre-alert band *and*
 * the far-alert band — so a per-tier latch lets an already-committed manoeuvre
 * fall through to a wider band and announce itself again, less urgently, as the
 * driver enters the junction. Recording the highest tier spoken makes "nothing
 * quieter than what has already been said" the rule, which is what a driver
 * expects.
 */
const TIER = {
  farAlert: 1,
  preAlert: 2,
  commit: 3,
} as const;

export type GuidanceCursor = {
  /** How many junctions the device is judged to have passed. */
  passedJunctions: number;
  /** Last position along the route that was believed. */
  travelledM: number;
  offRouteStreak: number;
  announcedDeparture: boolean;
  /**
   * The highest {@link TIER} already spoken, by step index. Absent means
   * nothing has been said about that manoeuvre yet.
   *
   * One entry per manoeuvre announced, so it grows to the step count over a
   * trip — tens of small integers on the longest route this app plans.
   */
  spokenTiers: Record<number, number>;
  announcedDestinationAhead: boolean;
  announcedArrival: boolean;
  announcedOffRoute: boolean;
};

export function createCursor(): GuidanceCursor {
  return {
    passedJunctions: 0,
    travelledM: 0,
    offRouteStreak: 0,
    announcedDeparture: false,
    spokenTiers: {},
    announcedDestinationAhead: false,
    announcedArrival: false,
    announcedOffRoute: false,
  };
}

export type GuidanceUpdate = {
  cursor: GuidanceCursor;
  /** The step whose geometry the device is currently travelling. */
  activeStepIndex: number;
  /** The step whose instruction is being announced, or `null` once past the last junction. */
  nextStepIndex: number | null;
  /**
   * The manoeuvre after the next one, when it is close enough to matter — the
   * "then" row in the banner. `null` when the next turn is the last, or when
   * the one after it is far enough away to be a distraction.
   */
  followingStepIndex: number | null;
  distanceToManeuverM: number | null;
  remainingM: number;
  remainingS: number;
  offRoute: boolean;
  snappedPoint: RoutePoint | null;
  /** Announcements to speak now, in order. Empty when nothing changed. */
  spoken: GuidanceAnnouncement[];
};

export type AdvanceInput = {
  position: RoutePoint;
  /** Metres per second from the fix, when the platform reports it. */
  speedMps?: number | null;
  junctions: RouteJunctions;
  steps: RouteStep[];
  routeDistanceM: number;
  routeDurationS: number;
  /** How the destination reads when spoken, e.g. "Accra Mall". */
  destinationLabel: string;
  cursor: GuidanceCursor;
  thresholds?: GuidanceThresholds;
};

/**
 * Advances guidance by one position fix.
 *
 * Pure, so every awkward case the real GPS produces — a fix that jitters across a
 * junction, a jump after resuming from the background, a hop onto a parallel
 * street — is reproducible in a test rather than only on a moving car.
 */
export function advanceGuidance(input: AdvanceInput): GuidanceUpdate {
  const thresholds = input.thresholds ?? DEFAULT_THRESHOLDS;
  const { junctions, steps, cursor } = input;
  const { projection, metresM } = junctions;

  const snap = snapToRoute(input.position, projection, { fromM: cursor.travelledM, windowM: 600 });

  const offRouteStreak = snap.offsetM > thresholds.offRouteM ? cursor.offRouteStreak + 1 : 0;
  const offRoute = offRouteStreak >= thresholds.offRouteFixes;
  const pace = plannedPaceSecondsPerMetre(input);

  // Off route, the snapped position is a guess about which road the device is
  // on, so it must not move step progress — doing so is how a wrong turn
  // silently skips three maneuvers. The last believed position is held instead.
  if (offRoute) {
    const remainingM = Math.max(0, projection.totalM - cursor.travelledM);
    const spoken: GuidanceAnnouncement[] = cursor.announcedOffRoute
      ? []
      : [{ kind: 'offRoute', text: 'You have left the route. Rejoining it once you are back on it.' }];

    return {
      // The latch is set here rather than by the caller: without it the notice
      // would repeat on every fix for as long as the user is off the line.
      cursor: { ...cursor, offRouteStreak, announcedOffRoute: true },
      activeStepIndex: clampIndex(cursor.passedJunctions, steps.length),
      nextStepIndex: nextStepIndexFor(cursor.passedJunctions, steps.length),
      followingStepIndex: null,
      distanceToManeuverM: distanceToJunction(cursor.passedJunctions, metresM, cursor.travelledM),
      remainingM,
      remainingS: estimateRemainingS(remainingM, pace, input.speedMps),
      offRoute: true,
      snappedPoint: snap.point,
      spoken,
    };
  }

  const travelledM = snap.travelledM;
  const speedMps = effectiveSpeedMps(input, pace);

  // Junctions are consumed one at a time and never un-consumed. Un-consuming is
  // what makes guidance stutter when a fix jitters either side of a turn.
  let passedJunctions = cursor.passedJunctions;

  while (passedJunctions < metresM.length && travelledM >= metresM[passedJunctions] - thresholds.passToleranceM) {
    passedJunctions += 1;
  }

  const crossedExactlyOne = passedJunctions === cursor.passedJunctions + 1;
  const activeStepIndex = clampIndex(passedJunctions, steps.length);
  const nextStepIndex = nextStepIndexFor(passedJunctions, steps.length);
  const distanceToManeuverM = distanceToJunction(passedJunctions, metresM, travelledM);
  const remainingM = Math.max(0, projection.totalM - travelledM);
  const remainingS = estimateRemainingS(remainingM, pace, input.speedMps);

  const commitM = resolveBand(thresholds.commit, speedMps);
  const preAlertM = resolveBand(thresholds.preAlert, speedMps);
  const farAlertM = resolveBand(thresholds.farAlert, speedMps);
  const chainM = resolveBand(thresholds.chain, speedMps);
  const chain = buildChain({ passedJunctions, metresM, steps, chainM });

  const spoken: GuidanceAnnouncement[] = [];

  let spokenTiers = cursor.spokenTiers;

  /** Raises a step's tier. Never lowers it — the highest spoken is the latch. */
  const markTier = (stepIndex: number, tier: number) => {
    if ((spokenTiers[stepIndex] ?? 0) < tier) {
      spokenTiers = { ...spokenTiers, [stepIndex]: tier };
    }
  };

  /**
   * The trip starts out loud.
   *
   * Without this the app is silent from the moment the driver presses Go until
   * the first junction enters the pre-alert band — which on a long first street
   * is minutes, and reads as voice guidance having failed to start. Google says
   * "Head north on Oxford Street" immediately for the same reason. Step 0 is the
   * departure instruction, and it is spoken before anything else so a commit
   * landing on the same fix can outrank it.
   */
  let announcedDeparture = cursor.announcedDeparture;

  if (!announcedDeparture) {
    announcedDeparture = true;

    const departure = steps[0]?.verbal_instruction ?? steps[0]?.instruction ?? null;

    if (departure) {
      spoken.push({ kind: 'departure', text: departure });

      /**
       * When the first junction is already inside the far band, the departure
       * doubles as its heads-up and the far tier stands down.
       *
       * Conditional rather than unconditional, and the condition is the point.
       * At motorway speed the band reaches 2 km, so the far alert would fire on
       * this very fix and — being the more urgent of the two — talk over the
       * instruction telling the driver which way to pull out. In town the same
       * junction is usually well outside an 800 m band, and standing the tier
       * down there would trade a collision that cannot happen for two minutes of
       * silence on the opening straight, which is the thing the far tier exists
       * to fill.
       */
      if (nextStepIndex !== null && distanceToManeuverM !== null && distanceToManeuverM <= farAlertM) {
        markTier(nextStepIndex, TIER.farAlert);
      }
    }
  }

  if (cursor.announcedOffRoute) {
    spoken.push({ kind: 'resumed', text: 'Back on the route.' });
  }

  if (crossedExactlyOne) {
    const justTravelledStep = steps[cursor.passedJunctions];
    const text = justTravelledStep?.verbal_post ?? null;

    if (text) {
      spoken.push({ kind: 'pass', text });
    }
  }

  const nextStep = nextStepIndex === null ? undefined : steps[nextStepIndex];

  /**
   * The final step *is* the arrival, so its manoeuvre tiers are suppressed and
   * the dedicated arrival announcements own the approach instead.
   *
   * Not a stylistic choice. The last junction sits on the destination, so the
   * commit band and the 60 m arrival radius cover the same ground — which means
   * both fired within one fix of each other, saying "You have arrived at your
   * destination" (Valhalla's text for the step) and then "You have arrived at
   * Accra Mall" (ours, with the label the user actually recognises). The second
   * is the better sentence, so the first stands down.
   */
  const isArrivalStep = nextStepIndex !== null && nextStepIndex === steps.length - 1;

  if (nextStep !== undefined && nextStepIndex !== null && !isArrivalStep && distanceToManeuverM !== null) {
    const alreadySpoken = spokenTiers[nextStepIndex] ?? 0;

    // Checked loudest-first, so a junction inside the commit band cannot also
    // trip the two wider bands it is necessarily inside.
    if (distanceToManeuverM <= commitM && alreadySpoken < TIER.commit) {
      const base = nextStep.verbal_instruction ?? nextStep.instruction;

      if (base) {
        spoken.push({
          kind: 'commit',
          text: chain ? `${stripTrailingPeriod(base)}, then ${chain.text}.` : base,
        });
        markTier(nextStepIndex, TIER.commit);

        /**
         * The chained manoeuvre has just been named, so its own pre-alerts
         * would repeat it within seconds. Raised to the pre-alert tier rather
         * than to commit so its *commit* still fires when the driver reaches
         * it — which is what both reference apps do, and what stops a chained
         * pair from leaving the second turn unannounced.
         */
        if (chain) {
          markTier(chain.stepIndex, TIER.preAlert);
        }
      }
    } else if (distanceToManeuverM <= preAlertM && alreadySpoken < TIER.preAlert) {
      const text = nextStep.verbal_alert ?? synthesizeAlert(nextStep.instruction, distanceToManeuverM);

      if (text) {
        spoken.push({ kind: 'alert', text });
        markTier(nextStepIndex, TIER.preAlert);
      }
    } else if (distanceToManeuverM <= farAlertM && alreadySpoken < TIER.farAlert) {
      const text = synthesizeAlert(nextStep.instruction, distanceToManeuverM);

      if (text) {
        spoken.push({ kind: 'farAlert', text });
        markTier(nextStepIndex, TIER.farAlert);
      }
    }
  }

  /**
   * The destination called out before it is reached.
   *
   * Arrival on its own is an announcement the driver can only act on in the
   * past tense — by the time they hear it they are looking for somewhere to
   * stop. This is the "your destination is ahead" both reference apps give, and
   * it is bounded below by the arrival radius so the two never collide.
   */
  let announcedDestinationAhead = cursor.announcedDestinationAhead;

  if (
    !announcedDestinationAhead &&
    remainingM <= thresholds.destinationAheadM &&
    remainingM > ARRIVAL_RADIUS_M
  ) {
    announcedDestinationAhead = true;
    spoken.push({
      kind: 'destinationAhead',
      text: input.destinationLabel
        ? `${input.destinationLabel} is ahead.`
        : 'Your destination is ahead.',
    });
  }

  let announcedArrival = cursor.announcedArrival;

  if (remainingM <= ARRIVAL_RADIUS_M && !announcedArrival) {
    announcedArrival = true;
    spoken.push({
      kind: 'arrival',
      text: input.destinationLabel
        ? `You have arrived at ${input.destinationLabel}.`
        : 'You have arrived at your destination.',
    });
  }

  return {
    cursor: {
      passedJunctions,
      travelledM,
      offRouteStreak,
      announcedDeparture,
      spokenTiers,
      announcedDestinationAhead,
      announcedArrival,
      announcedOffRoute: false,
    },

    activeStepIndex,
    nextStepIndex,
    followingStepIndex: chain?.stepIndex ?? null,
    distanceToManeuverM,
    remainingM,
    remainingS,
    offRoute: false,
    snappedPoint: snap.point,
    spoken,
  };
}

/**
 * Converts a band into metres for the pace the device is actually travelling.
 */
function resolveBand(band: GuidanceBand, speedMps: number) {
  return Math.min(band.maxM, Math.max(band.minM, speedMps * band.seconds));
}

/**
 * The pace the announcement bands are sized against.
 *
 * Prefers the fix's own speed, because the bands are about how long the driver
 * has to react and only the fix knows that. Below walking pace the figure is
 * mostly sensor noise — and a speed near zero would collapse every band to its
 * floor, announcing a turn 30 m away while the driver sits at a light 400 m
 * short of it — so the plan's average takes over.
 */
function effectiveSpeedMps(input: AdvanceInput, paceSPerM: number) {
  if (input.speedMps !== null && input.speedMps !== undefined && input.speedMps > 1.5) {
    return input.speedMps;
  }

  if (paceSPerM > 0) {
    return 1 / paceSPerM;
  }

  return FALLBACK_SPEED_MPS;
}

/**
 * The "…, then turn left" tail, when a second junction follows immediately.
 *
 * Two turns 80 m apart cannot be announced as two instructions: the pre-alert
 * for the second would land while the driver is still in the first, and the
 * commit would arrive after they have already had to choose a lane. Both Google
 * and Apple fold the pair into one sentence, and this is that — it is also what
 * feeds the banner's "then" row, so what is said and what is shown come from the
 * same decision.
 */
function buildChain(args: {
  passedJunctions: number;
  metresM: number[];
  steps: RouteStep[];
  chainM: number;
}): { stepIndex: number; text: string } | null {
  const { passedJunctions, metresM, steps, chainM } = args;

  // `metresM[passedJunctions]` is the junction being announced; the next entry
  // is the one after it. Absent, there is nothing to chain onto.
  if (passedJunctions + 1 >= metresM.length) {
    return null;
  }

  if (metresM[passedJunctions + 1] - metresM[passedJunctions] > chainM) {
    return null;
  }

  const stepIndex = passedJunctions + 2;
  const following = steps[stepIndex];

  if (!following) {
    return null;
  }

  // Valhalla's arrival step reads "You have arrived at your destination.", which
  // tacked onto a turn produces "turn right, then you have arrived" — past tense
  // for something that has not happened.
  const text =
    stepIndex === steps.length - 1
      ? 'you arrive at your destination'
      : lowerFirst(stripTrailingPeriod(following.instruction));

  return text ? { stepIndex, text } : null;
}

function stripTrailingPeriod(text: string) {
  return text.replace(/\.\s*$/, '');
}

function lowerFirst(text: string) {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

/** A pre-alert the server did not provide, built from the plain instruction. */
function synthesizeAlert(instruction: string, distanceM: number) {
  if (!instruction) {
    return null;
  }

  return `In ${formatGuidanceDistance(distanceM)}, ${lowerFirst(instruction)}`;
}

/**
 * Spoken distances, rounded the way a driver would say them.
 *
 * 250 m and 175 m are not numbers anyone acts on mid-junction; 250 m and 200 m
 * are. Past 2 km the tenth goes too: "In 1.9 kilometres" is a precision no one
 * needs about a turn that is two minutes away.
 */
export function formatGuidanceDistance(distanceM: number) {
  const metres = Math.max(0, Math.round(distanceM));

  if (metres >= 1000) {
    const km = metres / 1000;
    const rounded = km >= 2 ? Math.round(km) : Math.round(km * 10) / 10;

    return `${rounded} ${rounded === 1 ? 'kilometre' : 'kilometres'}`;
  }

  if (metres >= 100) {
    return `${Math.round(metres / 50) * 50} metres`;
  }

  if (metres >= 20) {
    return `${Math.round(metres / 10) * 10} metres`;
  }

  return 'now';
}

/**
 * The plain label for the distance readout, which wants "now" and no unit.
 *
 * Shares {@link formatGuidanceDistance}'s thresholds so the headline and the
 * spoken announcement agree. Without the `now` case it would round 5 m up to
 * "10 m", which both oversells the distance and disagrees with what is being
 * said out loud at the same moment.
 */
export function formatGuidanceDistanceLabel(distanceM: number | null) {
  if (distanceM === null) {
    return null;
  }

  const metres = Math.max(0, Math.round(distanceM));

  if (metres >= 1000) {
    const km = metres / 1000;

    return `${km >= 2 ? Math.round(km) : Math.round(km * 10) / 10} km`;
  }

  if (metres >= 100) {
    return `${Math.round(metres / 50) * 50} m`;
  }

  if (metres < 20) {
    return 'now';
  }

  return `${Math.round(metres / 10) * 10} m`;
}

function distanceToJunction(passedJunctions: number, metresM: number[], travelledM: number) {
  if (passedJunctions >= metresM.length) {
    return null;
  }

  return Math.max(0, metresM[passedJunctions] - travelledM);
}

function nextStepIndexFor(passedJunctions: number, stepCount: number) {
  const next = passedJunctions + 1;

  return next < stepCount ? next : null;
}

function clampIndex(index: number, stepCount: number) {
  if (stepCount === 0) {
    return 0;
  }

  return Math.max(0, Math.min(index, stepCount - 1));
}

function plannedPaceSecondsPerMetre(input: AdvanceInput) {
  if (input.routeDistanceM <= 0) {
    return 0;
  }

  return Math.max(0, input.routeDurationS) / input.routeDistanceM;
}

/**
 * Remaining time, preferring the device's own speed over the planned average.
 *
 * A stop at a junction is where a route's planned pace is worst, and it is
 * exactly when the readout is being watched. Below walking pace the fix's speed
 * is mostly sensor noise, so the plan's average takes over rather than dividing
 * the remaining distance by ~0 and claiming the user has arrived.
 */
function estimateRemainingS(remainingM: number, paceSPerM: number, speedMps?: number | null) {
  if (speedMps !== null && speedMps !== undefined && speedMps > 1.5) {
    return remainingM / speedMps;
  }

  return remainingM * paceSPerM;
}

export type ManeuverKind =
  | 'depart'
  | 'straight'
  | 'slightLeft'
  | 'slightRight'
  | 'left'
  | 'right'
  | 'sharpLeft'
  | 'sharpRight'
  | 'uturn'
  | 'roundabout'
  | 'merge'
  | 'exit'
  | 'arrive'
  | 'unknown';

/**
 * Which arrow to draw for a step.
 *
 * Prefers `turn_class` where it is specific, then `turn_angle`, then the
 * bearings. The bearings are not redundant: `turn_angle` is absent on plenty of
 * steps, but `bearing_before`/`bearing_after` are present on nearly all of them,
 * and the same number derived from either source has to agree or the arrow will
 * point the wrong way on a left turn.
 */
export function getManeuverKind(
  step: RouteStep | undefined,
  options: { isFirst: boolean; isLast: boolean },
): ManeuverKind {
  if (!step) {
    return options.isLast ? 'arrive' : 'unknown';
  }

  if (options.isLast) {
    return 'arrive';
  }

  const turnClass = (step.turn_class ?? '').toLowerCase();

  if (turnClass.includes('u_turn') || turnClass.includes('uturn')) {
    return 'uturn';
  }

  if (turnClass.includes('roundabout') || turnClass.includes('rotary')) {
    return 'roundabout';
  }

  if (turnClass.includes('exit')) {
    return 'exit';
  }

  if (turnClass.includes('merge')) {
    return 'merge';
  }

  const angle = resolveTurnAngle(step);

  if (angle === null) {
    if (options.isFirst) {
      return 'depart';
    }

    return turnClass.includes('straight') || turnClass.includes('new_name') ? 'straight' : 'unknown';
  }

  const magnitude = Math.abs(angle);

  if (magnitude < 20) {
    return options.isFirst && turnClass === '' ? 'depart' : 'straight';
  }

  // Beyond ~170° the road doubles back on itself, and drawing it as a hard left
  // or right sends the driver the wrong way around the junction.
  if (magnitude > 170) {
    return 'uturn';
  }

  if (magnitude > 135) {
    return angle < 0 ? 'sharpLeft' : 'sharpRight';
  }

  if (magnitude > 55) {
    return angle < 0 ? 'left' : 'right';
  }

  return angle < 0 ? 'slightLeft' : 'slightRight';
}

/**
 * The signed turn angle in degrees. Negative is a left turn.
 *
 * Taken from `turn_angle` when present, since that is the server's own verdict.
 * Otherwise derived from the bearings, normalised into (-180, 180] so a turn
 * that crosses north reads as the short way round rather than 350°.
 */
export function resolveTurnAngle(step: RouteStep): number | null {
  if (typeof step.turn_angle === 'number' && Number.isFinite(step.turn_angle)) {
    return step.turn_angle;
  }

  if (typeof step.bearing_before === 'number' && typeof step.bearing_after === 'number') {
    return normalizeBearingDelta(step.bearing_before, step.bearing_after);
  }

  return null;
}

function normalizeBearingDelta(before: number, after: number) {
  return ((((after - before) % 360) + 540) % 360) - 180;
}
