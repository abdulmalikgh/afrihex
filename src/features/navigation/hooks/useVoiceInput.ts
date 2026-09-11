import { useCallback, useEffect, useRef, useState } from 'react';

import { parseVoiceCommand } from '../../../api/transit';
import { hapticLight, hapticWarning } from '../../../utils/haptics';
import { isSpeechRecognitionAvailable, speechRecognition } from '../utils/speechRecognition';

type UseVoiceInputOptions = {
  /**
   * Receives the spoken destination, cleaned of command phrasing. Wired to the
   * field's own `onChangeText`, so speaking fills the input the user was
   * already looking at rather than moving them somewhere else.
   */
  onTranscript: (text: string) => void;
  /** Biases the parse toward what is near the speaker, when a fix is on hand. */
  coordinates?: { lat: number; lng: number } | null;
};

/**
 * Dictation for a location field.
 *
 * Two steps, because they are two different problems. The device transcribes —
 * that is `expo-speech-recognition`, and it knows nothing about places. Then
 * `/v2/navigate/voice-command` strips the command phrasing: "take me to Kotoka
 * Airport" becomes "Kotoka Airport", which is what a search field can actually
 * resolve. Feeding the raw transcript to the search chain instead would have it
 * hunting for a place called "take me to Kotoka Airport".
 *
 * An unrecognised phrase still fills the field with the raw transcript — the
 * documented fallback is a normal typed search, and the user can edit it.
 */
export function useVoiceInput({ onTranscript, coordinates }: UseVoiceInputOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Read inside listeners that are registered once.
  const handlerRef = useRef(onTranscript);
  const coordinatesRef = useRef(coordinates);

  handlerRef.current = onTranscript;
  coordinatesRef.current = coordinates;

  const handleFinalTranscript = useCallback(async (spoken: string) => {
    const trimmed = spoken.trim();

    if (trimmed.length === 0) {
      return;
    }

    setIsParsing(true);

    try {
      const parsed = await parseVoiceCommand({
        transcript: trimmed,
        ...(coordinatesRef.current ?? {}),
      });

      handlerRef.current(parsed.recognized && parsed.destination ? parsed.destination : trimmed);
    } catch {
      // The parse is an improvement, not a gate — a failed call still leaves
      // the user with what they said, in the field, editable.
      handlerRef.current(trimmed);
    } finally {
      setIsParsing(false);
    }
  }, []);

  useEffect(() => {
    if (!isSpeechRecognitionAvailable || !speechRecognition) {
      return;
    }

    const { ExpoSpeechRecognitionModule } = speechRecognition;

    const resultSub = ExpoSpeechRecognitionModule.addListener('result', (event) => {
      const spoken = event.results[0]?.transcript ?? '';

      // Interim results change on every syllable; only the settled phrase is
      // worth a round trip.
      if (event.isFinal) {
        void handleFinalTranscript(spoken);
      }
    });

    const endSub = ExpoSpeechRecognitionModule.addListener('end', () => {
      setIsListening(false);
    });

    const errorSub = ExpoSpeechRecognitionModule.addListener('error', (event) => {
      setIsListening(false);

      // Holding the button without speaking is not a failure.
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        hapticWarning();
        setErrorMessage('Could not hear that. Try again, or type it.');
      }
    });

    return () => {
      resultSub.remove();
      endSub.remove();
      errorSub.remove();
      ExpoSpeechRecognitionModule.abort();
    };
  }, [handleFinalTranscript]);

  const start = useCallback(async () => {
    if (!isSpeechRecognitionAvailable || !speechRecognition) {
      setErrorMessage('Speaking needs a newer build of the app. Type it instead.');
      return;
    }

    setErrorMessage(null);

    const permission = await speechRecognition.ExpoSpeechRecognitionModule.requestPermissionsAsync();

    if (!permission.granted) {
      setErrorMessage('Allow the microphone to speak a place. You can still type it.');
      return;
    }

    hapticLight();
    setIsListening(true);

    speechRecognition.ExpoSpeechRecognitionModule.start({
      // English only: the server matches rule-based English phrases, so another
      // locale would transcribe speech the parser cannot read.
      lang: 'en-GH',
      interimResults: true,
      continuous: false,
    });
  }, []);

  const stop = useCallback(() => {
    speechRecognition?.ExpoSpeechRecognitionModule.stop();
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
      return;
    }

    void start();
  }, [isListening, start, stop]);

  return {
    isAvailable: isSpeechRecognitionAvailable,
    isListening,
    isParsing,
    errorMessage,
    toggle,
    clearError: useCallback(() => setErrorMessage(null), []),
  };
}
