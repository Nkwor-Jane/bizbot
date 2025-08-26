"use client"
import React, { useState, useRef } from 'react';
import { Mic, MicOff, Play, Pause, Trash2, Download } from 'lucide-react';

interface Recording {
  id: number;
  url: string;
  blob: Blob;
  duration: number;
  timestamp: string;
}

const VoiceRecorderApp: React.FC = () => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<{ [key: number]: HTMLAudioElement }>({});

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });
      
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Create new recording object
        const newRecording: Recording = {
          id: Date.now(),
          url: audioUrl,
          blob: audioBlob,
          duration: recordingTime,
          timestamp: new Date().toLocaleString()
        };
        
        setRecordings(prev => [newRecording, ...prev]);
        
        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = (): void => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setRecordingTime(0);
    }
  };

  const playRecording = (recording: Recording): void => {
    const audio = audioRefs.current[recording.id];
    
    if (playingId === recording.id) {
      // Pause current playing
      audio.pause();
      setPlayingId(null);
    } else {
      // Stop any currently playing audio
      Object.values(audioRefs.current).forEach(a => a.pause());
      
      // Play selected recording
      audio.play();
      setPlayingId(recording.id);
    }
  };

  const deleteRecording = (id: number): void => {
    const recording = recordings.find(r => r.id === id);
    if (recording) {
      URL.revokeObjectURL(recording.url);
    }
    setRecordings(prev => prev.filter(r => r.id !== id));
    if (playingId === id) {
      setPlayingId(null);
    }
  };

  const downloadRecording = (recording: Recording): void => {
    const a = document.createElement('a');
    a.href = recording.url;
    a.download = `voice-recording-${recording.id}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">Voice Recorder</h1>
      
      {/* Recording Controls */}
      <div className="flex flex-col items-center mb-6">
        <div className="flex gap-4 mb-4">
          <button
            onClick={startRecording}
            disabled={isRecording}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all ${
              isRecording 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl'
            }`}
          >
            <Mic size={20} />
            {isRecording ? 'Recording...' : 'Start Recording'}
          </button>
          
          <button
            onClick={stopRecording}
            disabled={!isRecording}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all ${
              !isRecording 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-gray-700 hover:bg-gray-800 text-white shadow-lg hover:shadow-xl'
            }`}
          >
            <MicOff size={20} />
            Stop
          </button>
        </div>
        
        {isRecording && (
          <div className="text-center">
            <div className="text-2xl font-mono text-red-500 mb-2">
              {formatTime(recordingTime)}
            </div>
            <div className="flex justify-center">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        )}
      </div>

      {/* Recordings List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">
          Recordings ({recordings.length})
        </h2>
        
        {recordings.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No recordings yet</p>
        ) : (
          recordings.map((recording) => (
            <div key={recording.id} className="bg-gray-50 rounded-lg p-4 border">
              {/* Hidden audio element for each recording */}
              <audio
                ref={(el: HTMLAudioElement | null) => {
                  if (el) {
                    audioRefs.current[recording.id] = el;
                  }
                }}
                src={recording.url}
                onEnded={() => setPlayingId(null)}
              />
              
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm text-gray-600 mb-1">
                    {recording.timestamp}
                  </div>
                  <div className="text-sm text-gray-500">
                    Duration: {formatTime(recording.duration)}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => playRecording(recording)}
                    className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors"
                    title={playingId === recording.id ? 'Pause' : 'Play'}
                  >
                    {playingId === recording.id ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  
                  <button
                    onClick={() => downloadRecording(recording)}
                    className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors"
                    title="Download"
                  >
                    <Download size={16} />
                  </button>
                  
                  <button
                    onClick={() => deleteRecording(recording.id)}
                    className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default VoiceRecorderApp;