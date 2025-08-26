"use client"
import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Play, Pause, Trash2, Download } from 'lucide-react';

// Domain Models
interface Recording {
  readonly id: number;
  readonly url?: string;
  readonly blob: Blob;
  readonly duration: number;
  readonly timestamp: string;
  readonly name?: string;
}

// Value Objects
class Duration {
  constructor(private readonly seconds: number) {
    if (seconds < 0) throw new Error('Duration cannot be negative');
  }

  toString(): string {
    const mins = Math.floor(this.seconds / 60);
    const secs = this.seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  get value(): number {
    return this.seconds;
  }
}

// Repository Interface (following ISP)
interface IRecordingRepository {
  save(recording: Recording): Promise<void>;
  findAll(): Promise<Recording[]>;
  delete(id: number): Promise<void>;
  clear(): Promise<void>;
}

// Repository Implementation
class IndexedDBRecordingRepository implements IRecordingRepository {
  private readonly dbName = 'VoiceRecorderDB';
  private readonly version = 1;
  private readonly storeName = 'recordings';
  private db: IDBDatabase | null = null;

  private async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(new Error('Failed to open database'));
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async save(recording: Recording): Promise<void> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const recordingToStore = { ...recording };
      delete recordingToStore.url;
      
      const request = store.put(recordingToStore);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save recording'));
    });
  }

  async findAll(): Promise<Recording[]> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const recordings = request.result.map((recording: Recording) => ({
          ...recording,
          url: URL.createObjectURL(recording.blob)
        }));
        resolve(recordings);
      };
      
      request.onerror = () => reject(new Error('Failed to fetch recordings'));
    });
  }

  async delete(id: number): Promise<void> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete recording'));
    });
  }

  async clear(): Promise<void> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear recordings'));
    });
  }
}

// Service Interfaces (following ISP)
interface IAudioRecorder {
  startRecording(): Promise<void>;
  stopRecording(): Promise<Blob>;
  isRecording(): boolean;
}

interface IAudioPlayer {
  play(recording: Recording): void;
  pause(): void;
  getCurrentPlayingId(): number | null;
}

