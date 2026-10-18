import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { reportArrival } from '../../../api/navigation';
import type { RouteMode, RoutePoint } from '../../../api/route';
import { readVoiceVerbosity, writeVoiceVerbosity } from '../../../storage/voiceGuidance';
import { hapticLight, hapticSelection, hapticSuccess, hapticWarning } from '../../../utils/haptics';
import { NAVIGATION_LOCATION_TASK, setActiveTrip } from '../background/locationTask';
import type { PlannedRoute } from '../types/directions';
import {
  getGuidanceVerbosity,
  nextVerbosity,
  repeatGuidance,
  setGuidanceVerbosity,
  speakGuidance,
  stopSpeaking,
  type GuidanceVerbosity,
} from '../utils/speech';
import {
  advanceGuidance,
  buildJunctions,
  createCursor,
  DEFAULT_THRESHOLDS,
  formatGuidanceDistance,
  type GuidanceCursor,
} from '../utils/turnGuidance';

export type NavigationPhase =
  | 'idle'
  /** Permissions granted, waiting on the first fix. */
  | 'starting'
  | 'navigating'
  /** Following the line, but the device has drifted off it. */
  | 'offRoute'
  | 'arrived'
  | 'denied'
  | 'error';

export type NavigationState = {
  phase: NavigationPhase;
  /** The step whose geometry the device is currently travelling. */
  activeStepIndex: number;
  /** The step whose instruction is being announced, or `null` past the last junction. */
  nextStepIndex: number | null;
  /**
   * The manoeuvre after the next one, when the two are close enough to be
   * announced as one instruction. Drives the banner's "then" row.
   */
  followingStepIndex: number | null;
  distanceToManeuverM: number | null;
  remainingM: number;
  remainingS: number;
  /** Whether a background task is tracking this trip. */
  isBackgroundTracked: boolean;
  /**
   * Last fix, for drawing the device and framing the camera.
   *
   * Held in state rather than passed out of the watch callback because the map's
   * own blue dot does the drawing — this exists so the camera can keep the next
   * junction on screen, which means it has to be part of the render the map
   * reads. It changes on every fix, so nothing else should key off it.
   */
  userPosition: RoutePoint | null;
  message: string | null;
};

export type UseTurnByTurnInput = {
  route: PlannedRoute | null;
  mode: RouteMode;
  origin: RoutePoint | null;
  destination: RoutePoint | null;
  /** Spoken and shown as the arrival announcement. */
  destinationLabel: string;
};

export type UseTurnByTurnResult = NavigationState & {
  /** How much the voice says. Persisted, so it carries across trips. */
  verbosity: GuidanceVerbosity;
  start: () => void;
  /** Ends the trip and reports it as abandoned (`arrived: false`). */
  stop: () => void;
  /**
   * Clears a terminal summary — arrived, or a failure to start — without
   * reporting anything.
   *
   * Separate from `stop` because by the time either of these is on screen the
   * report has already gone (or never will), and calling `stop` would either do
   * nothing at all or report a second time for one journey — exactly the
   * duplicate sample the traffic model learns from.
   */
  dismiss: () => void;
  /** Steps the voice down one notch: full → turns only → off → full. */
  cycleVerbosity: () => void;
  /**
   * Says the current instruction again.
   *
   * Both reference apps put this on the banner itself rather than on a button,
   * because the moment you want it is the moment you have just missed what was
   * said and are already looking at the banner.
   */
  repeatInstruction: () => void;
};

/**
 * How often the device is asked where it is.
 *
 * 10 m rather than the 25 m `useArrivalReport` uses: that hook only cares about
 * crossing a 60 m radius, so it can afford to be coarse. Guidance has to place a
 * maneuver inside a 200 m pre-alert band, and at 30 km/h a 25 m interval is
 * sampled every three seconds — coarse enough to announce a turn after the
 * driver has already taken it.
 */
const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.Balanced,
  distanceInterval: 10,
  timeInterval: 3_000,
};

/**
 * Background updates are deliberately coarser than the foreground watch. They
 * exist to catch the arrival, not to place a maneuver, and a tighter interval
 * would keep the GPS hot for the whole drive.
 */
const BACKGROUND_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 15_000,
  showsBackgroundLocationIndicator: true,
  activityType: Location.ActivityType.AutomotiveNavigation,
  foregroundService: {
    notificationTitle: 'AfriHex is guiding your trip',
    notificationBody: 'Tap to return to your route.',
    notificationColor: '#2fa162',
  },
};

function idleState(): NavigationState {
  return {
    phase: 'idle',
    activeStepIndex: 0,
    nextStepIndex: null,
    followingStepIndex: null,
    distanceToManeuverM: null,
    remainingM: 0,
    remainingS: 0,
    isBackgroundTracked: false,
    userPosition: null,
    message: null,
  };
}

