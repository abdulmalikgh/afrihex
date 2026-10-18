import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

import type { AnnouncementKind } from './turnGuidance';

/**
 * Voice guidance.
 *
 * Wraps `expo-speech` rather than calling it from components so four things hold
 * in one place:
 *
 * - **Urgency decides what is audible.** `Speech.speak` appends to a queue by
 *   default, so a driver who triggers three announcements on one fix would hear
 *   all three in order, each stale by the time it played. The other obvious fix —
 *   stopping before every announcement — is worse in a way that is easy to miss:
 *   it makes the *last* announcement win rather than the most important one, so
 *   an arrival silences the turn that reaches it. This module ranks announcements
 *   instead (see {@link PRIORITY}): a commit interrupts a pre-alert, a pre-alert
 *   never interrupts a commit, and anything quieter than what is playing waits
 *   its turn.
 * - **Nothing throws.** iOS stays silent in the silent switch, Android has no
 *   engine on some devices, and there is no web build of this at all. None of
 *   those is worth surfacing — the instruction is on screen either way.
 * - **Audio ducks rather than stops.** See {@link VOICE_OPTIONS}.
 * - **Verbosity is one setting, not a boolean.** See {@link GuidanceVerbosity}.
 */

const isSupported = Platform.OS === 'ios' || Platform.OS === 'android';

/** `en` rather than `en-GH`: not every device ships a Ghanaian voice. */
const VOICE_LANGUAGE = 'en';

/** Brisk enough to keep pace with driving, slow enough to stay intelligible. */
const VOICE_RATE = 1.05;

/**
 * `useApplicationAudioSession: false` is what makes a user's music duck under an
 * announcement and come back afterwards.
 *
 * Counter-intuitive enough to be worth stating: the flag reads as "use the app's
 * own session", and its default is `true`. Left at the default, iOS speaks on
 * AfriHex's session, which does not mix — so Spotify *stops* for the turn and the
 * driver has to restart it. Setting it to `false` hands the announcement to a
 * separate system-managed session, which is the one that knows how to duck and
 * restore. Android ignores the option.
 */
const VOICE_OPTIONS = {
  language: VOICE_LANGUAGE,
  rate: VOICE_RATE,
  useApplicationAudioSession: false,
} as const satisfies Speech.SpeechOptions;

/**
 * How much the voice says.
 *
 * Three states rather than a mute toggle, because the two reasons people reach
 * for mute are different. "The voice talks too much" wants the chatter gone and
 * the turns kept; "be quiet" wants silence. A boolean forces the first group to
 * choose silence and then miss a turn.
 *
 * - `full` — every tier, including the far pre-alert and the landmark notes the
 *   API supplies as `verbal_post`.
 * - `essential` — the turn itself, leaving the route, and arriving. No distant
 *   pre-alerts, no passing notes.
 * - `muted` — nothing.
 */
export type GuidanceVerbosity = 'full' | 'essential' | 'muted';

/** Cycle order for the one button that drives this: loudest to quietest. */
export const VERBOSITY_CYCLE: readonly GuidanceVerbosity[] = ['full', 'essential', 'muted'];

export const VERBOSITY_LABELS: Record<GuidanceVerbosity, string> = {
  full: 'Full voice',
  essential: 'Turns only',
  muted: 'Voice off',
};

/**
 * Which announcement wins when two want the speaker.
 *
 * Ordered by what it costs the driver to miss it. `commit` and `offRoute` sit
 * level: both are "act now", and whichever arrived later is the current truth.
 * `arrival` outranks everything because once it fires there is nothing left to
 * announce.
 */
const PRIORITY: Record<AnnouncementKind, number> = {
  pass: 1,
  departure: 1,
  farAlert: 2,
  alert: 3,
  destinationAhead: 3,
  resumed: 3,
  commit: 4,
  offRoute: 4,
  arrival: 5,
};

/** The kinds that survive `essential`. */
const ESSENTIAL_KINDS: ReadonlySet<AnnouncementKind> = new Set<AnnouncementKind>([
  'departure',
  'commit',
  'offRoute',
  'resumed',
  'destinationAhead',
  'arrival',
]);

export type GuidanceAnnouncementInput = {
  kind: AnnouncementKind;
  text: string;
};

/**
 * How many quieter announcements may wait behind the one playing.
 *
 * Small on purpose. A backlog of guidance is guidance about a junction the
 * driver has already crossed, and speaking it late is worse than not speaking
 * it — so the queue is a short grace period for a passing note that landed
 * mid-sentence, not a buffer.
 */
const MAX_QUEUE = 2;

