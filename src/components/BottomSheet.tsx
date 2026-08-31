import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { ChevronUp } from 'lucide-react-native';
import Animated, {
  clamp,
  interpolate,
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { colors } from '../constants/colors';
import { radius } from '../constants/radius';
import { spacing } from '../constants/spacing';
import { AppText } from './AppText';

/**
 * -1 = minimized bar (only when `minimizedLabel` is set), 0 = collapsed peek,
 * 1 = medium, 2 = expanded. The peek keeps index 0 whether or not the minimized
 * detent exists, so screens don't have to renumber to opt in.
 */
export type SheetSnapIndex = -1 | 0 | 1 | 2;

type BottomSheetProps = {
  children: ReactNode;
  /** Heights for [collapsed, medium, expanded] as fractions of available height. */
  snapPoints?: readonly [number, number, number];
  /** Controlled snap index. The sheet animates whenever this changes. */
  index: SheetSnapIndex;
  /** Fired when a drag settles on a different snap point. */
  onIndexChange: (index: SheetSnapIndex) => void;
  /**
   * Height of the area the sheet lives in. Pass the measured parent height —
   * inside a tab navigator this is shorter than the window.
   */
  availableHeight?: number;
  /** Space kept clear at the top so the sheet never reaches the status bar. */
  topInset?: number;
  /** Extra bottom padding for the scrollable content. */
  bottomInset?: number;
  /** Receives 0..1 openness (0 = collapsed, 1 = expanded) for parent animations. */
  progress?: SharedValue<number>;
  /**
   * Receives the sheet's currently visible height in px. Lets a sibling overlay
   * (a floating action button, a toast) track the sheet's top edge frame by frame
   * instead of re-estimating it from the snap fractions on the JS thread.
   */
  visibleHeight?: SharedValue<number>;
  /** Overrides the sheet's surface colour and border, for screens on a light palette. */
  surfaceStyle?: StyleProp<ViewStyle>;
  /** Overrides the scroll content box, e.g. to let list rows run edge to edge. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Overrides the drag handle colour to keep it legible on a custom surface. */
  handleColor?: string;
  /**
   * Adds a detent below the peek where the sheet shrinks to a single bar showing
   * a chevron and this label — Google Maps' "Tap to see quick actions" strip.
   * Omit it and the sheet bottoms out at the peek, as before.
   */
  minimizedLabel?: string;
  /**
   * Snap point a tap on the handle jumps to. Tapping again while already there
   * returns to `tapCollapsedIndex` — the Google Maps grabber behaviour.
   */
  tapExpandedIndex?: SheetSnapIndex;
  /** Snap point a tap returns to once the sheet is already at `tapExpandedIndex`. */
  tapCollapsedIndex?: SheetSnapIndex;
  /**
   * Tapping the card itself (not just the grabber) opens it, like tapping a
   * collapsed place card in Google Maps. Buttons inside the sheet still win the
   * press, so only taps on inert areas expand it.
   */
  expandOnContentTap?: boolean;
};

const SPRING_CONFIG = {
  damping: 32,
  stiffness: 300,
  mass: 0.9,
  restDisplacementThreshold: 0.4,
  restSpeedThreshold: 0.4,
} as const;

/** How far ahead a fling is projected before picking the nearest snap point. */
const VELOCITY_PROJECTION = 0.11;
/** Resistance applied when dragging past the outermost snap points. */
const RUBBER_BAND = 0.2;
/** Movement (px) that turns a touch on the handle from a tap into a drag. */
const PAN_ACTIVATION_DISTANCE = 6;
/** Slack (px) for "is the sheet at its expanded stop", against spring rounding. */
const EXPANDED_EPSILON = 0.5;
/** Height of the grab strip, and so of the sheet at its minimized detent. */
const HANDLE_ZONE_HEIGHT = 48;

export function BottomSheet({
  children,
  snapPoints = [0.34, 0.6, 0.94],
  index,
  onIndexChange,
  availableHeight,
  topInset = 0,
  bottomInset = 0,
  progress,
  visibleHeight,
  surfaceStyle,
  contentStyle,
  handleColor,
  minimizedLabel,
  tapExpandedIndex = 2,
  tapCollapsedIndex = 0,
  expandOnContentTap = true,
}: BottomSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const trackHeight = availableHeight && availableHeight > 0 ? availableHeight : windowHeight;
  const hasMinimized = Boolean(minimizedLabel);

  // Laid out at full expanded height and translated downward to reveal less, so
  // content never re-lays-out mid-drag.
  const expandedHeight = Math.max(200, Math.min(trackHeight * snapPoints[2], trackHeight - topInset));

  /**
   * translateY per detent, ordered bottom-most first. With the minimized detent
   * present the array is one longer than the index range, so index and position
   * differ by `indexShift` — see `positionOf`.
   */
  const offsets = useMemo(() => {
    const stops = [
      Math.max(0, expandedHeight - trackHeight * snapPoints[0]),
      Math.max(0, expandedHeight - trackHeight * snapPoints[1]),
      0,
    ];

    return hasMinimized ? [Math.max(0, expandedHeight - HANDLE_ZONE_HEIGHT), ...stops] : stops;
  }, [expandedHeight, hasMinimized, trackHeight, snapPoints]);

  const indexShift = hasMinimized ? 1 : 0;
  const positionOf = useCallback(
    (snapIndex: SheetSnapIndex) => clampPosition(snapIndex + indexShift, offsets.length),
    [indexShift, offsets.length],
  );

  const translateY = useSharedValue(offsets[positionOf(index)]);
  const gestureStartY = useSharedValue(0);
  const sharedOffsets = useSharedValue(offsets);
  const sharedIndexShift = useSharedValue(indexShift);
  const sharedExpandedHeight = useSharedValue(expandedHeight);
  // Inner scroll position, so the sheet only collapses on a content drag when
  // the list is already at its top.
  const innerScrollY = useSharedValue(0);
  // Mirror of the controlled index, readable from gesture worklets.
  const currentIndex = useSharedValue<SheetSnapIndex>(index);
  // True once a content drag has been claimed by the sheet rather than the list.
  const isDraggingSheet = useSharedValue(false);
  // Gesture translation at the moment the sheet claimed the drag, so taking over
  // mid-gesture doesn't make the sheet jump by however far the list already moved.
  const dragOrigin = useSharedValue(0);
  // Previous frame's translation, to read the finger's direction of travel.
  const previousTranslation = useSharedValue(0);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  useEffect(() => {
    sharedOffsets.value = offsets;
    sharedIndexShift.value = indexShift;
    sharedExpandedHeight.value = expandedHeight;
  }, [expandedHeight, indexShift, offsets, sharedExpandedHeight, sharedIndexShift, sharedOffsets]);

  // Animate to the controlled index (also re-settles after rotation).
  useEffect(() => {
    currentIndex.value = index;
    translateY.value = withSpring(offsets[positionOf(index)], SPRING_CONFIG);
  }, [currentIndex, index, offsets, positionOf, translateY]);

  useAnimatedReaction(
    () => translateY.value,
    (current) => {
      const list = sharedOffsets.value;

      if (progress) {
        progress.value = interpolate(current, [list[list.length - 1], list[0]], [1, 0], 'clamp');
      }

      if (visibleHeight) {
        visibleHeight.value = Math.max(0, sharedExpandedHeight.value - current);
      }
    },
    [progress, visibleHeight],
  );

  const drag = (translationY: number, allowRubberBand: boolean) => {
    'worklet';
    const list = sharedOffsets.value;
    const next = gestureStartY.value + translationY;
    const minimum = list[list.length - 1];
    const maximum = list[0];

    if (next < minimum) {
      translateY.value = allowRubberBand ? minimum + (next - minimum) * RUBBER_BAND : minimum;
      return;
    }

    if (next > maximum) {
      translateY.value = allowRubberBand ? maximum + (next - maximum) * RUBBER_BAND : maximum;
      return;
    }

    translateY.value = next;
  };

  // Single path to a snap point, shared by drags and by the handle tap, so the
  // parent only hears about real changes (one haptic per settle, not per touch).
  const snapToPosition = (position: number) => {
    'worklet';
    const list = sharedOffsets.value;
    const next = (position - sharedIndexShift.value) as SheetSnapIndex;

    translateY.value = withSpring(list[position], SPRING_CONFIG);

    if (currentIndex.value !== next) {
      currentIndex.value = next;
      runOnJS(onIndexChange)(next);
    }
  };

  const snapToIndex = (snapIndex: SheetSnapIndex) => {
    'worklet';
    const list = sharedOffsets.value;
    const position = Math.min(Math.max(snapIndex + sharedIndexShift.value, 0), list.length - 1);

    snapToPosition(position);
  };

  const settle = (velocityY: number) => {
    'worklet';
    const list = sharedOffsets.value;
    const projected = clamp(translateY.value + velocityY * VELOCITY_PROJECTION, list[list.length - 1], list[0]);

    let closest = 0;
    let smallestDistance = Math.abs(projected - list[0]);

    for (let candidate = 1; candidate < list.length; candidate += 1) {
      const distance = Math.abs(projected - list[candidate]);

      if (distance < smallestDistance) {
        smallestDistance = distance;
        closest = candidate;
      }
    }

    snapToPosition(closest);
  };

  // Dragging the handle always moves the sheet. It waits for a few pixels of
  // travel so a stationary touch stays a tap.
  const handlePan = Gesture.Pan()
    .activeOffsetY([-PAN_ACTIVATION_DISTANCE, PAN_ACTIVATION_DISTANCE])
    .onStart(() => {
      gestureStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      drag(event.translationY, true);
    })
    .onEnd((event) => {
      settle(event.velocityY);
    });

  // Tapping the grabber expands the sheet, and taps it back down once expanded.
  const handleTap = Gesture.Tap()
    .maxDuration(400)
    .maxDistance(PAN_ACTIVATION_DISTANCE * 2)
    .onEnd((_event, success) => {
      if (!success) {
        return;
      }

      snapToIndex(currentIndex.value === tapExpandedIndex ? tapCollapsedIndex : tapExpandedIndex);
    });

  // Exclusive, so the drag has outright priority: the tap only gets its turn once
  // the pan has failed, i.e. the finger lifted without travelling far enough.
  const handleGesture = Gesture.Exclusive(handlePan, handleTap);

  // Native scroll gesture for the inner list, so pan and scroll can coexist.
  const innerScrollGesture = Gesture.Native();

  /**
   * One continuous drag can belong to the sheet, to the list, or to the sheet and
   * then the list. Google Maps' rule, reproduced here: below full height the drag
   * resizes the sheet and the list stays pinned at its top; at full height the
   * list scrolls, and only a downward drag with the list already at its top hands
   * control back to the sheet.
   */
  const contentGesture = Gesture.Pan()
    .simultaneousWithExternalGesture(innerScrollGesture)
    .onStart(() => {
      isDraggingSheet.value = false;
      dragOrigin.value = 0;
      previousTranslation.value = 0;
    })
    .onUpdate((event) => {
      const list = sharedOffsets.value;
      const expandedOffset = list[list.length - 1];
      // Direction of this frame, not of the gesture so far. A drag that goes up,
      // hands off to the list, then reverses has a cumulative translation that
      // still reads as "up" long after the finger turned around.
      const isMovingDown = event.translationY > previousTranslation.value;
      const isMovingUp = event.translationY < previousTranslation.value;
      previousTranslation.value = event.translationY;

      if (!isDraggingSheet.value) {
        const isExpanded = translateY.value <= expandedOffset + EXPANDED_EPSILON;
        const claimsDrag = !isExpanded || (isMovingDown && innerScrollY.value <= 0);

        if (!claimsDrag) {
          // The list owns this drag — leave it to the native scroll view.
          return;
        }

        // Rebase on the translation so far, so a mid-gesture takeover doesn't
        // jerk the sheet by however far the list already moved. This frame has
        // zero travel by definition; the sheet starts moving on the next one.
        isDraggingSheet.value = true;
        gestureStartY.value = translateY.value;
        dragOrigin.value = event.translationY;
        return;
      }

      drag(event.translationY - dragOrigin.value, false);

      // While the sheet is still travelling, hold the list at its top so the two
      // never move at once.
      if (translateY.value > expandedOffset + EXPANDED_EPSILON) {
        scrollTo(scrollRef, 0, 0, false);
        innerScrollY.value = 0;
        return;
      }

      // The sheet is against its full-height stop. Hand the rest of the gesture
      // to the list only if the finger is still travelling upward — otherwise
      // this is the start of a downward drag, which is the sheet's to keep.
      if (!isMovingUp) {
        return;
      }

      // Commit the index here: the rest of this gesture is a list scroll, so
      // `onEnd` will not settle the sheet.
      const expandedIndex = (list.length - 1 - sharedIndexShift.value) as SheetSnapIndex;

      if (currentIndex.value !== expandedIndex) {
        currentIndex.value = expandedIndex;
        runOnJS(onIndexChange)(expandedIndex);
      }

      isDraggingSheet.value = false;
      dragOrigin.value = event.translationY;
    })
    .onEnd((event) => {
      if (!isDraggingSheet.value) {
        // Pure list scroll: let the native momentum run untouched.
        return;
      }

      isDraggingSheet.value = false;
      settle(event.velocityY);
    });

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      innerScrollY.value = event.contentOffset.y;
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Cross-fade the grabber into the minimized bar over the last stretch of travel,
  // so the strip reads as a button by the time it is all that's left on screen.
  const minimizedProgress = () => {
    'worklet';
    const list = sharedOffsets.value;

    if (list.length < 2) {
      return 0;
    }

    return interpolate(translateY.value, [list[1], list[0]], [0, 1], 'clamp');
  };

  const grabberStyle = useAnimatedStyle(() => ({
    opacity: hasMinimized ? 1 - minimizedProgress() : 1,
  }));

  const minimizedBarStyle = useAnimatedStyle(() => ({
    opacity: hasMinimized ? minimizedProgress() : 0,
  }));

  // Nested Pressables negotiate through the RN responder system, so a button
  // inside the sheet handles its own press and this never fires for it.
  const handleContentPress = useCallback(() => {
    if (!expandOnContentTap || index === tapExpandedIndex) {
      return;
    }

    onIndexChange(tapExpandedIndex);
  }, [expandOnContentTap, index, onIndexChange, tapExpandedIndex]);

  return (
    <Animated.View style={[styles.sheet, surfaceStyle, { height: expandedHeight }, sheetStyle]}>
      <GestureDetector gesture={handleGesture}>
        <View
          style={styles.handleZone}
          accessibilityLabel={index === -1 && minimizedLabel ? minimizedLabel : 'Details panel'}
          accessibilityHint="Tap to expand or collapse, or drag to resize"
          accessibilityRole="adjustable"
        >
          <Animated.View
            style={[styles.handle, handleColor ? { backgroundColor: handleColor } : null, grabberStyle]}
          />

          {minimizedLabel ? (
            <Animated.View style={[styles.minimizedBar, minimizedBarStyle]} pointerEvents="none">
              <ChevronUp size={20} color={handleColor ?? colors.muted} />
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {minimizedLabel}
              </AppText>
            </Animated.View>
          ) : null}
        </View>
      </GestureDetector>

      <GestureDetector gesture={contentGesture}>
        <GestureDetector gesture={innerScrollGesture}>
          <Animated.ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={{ paddingBottom: bottomInset + spacing['2xl'] }}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              style={[styles.scrollContent, contentStyle]}
              onPress={handleContentPress}
              accessible={false}
            >
              {children}
            </Pressable>
          </Animated.ScrollView>
        </GestureDetector>
      </GestureDetector>
    </Animated.View>
  );
}

function clampPosition(position: number, length: number) {
  return Math.min(Math.max(position, 0), length - 1);
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    backgroundColor: colors.card,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 16,
    zIndex: 10,
  },
  handleZone: {
    // Fixed rather than padded: this height is also the sheet's height at the
    // minimized detent, so it has to be a number the layout agrees on.
    height: HANDLE_ZONE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: radius.round,
    backgroundColor: colors.borderStrong,
  },
  minimizedBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    // Left aligned, chevron first, the way Google Maps reads.
    justifyContent: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
});
