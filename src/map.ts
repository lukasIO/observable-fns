import { AsyncSerialScheduler } from "./_scheduler"
import Observable, { ObservableLike } from "./observable"
import unsubscribe from "./unsubscribe"

function map<In, Out>(
  observable: ObservableLike<In>,
  mapper: (input: In) => Promise<Out> | Out
): Observable<Out> {
  return new Observable<Out>(observer => {
    const scheduler = new AsyncSerialScheduler(observer)

    const subscription = observable.subscribe({
      complete() {
        scheduler.complete()
      },
      error(error) {
        scheduler.error(error)
      },
      next(input) {
        scheduler.schedule(async next => {
          const mapped = await mapper(input)
          next(mapped)
        })
      }
    })
    return () => unsubscribe(subscription)
  })
}

export default map