/**
 * When an in-flight utterance is presumed finished despite no callback.
 *
 * Android's TTS drops `onDone` often enough that a queue gated on it will stall
 * for the rest of the trip — and a stalled queue is a silent one, which is the
 * failure the driver cannot see. Generous enough that it never cuts a real
 * sentence short: the longest chained instruction runs about five seconds.
 */
const UTTERANCE_CEILING_MS = 12_000;

let verbosity: GuidanceVerbosity = 'full';

/**
 * Invalidates in-flight callbacks.
 *
 * Every `speak` captures the value at the time it started and its callbacks
 * no-op unless it still matches. Without it, stopping an utterance to play an
 * urgent one would let the stopped utterance's `onStopped` fire *after* the new
 * one started and drain the queue on top of it.
 */
let generation = 0;

let playing: { kind: AnnouncementKind; startedAt: number } | null = null;
let queue: GuidanceAnnouncementInput[] = [];

function isAudible(kind: AnnouncementKind) {
  if (verbosity === 'muted') {
    return false;
  }

  if (verbosity === 'essential') {
    return ESSENTIAL_KINDS.has(kind);
  }

  return true;
}

/** Releases the speaker when a callback never arrived. See {@link UTTERANCE_CEILING_MS}. */
function releaseIfStalled() {
  if (playing && Date.now() - playing.startedAt > UTTERANCE_CEILING_MS) {
    playing = null;
  }
}

function start(announcement: GuidanceAnnouncementInput) {
  generation += 1;

  const id = generation;

  playing = { kind: announcement.kind, startedAt: Date.now() };

  const settle = () => {
    if (id !== generation) {
      return;
    }

    playing = null;
    drain();
  };

  try {
    Speech.speak(announcement.text, {
      ...VOICE_OPTIONS,
      onDone: settle,
      onStopped: settle,
      onError: settle,
    });
  } catch {
    // The engine refused it. Release the speaker rather than hold it for an
    // utterance that will never report back.
    playing = null;
  }
}

function drain() {
  const next = queue.shift();

  if (next) {
    start(next);
  }
}

/**
 * Speaks an announcement, ranked against whatever is already playing.
 *
 * @returns whether the announcement reached the speaker — `false` when it was
 * filtered by the verbosity setting, dropped as stale, or the platform has no
 * engine. Callers use it to keep a HUD in step with what is audible rather than
 * assuming it played.
 */
export function speakGuidance(announcement: GuidanceAnnouncementInput): boolean {
  if (!isSupported || !announcement.text || !isAudible(announcement.kind)) {
    return false;
  }

  releaseIfStalled();

  if (!playing) {
    // Nothing is holding the speaker, so a backlog here is from an utterance
    // that already finished — stale by definition.
    queue = [];
    start(announcement);
    return true;
  }

  if (PRIORITY[announcement.kind] >= PRIORITY[playing.kind]) {
    /**
     * Interrupt. Equal priority interrupts too: two commits in a row are a
     * chained pair of turns, and the second is the one that has not happened
     * yet.
     *
     * `stop()` is not awaited before speaking — awaiting it adds a gap the
     * driver hears as a stutter, and `speak` on a stopped synthesiser is the
     * same call either way. It rejects when nothing is playing on some Android
     * builds, which is not interesting.
     */
    queue = [];
    void Speech.stop().catch(() => undefined);
    start(announcement);
    return true;
  }

  queue = [...queue, announcement].slice(-MAX_QUEUE);

  return true;
}

/**
 * Speaks something the user asked for by tapping, interrupting whatever is
 * playing.
 *
 * Separate from {@link speakGuidance} because an explicit request is not
 * subject to the verbosity filter — `essential` is about what the app
 * volunteers, not about what it will say when asked. `muted` still wins: a muted
 * app that talks when tapped is a muted app that talks.
 */
export function repeatGuidance(text: string): boolean {
  if (!isSupported || !text || verbosity === 'muted') {
    return false;
  }

  queue = [];
  void Speech.stop().catch(() => undefined);
  start({ kind: 'commit', text });

  return true;
}

export function stopSpeaking() {
  // The generation bump and the cleared queue have to happen even where speech
  // is unsupported, or a trip ended on web would leave state behind for the
  // next one.
  generation += 1;
  playing = null;
  queue = [];

  if (!isSupported) {
    return;
  }

  void Speech.stop().catch(() => undefined);
}

export function setGuidanceVerbosity(next: GuidanceVerbosity) {
  verbosity = next;

  if (next === 'muted') {
    stopSpeaking();
  }
}

export function getGuidanceVerbosity() {
  return verbosity;
}

/** The next setting the voice button moves to. */
export function nextVerbosity(current: GuidanceVerbosity): GuidanceVerbosity {
  const index = VERBOSITY_CYCLE.indexOf(current);

  return VERBOSITY_CYCLE[(index + 1) % VERBOSITY_CYCLE.length];
}