// Audio Recorder Service
class WebAudioRecorder implements IAudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async startRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      });

      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.start();
    } catch (error) {
      throw new Error('Failed to access microphone. Please check permissions.');
    }
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
        reject(new Error('No active recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.cleanup();
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}

// Audio Player Service
class WebAudioPlayer implements IAudioPlayer {
  private currentPlayingId: number | null = null;
  private audioElements: Map<number, HTMLAudioElement> = new Map();

  play(recording: Recording): void {
    const audio = this.getOrCreateAudioElement(recording);
    
    if (this.currentPlayingId === recording.id) {
      audio.pause();
      this.currentPlayingId = null;
    } else {
      this.stopAllAudio();
      audio.play();
      this.currentPlayingId = recording.id;
    }
  }

  pause(): void {
    this.stopAllAudio();
    this.currentPlayingId = null;
  }

  getCurrentPlayingId(): number | null {
    return this.currentPlayingId;
  }

  private getOrCreateAudioElement(recording: Recording): HTMLAudioElement {
    let audio = this.audioElements.get(recording.id);
    
    if (!audio) {
      audio = new Audio(recording.url);
      audio.onended = () => {
        this.currentPlayingId = null;
      };
      this.audioElements.set(recording.id, audio);
    }
    
    return audio;
  }

  private stopAllAudio(): void {
    this.audioElements.forEach(audio => audio.pause());
  }
}

// Custom Hooks (following SRP)
const useRecordingTimer = () => {
  const [time, setTime] = useState(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isActive) {
      interval = setInterval(() => {
        setTime(prevTime => prevTime + 1);
      }, 1000);
    } else if (!isActive && time !== 0) {
      setTime(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, time]);

  const start = () => setIsActive(true);
  const stop = () => setIsActive(false);

  return { time, start, stop, isActive };
};

const useRecordings = (repository: IRecordingRepository) => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRecordings = async () => {
    try {
      const savedRecordings = await repository.findAll();
      setRecordings(savedRecordings);
    } catch (error) {
      console.error('Error loading recordings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addRecording = async (recording: Recording) => {
    try {
      await repository.save(recording);
      setRecordings(prev => [recording, ...prev]);
    } catch (error) {
      console.error('Error saving recording:', error);
      throw error;
    }
  };

  const removeRecording = async (id: number) => {
    try {
      await repository.delete(id);
      
      const recording = recordings.find(r => r.id === id);
      if (recording?.url) {
        URL.revokeObjectURL(recording.url);
      }
      
      setRecordings(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error deleting recording:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadRecordings();
  }, []);

  return { recordings, addRecording, removeRecording, isLoading };
};

// Main Component (following SRP and Clean Architecture)
const VoiceRecorderApp: React.FC = () => {
  // Dependencies
  // const repository = new IndexedDBRecordingRepository();
  // const audioRecorder = new WebAudioRecorder();
  // const audioPlayer = new WebAudioPlayer();

    const repository = React.useMemo(() => new IndexedDBRecordingRepository(), []);
  const audioRecorderRef = React.useRef<IAudioRecorder>(new WebAudioRecorder());
  const audioPlayerRef = React.useRef<IAudioPlayer>(new WebAudioPlayer());

  const audioRecorder = audioRecorderRef.current;
  const audioPlayer = audioPlayerRef.current;

  // State Management
  const [isRecording, setIsRecording] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState<number | null>(null);
  
  // Custom Hooks
  const { time, start: startTimer, stop: stopTimer, isActive: isTimerActive } = useRecordingTimer();
  const { recordings, addRecording, removeRecording, isLoading } = useRecordings(repository);

  // Event Handlers
  const handleStartRecording = async (): Promise<void> => {
    try {
      await audioRecorder.startRecording();
      setIsRecording(true);
      startTimer();
    } catch (error) {
       console.log(error)
      alert("error?.message");
    }
  };

  const handleStopRecording = async (): Promise<void> => {
    try {
      const blob = await audioRecorder.stopRecording();
      setIsRecording(false);
      stopTimer();

      const recording: Recording = {
        id: Date.now(),
        url: URL.createObjectURL(blob),
        blob,
        duration: time,
        timestamp: new Date().toLocaleString()
      };

      await addRecording(recording);
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  const handlePlayRecording = (recording: Recording): void => {
    audioPlayer.play(recording);
    setCurrentPlayingId(audioPlayer.getCurrentPlayingId());
  };

  const handleDownloadRecording = (recording: Recording): void => {
    const link = document.createElement('a');
    link.href = recording.url!;
    link.download = `voice-recording-${recording.id}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteRecording = async (id: number): Promise<void> => {
    if (currentPlayingId === id) {
      audioPlayer.pause();
      setCurrentPlayingId(null);
    }
    await removeRecording(id);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <Header />
      
      <RecordingControls
        isRecording={isRecording}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
      />
      
      {isRecording && (
        <RecordingTimer duration={new Duration(time)} />
      )}
      
      <RecordingsList
        recordings={recordings}
        currentPlayingId={currentPlayingId}
        onPlay={handlePlayRecording}
        onDownload={handleDownloadRecording}
        onDelete={handleDeleteRecording}
      />
    </div>
  );
};

// Sub-components (following SRP)
const LoadingSpinner: React.FC = () => (
  <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      <span className="ml-2 text-gray-600">Loading recordings...</span>
    </div>
  </div>
);

const Header: React.FC = () => (
  <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
    Voice Recorder
  </h1>
);

interface RecordingControlsProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

const RecordingControls: React.FC<RecordingControlsProps> = ({
  isRecording,
  onStartRecording,
  onStopRecording
}) => (
  <div className="flex justify-center gap-4 mb-4">
    <button
      onClick={onStartRecording}
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
      onClick={onStopRecording}
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
);

interface RecordingTimerProps {
  duration: Duration;
}

const RecordingTimer: React.FC<RecordingTimerProps> = ({ duration }) => (
  <div className="text-center mb-6">
    <div className="text-2xl font-mono text-red-500 mb-2">
      {duration.toString()}
    </div>
    <div className="flex justify-center">
      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
    </div>
  </div>
);

interface RecordingsListProps {
  recordings: Recording[];
  currentPlayingId: number | null;
  onPlay: (recording: Recording) => void;
  onDownload: (recording: Recording) => void;
  onDelete: (id: number) => void;
}

const RecordingsList: React.FC<RecordingsListProps> = ({
  recordings,
  currentPlayingId,
  onPlay,
  onDownload,
  onDelete
}) => (
  <div className="space-y-3">
    <RecordingsHeader count={recordings.length} />
    
    {recordings.length === 0 ? (
      <EmptyRecordingsMessage />
    ) : (
      recordings.map((recording) => (
        <RecordingItem
          key={recording.id}
          recording={recording}
          isPlaying={currentPlayingId === recording.id}
          onPlay={() => onPlay(recording)}
          onDownload={() => onDownload(recording)}
          onDelete={() => onDelete(recording.id)}
        />
      ))
    )}
  </div>
);

interface RecordingsHeaderProps {
  count: number;
}

const RecordingsHeader: React.FC<RecordingsHeaderProps> = ({ count }) => (
  <div className="flex justify-between items-center mb-3">
    <h2 className="text-lg font-semibold text-gray-700">
      Recordings ({count})
    </h2>
    <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
      ✓ Saved locally
    </div>
  </div>
);

const EmptyRecordingsMessage: React.FC = () => (
  <p className="text-gray-500 text-center py-8">No recordings yet</p>
);

interface RecordingItemProps {
  recording: Recording;
  isPlaying: boolean;
  onPlay: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

const RecordingItem: React.FC<RecordingItemProps> = ({
  recording,
  isPlaying,
  onPlay,
  onDownload,
  onDelete
}) => {
  const duration = new Duration(recording.duration);

  return (
    <div className="bg-gray-50 rounded-lg p-4 border">
      <div className="flex items-center justify-between">
        <RecordingInfo
          timestamp={recording.timestamp}
          duration={duration}
        />
        
        <RecordingActions
          isPlaying={isPlaying}
          onPlay={onPlay}
          onDownload={onDownload}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
};

interface RecordingInfoProps {
  timestamp: string;
  duration: Duration;
}

const RecordingInfo: React.FC<RecordingInfoProps> = ({ timestamp, duration }) => (
  <div className="flex-1">
    <div className="text-sm text-gray-600 mb-1">
      {timestamp}
    </div>
    <div className="text-sm text-gray-500">
      Duration: {duration.toString()}
    </div>
  </div>
);

interface RecordingActionsProps {
  isPlaying: boolean;
  onPlay: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

const RecordingActions: React.FC<RecordingActionsProps> = ({
  isPlaying,
  onPlay,
  onDownload,
  onDelete
}) => (
  <div className="flex gap-2">
    <ActionButton
      onClick={onPlay}
      className="bg-blue-500 hover:bg-blue-600"
      title={isPlaying ? 'Pause' : 'Play'}
    >
      {isPlaying ? <Pause size={16} /> : <Play size={16} />}
    </ActionButton>
    
    <ActionButton
      onClick={onDownload}
      className="bg-green-500 hover:bg-green-600"
      title="Download"
    >
      <Download size={16} />
    </ActionButton>
    
    <ActionButton
      onClick={onDelete}
      className="bg-red-500 hover:bg-red-600"
      title="Delete"
    >
      <Trash2 size={16} />
    </ActionButton>
  </div>
);

interface ActionButtonProps {
  onClick: () => void;
  className: string;
  title: string;
  children: React.ReactNode;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  className,
  title,
  children
}) => (
  <button
    onClick={onClick}
    className={`p-2 text-white rounded-full transition-colors ${className}`}
    title={title}
  >
    {children}
  </button>
);

export default VoiceRecorderApp;