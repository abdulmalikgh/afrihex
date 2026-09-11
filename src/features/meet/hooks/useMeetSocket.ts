import { useCallback, useEffect, useRef, useState } from 'react';

import {
  buildMeetSocketUrl,
  parseMeetDestination,
  parseMeetMember,
  type MeetDestination,
  type MeetMember,
} from '../../../api/meet';
import { isObject } from '../../../api/client';

/**
 * The server drops position updates faster than one per five seconds per
 * member, so sending them is pure waste. Throttled here rather than relying on
 * the location watcher's own interval.
 */
const POSITION_INTERVAL_MS = 5_000;

/** Backoff between reconnect attempts, capped so a long outage still retries. */
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 15_000;

export type MeetConnectionState = 'connecting' | 'open' | 'closed' | 'error';

type UseMeetSocketInput = {
  sessionId: string;
  joinToken: string;
  displayName: string;
  role?: string;
  enabled: boolean;
};

/**
 * The live half of a meet session.
 *
 * Two things here are protocol requirements rather than choices: `join` must be
 * the first message after the socket opens, and the `reconnect_token` from the
 * `welcome` reply must be sent on every later `join` — without it a dropped
 * connection makes the same person appear as a second member on everyone
 * else's map.
 */
export function useMeetSocket({ sessionId, joinToken, displayName, role, enabled }: UseMeetSocketInput) {
  const [connection, setConnection] = useState<MeetConnectionState>('closed');
  const [destination, setDestination] = useState<MeetDestination>({});
  const [members, setMembers] = useState<MeetMember[]>([]);
  const [allArrived, setAllArrived] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTokenRef = useRef<string | null>(null);
  const memberIdRef = useRef<string | null>(null);
  const lastPositionSentRef = useRef(0);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(true);
  // Read inside the socket handlers, which are installed once per connection.
  const identityRef = useRef({ displayName, role });

  identityRef.current = { displayName, role };

  const upsertMember = useCallback((member: MeetMember) => {
    setMembers((current) => {
      const index = current.findIndex((existing) => existing.memberId === member.memberId);

      if (index === -1) {
        return [...current, member];
      }

      const next = [...current];
      next[index] = { ...next[index], ...member };

      return next;
    });
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !sessionId || !joinToken) {
      return;
    }

    setConnection('connecting');

    const socket = new WebSocket(buildMeetSocketUrl(sessionId, joinToken));
    socketRef.current = socket;

    socket.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setConnection('open');
      setErrorMessage(null);

      socket.send(
        JSON.stringify({
          type: 'join',
          display_name: identityRef.current.displayName,
          ...(identityRef.current.role ? { role: identityRef.current.role } : {}),
          // Resumes the existing identity instead of joining as a duplicate.
          ...(reconnectTokenRef.current ? { reconnect_token: reconnectTokenRef.current } : {}),
        }),
      );
    };

    socket.onmessage = (event) => {
      let payload: unknown;

      try {
        payload = JSON.parse(typeof event.data === 'string' ? event.data : '');
      } catch {
        return;
      }

      if (!isObject(payload) || typeof payload.type !== 'string') {
        return;
      }

      switch (payload.type) {
        case 'welcome': {
          if (typeof payload.reconnect_token === 'string') {
            reconnectTokenRef.current = payload.reconnect_token;
          }

          if (typeof payload.member_id === 'string') {
            memberIdRef.current = payload.member_id;
          }

          break;
        }

        case 'state': {
          setDestination(parseMeetDestination(payload.destination));
          setMembers(
            Array.isArray(payload.members)
              ? payload.members.flatMap((member) => {
                  const parsed = parseMeetMember(member);

                  return parsed ? [parsed] : [];
                })
              : [],
          );
          break;
        }

        case 'position':
        case 'arrived': {
          const parsed = parseMeetMember(payload);

          if (parsed) {
            upsertMember(payload.type === 'arrived' ? { ...parsed, hasArrived: true } : parsed);
          }

          break;
        }

        case 'all_arrived': {
          setAllArrived(true);
          break;
        }

        case 'member_left': {
          const memberId = typeof payload.member_id === 'string' ? payload.member_id : null;

          if (memberId) {
            setMembers((current) => current.filter((member) => member.memberId !== memberId));
          }

          break;
        }

        case 'error': {
          const code = typeof payload.code === 'string' ? payload.code : '';
          setErrorMessage(describeSocketError(code, payload.message));

          // These are terminal: retrying a full or expired session just fails
          // again, so the reconnect loop stands down.
          if (code === 'SESSION_FULL' || code === 'SESSION_EXPIRED') {
            shouldReconnectRef.current = false;
          }

          break;
        }

        default:
          break;
      }
    };

    socket.onerror = () => {
      setConnection('error');
    };

    socket.onclose = () => {
      setConnection('closed');
      socketRef.current = null;

      if (!shouldReconnectRef.current || !enabled) {
        return;
      }

      const attempt = reconnectAttemptsRef.current + 1;
      reconnectAttemptsRef.current = attempt;

      reconnectTimerRef.current = setTimeout(
        connect,
        Math.min(RECONNECT_BASE_MS * 2 ** (attempt - 1), RECONNECT_MAX_MS),
      );
    };
  }, [enabled, joinToken, sessionId, upsertMember]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();

    return () => {
      shouldReconnectRef.current = false;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }

      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [connect]);

  /** Silently drops anything inside the server's 5s window rather than sending it. */
  const sendPosition = useCallback((lat: number, lng: number, accuracyM?: number) => {
    const socket = socketRef.current;
    const now = Date.now();

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    if (now - lastPositionSentRef.current < POSITION_INTERVAL_MS) {
      return;
    }

    lastPositionSentRef.current = now;
    socket.send(
      JSON.stringify({ type: 'position', lat, lng, ...(accuracyM ? { accuracy_m: accuracyM } : {}) }),
    );
  }, []);

  const updateName = useCallback((name: string) => {
    const socket = socketRef.current;

    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'update_name', display_name: name }));
    }
  }, []);

  const leave = useCallback(() => {
    shouldReconnectRef.current = false;
    socketRef.current?.close();
  }, []);

  return {
    connection,
    destination,
    members,
    allArrived,
    errorMessage,
    ownMemberId: memberIdRef.current,
    sendPosition,
    updateName,
    leave,
  };
}

function describeSocketError(code: string, message: unknown) {
  switch (code) {
    case 'SESSION_FULL':
      return 'This meetup is full — it caps at 20 people.';
    case 'SESSION_EXPIRED':
      return 'This meetup has expired. Sessions last six hours.';
    case 'JOIN_FAILED':
      return 'Could not join this meetup. The link may be wrong.';
    default:
      return typeof message === 'string' ? message : 'The live connection reported a problem.';
  }
}
