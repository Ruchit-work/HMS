declare module 'react-speech-recognition' {
  export interface SpeechRecognitionOptions {
    continuous?: boolean
    language?: string
    interimResults?: boolean
  }

  export interface SpeechRecognitionState {
    transcript: string
    listening: boolean
    resetTranscript: () => void
    browserSupportsSpeechRecognition: boolean
  }

  export function useSpeechRecognition(): SpeechRecognitionState

  interface SpeechRecognitionStatic {
    startListening: (options?: SpeechRecognitionOptions) => void
    stopListening: () => void
  }

  const SpeechRecognition: SpeechRecognitionStatic
  export default SpeechRecognition
}
