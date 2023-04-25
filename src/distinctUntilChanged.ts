import Observable, { ObservableLike } from "./observable.js";
import unsubscribe from "./unsubscribe.js";

export function distinctUntilChanged<T>() {
  let latest: T | undefined;
  return (source: ObservableLike<T>): Observable<T> => {
    return new Observable((subscriber) => {
      const sub = source.subscribe({
        next(x) {
          if (latest !== x) {
            subscriber.next(x);
            latest = x;
          }
        },
        complete() {
          subscriber.complete();
        },
        error(e) {
          subscriber.error(e);
        },
      });
      return () => unsubscribe(sub);
    });
  };
}

export default distinctUntilChanged;
