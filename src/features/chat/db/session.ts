export class SessionStorage {
  private dbName = 'ChatApp';
  private dbVersion = 1;
  private storeName = 'sessions';

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });
  }

  async getSessionIds(): Promise<string[]> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.get('sessionIds');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result?.sessions || []);
      };
    });
  }

  async addSessionId(sessionId: string): Promise<void> {
    const currentSessions = await this.getSessionIds();
    
    // Avoid duplicates
    if (!currentSessions.includes(sessionId)) {
      const updatedSessions = [sessionId, ...currentSessions]; // Add new session at the beginning
      
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.put({ id: 'sessionIds', sessions: updatedSessions });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    }
  }

  async removeSessionId(sessionId: string): Promise<void> {
    const currentSessions = await this.getSessionIds();
    const updatedSessions = currentSessions.filter(id => id !== sessionId);
    
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.put({ id: 'sessionIds', sessions: updatedSessions });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearAllSessions(): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.put({ id: 'sessionIds', sessions: [] });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

export const sessionStorage = new SessionStorage();