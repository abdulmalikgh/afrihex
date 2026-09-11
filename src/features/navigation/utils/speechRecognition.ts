/**
 * Guarded access to `expo-speech-recognition`.
 *
 * The package is a native module: installing it adds the JavaScript, but the
 * native side only exists once the app binary is rebuilt. A dev client built
 * before the install therefore has the JS present and the native module
 * missing, and importing it directly throws at module scope — which takes the
 * whole route down with it, including the parts that do not need speech.
 *
 * Requiring it behind a try/catch turns that into a feature flag. The value is
 * fixed for the life of the process, so components can branch on it safely.
 */

type SpeechModule = typeof import('expo-speech-recognition');

let speechModule: SpeechModule | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  speechModule = require('expo-speech-recognition') as SpeechModule;
} catch {
  speechModule = null;
}

export const isSpeechRecognitionAvailable =
  speechModule !== null && speechModule.ExpoSpeechRecognitionModule !== undefined;

/**
 * Only read after checking {@link isSpeechRecognitionAvailable}. Kept non-null
 * for callers that have already branched, rather than forcing a null check at
 * every call site inside the capture component.
 */
export const speechRecognition = speechModule;
