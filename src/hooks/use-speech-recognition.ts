import { useState, useEffect, useCallback, useRef } from 'react';

// Extend window object to include the standard and webkit prefixes for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function useSpeechRecognition() {
  const [isRecording, setIsRecording] = useState(false);
  const [hasSupport, setHasSupport] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check if the browser supports speech recognition
    const defaultSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!defaultSpeechRecognition) {
      setHasSupport(false);
      return;
    }

    // Initialize the recognition engine once
    const recognition = new defaultSpeechRecognition();
    recognition.continuous = true; // Keep recognizing as long as the mic is on
    recognition.interimResults = true; // Provide real-time interim results
    recognition.lang = 'en-US';

    recognition.onend = () => {
      // The recognition automatically stops after some silence. We want to restart if it's supposed to be recording.
      // Wait, we need a ref to access the latest isRecording state
    };
    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Update onend whenever isRecording changes to handle auto-restart if needed
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = () => {
        // Auto-stop is the standard behavior in many browsers unless they are manually started.
        // We disable continuous mode looping here to avoid error 500 when they stop speaking. Let it stop naturally.
        setIsRecording(false);
      };
    }
  }, [isRecording]);

  const startRecording = useCallback((onResult: (transcript: string, isFinal: boolean) => void) => {
    if (!hasSupport || !recognitionRef.current) return;

    try {
      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }





        // Just pass back the most complete transcript (concatenating existing and new if needed)
        // Actually, we pass the current state of speech to the caller
        onResult(event.results[event.results.length - 1][0].transcript, event.results[event.results.length - 1].isFinal);
      };

      recognitionRef.current.start();
      setIsRecording(true);
    } catch (e) {
      console.error('Speech recognition error:', e);
      // It might already be started
    }
  }, [hasSupport]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  return {
    isRecording,
    hasSupport,
    startRecording,
    stopRecording
  };
}