export function useTurnByTurn({
  route,
  mode,
  origin,
  destination,
  destinationLabel,
}: UseTurnByTurnInput): UseTurnByTurnResult {
  const [state, setState] = useState<NavigationState>(idleState);
  /**
   * Seeded from the module rather than from storage so the first render matches
   * what the speech layer will actually do. The stored value is applied by the
   * effect below, which is a frame or two later — by which time nothing has been
   * spoken, because nothing is spoken before a trip starts.
   */
  const [verbosity, setVerbosity] = useState<GuidanceVerbosity>(getGuidanceVerbosity);

  /**
   * The cursor is mutable and lives in a ref because it is written on every GPS
   * fix — several per second — and read only to derive the next update. Routing
   * it through state would re-render the whole screen at the GPS rate for a
   * value nothing renders directly.
   */
  const cursorRef = useRef<GuidanceCursor>(createCursor());
  const lastPositionRef = useRef<RoutePoint | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const isRunningRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);

  const junctions = useMemo(
    () => (route ? buildJunctions(route.steps, route.coordinates) : null),
    [route],
  );

  const steps = route?.steps ?? [];

  const teardown = useCallback(async () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;

    try {
      if (await Location.hasStartedLocationUpdatesAsync(NAVIGATION_LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(NAVIGATION_LOCATION_TASK);
      }
    } catch {
      // Asking about a task that was never registered throws on some platforms.
      // Ending a trip must not fail because there was nothing to tear down.
    }
  }, []);

  /**
   * Reports where the trip ended. One function for the background task, the
   * manual end button and the automatic arrival, so the three cannot drift apart
   * in what they send.
   */
  const sendArrival = useCallback(
    (position: RoutePoint | null, arrived: boolean) => {
      if (!destination) {
        return;
      }

      void reportArrival({
        destLat: destination.lat,
        destLng: destination.lng,
        ...(position ? { finalLat: position.lat, finalLng: position.lng } : {}),
        ...(origin ? { originLat: origin.lat, originLng: origin.lng } : {}),
        profile: mode,
        ...(route ? { routeDistanceM: route.distanceM, routeDurationS: route.durationS } : {}),
        achievedDurationS: Math.round((Date.now() - (startedAtRef.current ?? Date.now())) / 1000),
        arrived,
      });
    },
    [destination, mode, origin, route],
  );

  /** Applies one fix: advances guidance, speaks, publishes the new state. */
  const applyPosition = useCallback(
    (position: RoutePoint, speedMps: number | null) => {
      if (!junctions || !route || !isRunningRef.current) {
        return;
      }

      lastPositionRef.current = position;

      const update = advanceGuidance({
        position,
        speedMps,
        junctions,
        steps,
        routeDistanceM: route.distanceM,
        routeDurationS: route.durationS,
        destinationLabel,
        cursor: cursorRef.current,
        thresholds: DEFAULT_THRESHOLDS,
      });

      cursorRef.current = update.cursor;

      // Handed over in order; the speech layer ranks them, so an alert landing
      // on the same fix as a commit cannot talk over the turn.
      for (const announcement of update.spoken) {
        speakGuidance(announcement);

        /**
         * A cue for the announcements the driver has to act on, so the turn
         * survives a loud car or a muted voice. Apple pairs its manoeuvres with
         * one for the same reason. Deliberately only these three: a haptic on
         * every tier would be the pocket equivalent of the chatter `essential`
         * exists to remove.
         */
        if (announcement.kind === 'commit') {
          hapticLight();
        } else if (announcement.kind === 'offRoute') {
          hapticWarning();
        } else if (announcement.kind === 'arrival') {
          hapticSuccess();
        }
      }

      if (update.cursor.announcedArrival) {
        // Claimed here rather than by the background task so the foreground and
        // background paths cannot both report it. The task is torn down first,
        // which unregisters it before its own arrival check can fire.
        isRunningRef.current = false;
        setActiveTrip(null);
        void teardown();
        sendArrival(position, true);
        startedAtRef.current = null;

        setState((current) => ({
          ...current,
          phase: 'arrived',
          // Cleared so the HUD does not keep announcing the manoeuvre it just
          // drove past, and so the map stops pinning a pin behind the driver.
          nextStepIndex: null,
          followingStepIndex: null,
          distanceToManeuverM: null,
          remainingM: 0,
          remainingS: 0,
          isBackgroundTracked: false,
        }));
        return;
      }

      setState((current) => ({
        ...current,
        phase: update.offRoute ? 'offRoute' : 'navigating',
        activeStepIndex: update.activeStepIndex,
        nextStepIndex: update.nextStepIndex,
        followingStepIndex: update.followingStepIndex,
        distanceToManeuverM: update.distanceToManeuverM,
        remainingM: update.remainingM,
        remainingS: update.remainingS,
        userPosition: position,
      }));
    },
    [destinationLabel, junctions, route, sendArrival, steps, teardown],
  );

  /**
   * Ends the trip.
   *
   * Reported as `arrived: false` with the last known position. The endpoint
   * distinguishes a completed journey from an abandoned one, and folding the two
   * together would teach the traffic model that abandoned routes were driven at
   * the planned pace.
   */
  const stop = useCallback(() => {
    if (!isRunningRef.current) {
      return;
    }

    isRunningRef.current = false;
    stopSpeaking();
    setActiveTrip(null);
    void teardown();
    sendArrival(lastPositionRef.current, false);
    startedAtRef.current = null;
    cursorRef.current = createCursor();
    setState(idleState());
  }, [sendArrival, teardown]);

  const dismiss = useCallback(() => {
    setState(idleState());
  }, []);

  const start = useCallback(() => {
    if (!route || !destination || !junctions || isRunningRef.current) {
      return;
    }

    isRunningRef.current = true;
    cursorRef.current = createCursor();
    lastPositionRef.current = null;
    startedAtRef.current = Date.now();

    setState({
      ...idleState(),
      phase: 'starting',
      remainingM: route.distanceM,
      remainingS: route.durationS,
    });

    void (async () => {
      try {
        const foreground = await Location.requestForegroundPermissionsAsync();

        if (!foreground.granted) {
          isRunningRef.current = false;

          setState({
            ...idleState(),
            phase: 'denied',
            message: 'AfriHex needs location access to guide you. Turn it on for AfriHex in Settings.',
          });
          return;
        }

        /**
         * Background tracking is requested once per trip rather than at startup:
         * a prompt for a permission the user has no reason to grant yet is the
         * fastest route to a permanent denial. Declining it is a valid outcome —
         * the trip still runs, it just cannot record its own arrival if the app
         * is backgrounded.
         */
        let backgroundTracked = false;

        try {
          const background = await Location.requestBackgroundPermissionsAsync();

          if (background.granted) {
            // Set immediately above `start`, so the only path where this could be
            // null is an exception thrown since — which the catch below handles.
            const startedAt = startedAtRef.current ?? Date.now();

            setActiveTrip({
              origin,
              destination,
              mode,
              routeDistanceM: route.distanceM,
              routeDurationS: route.durationS,
              startedAt,
              hasReported: false,
            });

            await Location.startLocationUpdatesAsync(NAVIGATION_LOCATION_TASK, BACKGROUND_OPTIONS);
            backgroundTracked = true;
          }
        } catch {
          // Android 11+ opens system settings for this rather than showing a
          // dialog, and a user who backs out leaves it denied.
        }

        subscriptionRef.current = await Location.watchPositionAsync(WATCH_OPTIONS, (fix) => {
          applyPosition(
            { lat: fix.coords.latitude, lng: fix.coords.longitude },
            fix.coords.speed,
          );
        });

        setState((current) => ({ ...current, isBackgroundTracked: backgroundTracked }));
      } catch (error) {
        isRunningRef.current = false;
        void teardown();

        setState({
          ...idleState(),
          phase: 'error',
          message: error instanceof Error ? error.message : 'Could not start guidance.',
        });
      }
    })();
  }, [applyPosition, destination, junctions, mode, origin, route, teardown]);

  /**
   * Restores the stored preference once, on mount.
   *
   * Applied to the speech module as well as to state, because the module is
   * what actually gates an announcement and it has no way to read storage
   * itself — it is a plain module so the pure reducer can hand announcements
   * straight to it without a React boundary in between.
   */
  useEffect(() => {
    let isActive = true;

    void readVoiceVerbosity().then((stored) => {
      if (!isActive || stored === null) {
        return;
      }

      setGuidanceVerbosity(stored);
      setVerbosity(stored);
    });

    return () => {
      isActive = false;
    };
  }, []);

  const cycleVerbosity = useCallback(() => {
    setVerbosity((current) => {
      const next = nextVerbosity(current);

      setGuidanceVerbosity(next);
      void writeVoiceVerbosity(next);
      hapticSelection();

      return next;
    });
  }, []);

  /**
   * Re-speaks the instruction the HUD is showing.
   *
   * Built from the same step and the same distance the banner is displaying, so
   * what is heard matches what is on screen — reading `verbal_instruction`
   * without the distance would answer "what is the turn" when the question is
   * usually "how far is it".
   */
  const repeatInstruction = useCallback(() => {
    const step = state.nextStepIndex === null ? undefined : steps[state.nextStepIndex];
    const instruction = step?.verbal_instruction ?? step?.instruction;

    if (!instruction) {
      return;
    }

    const distanceM = state.distanceToManeuverM;
    const spoken =
      distanceM === null || distanceM <= 0
        ? instruction
        : `In ${formatGuidanceDistance(distanceM)}, ${instruction.charAt(0).toLowerCase()}${instruction.slice(1)}`;

    if (repeatGuidance(spoken)) {
      hapticLight();
    }
  }, [state.distanceToManeuverM, state.nextStepIndex, steps]);

  /**
   * `stop` is held in a ref so the unmount teardown below always calls the
   * current version without re-subscribing. Re-subscribing on every `stop`
   * identity change would end the trip whenever any of its inputs changed —
   * including a replan the user never asked to end the drive for.
   */
  const stopRef = useRef(stop);

  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  useEffect(
    () => () => {
      stopRef.current();
      stopSpeaking();
    },
    [],
  );

  return {
    ...state,
    verbosity,
    start,
    stop,
    dismiss,
    cycleVerbosity,
    repeatInstruction,
  };
}
