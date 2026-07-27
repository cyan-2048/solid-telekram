export function combineAbortSignals(signal1: AbortSignal, signal2?: AbortSignal): AbortSignal {
  if (!signal2) return signal1

  // return AbortSignal.any([signal1, signal2])

  if (signal1.aborted) return AbortSignal.abort(signal1.reason)
  if (signal2.aborted) return AbortSignal.abort(signal2.reason)

  const controller = new AbortController()

  function abort(this: AbortSignal) {
    controller.abort(this.reason)
    signal1.removeEventListener('abort', abort)
    signal2!.removeEventListener('abort', abort)
  }

  signal1.addEventListener('abort', abort)
  signal2.addEventListener('abort', abort)

  return controller.signal
}
