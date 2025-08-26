// utils/indexedDB.ts
interface Recording {
  id: number;
  url?: string; // Will be created from blob when loaded
  blob: Blob;
  duration: number;
  timestamp: string;
  name?: string;
}

class VoiceRecordingDB {
  private dbName = 'VoiceRecorderDB';
  private version = 1;
  private storeName = 'recordings';
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async saveRecording(recording: Recording): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      // Remove URL before storing (we'll recreate it when loading)
      const recordingToStore = { ...recording };
      delete recordingToStore.url;
      
      const request = store.put(recordingToStore);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllRecordings(): Promise<Recording[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const recordings = request.result.map((recording: Recording) => ({
          ...recording,
          url: URL.createObjectURL(recording.blob) // Recreate URL from blob
        }));
        resolve(recordings);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRecording(id: number): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllRecordings(): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const voiceRecordingDB = new VoiceRecordingDB();
export type { Recording };