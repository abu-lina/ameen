import type { DeviceLibrary, Topic } from './community-types'

export const LIBRARY_KEY = 'still.device-library.v1'
export const topics: Topic[] = ['Life', 'Creativity', 'Growth', 'Connection']
export const emptyLibrary = (): DeviceLibrary => ({
  version: 1, keys: [], history: [], outbox: [], draft: { text: '', topic: 'Life' },
})
export const newDeviceKey = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join('')

export function parseLibrary(raw: string | null): DeviceLibrary {
  if (!raw) return emptyLibrary()
  const data = JSON.parse(raw)
  if (data?.version !== 1 || !Array.isArray(data.keys) || !Array.isArray(data.history) || !Array.isArray(data.outbox) ||
      !data.draft || typeof data.draft.text !== 'string' || !topics.includes(data.draft.topic)) {
    throw new Error('This browser’s saved library could not be read. It has not been overwritten.')
  }
  if (!data.keys.every((key: unknown) => typeof key === 'string' && /^[a-f0-9]{64}$/.test(key)) ||
    !data.history.every((entry: DeviceLibrary['history'][number]) =>
      entry && typeof entry.key === 'string' && typeof entry.card?.id === 'string' && typeof entry.card.text === 'string' &&
      topics.includes(entry.card.topic) && ['pass', 'save', 'resonate'].includes(entry.action) && Number.isFinite(entry.createdAt)) ||
    !data.outbox.every((entry: DeviceLibrary['outbox'][number]) =>
      entry && typeof entry.key === 'string' && typeof entry.card === 'string' &&
      ['pass', 'save', 'resonate'].includes(entry.action) && typeof entry.undo === 'boolean' && Number.isFinite(entry.createdAt))) {
    throw new Error('This browser’s saved library needs attention. It has not been overwritten.')
  }
  return data
}

export const readLibrary = () => parseLibrary(localStorage.getItem(LIBRARY_KEY))
export function writeLibrary(library: DeviceLibrary) {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library))
}
