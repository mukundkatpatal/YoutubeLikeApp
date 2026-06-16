const databaseName = "sane-videos-kids";
const storeName = "cache";

type CacheEntry<T> = {
  value: T;
  savedAt: string;
};

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const db = await openDatabase();
    const entry = await requestToPromise<CacheEntry<T> | undefined>(
      db.transaction(storeName, "readonly").objectStore(storeName).get(key)
    );
    db.close();
    return entry?.value ?? null;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDatabase();
    await requestToPromise(
      db.transaction(storeName, "readwrite").objectStore(storeName).put({
        value,
        savedAt: new Date().toISOString()
      }, key)
    );
    db.close();
  } catch {
    // Cache failures should never block a child from viewing fresh API data.
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
