// Offline action queue — stores processInventoryAction payloads in localStorage
// and replays them when connectivity returns. Keeps the queue small and simple.

const QUEUE_KEY = "stockr_offline_queue";

export function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch { return []; }
}

function saveQueue(queue) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch {}
}

export function enqueueAction(payload) {
  const queue = getQueue();
  const id = (crypto?.randomUUID?.() || String(Date.now()) + "-" + Math.random().toString(36).slice(2));
  const item = { _id: id, _queuedAt: new Date().toISOString(), payload };
  queue.push(item);
  saveQueue(queue);
  return id;
}

export function removeFromQueue(id) {
  saveQueue(getQueue().filter(item => item._id !== id));
}

export function getQueueLength() {
  return getQueue().length;
}