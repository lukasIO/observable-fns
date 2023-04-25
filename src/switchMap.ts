import Observable, { ObservableLike, Subscription } from "./observable.js";
import unsubscribe from "./unsubscribe.js";

function switchMap<In, Out>(mapper: (value: In) => Observable<Out>) {
  return (source: ObservableLike<In>) =>
    new Observable<Out>((subscriber) => {
      let innerSubscriber: Subscription<Out> | null = null;

      const outerSubscriber = source.subscribe({
        start(sub) {
          // Cancel the previous inner subscription if there was one
          innerSubscriber?.unsubscribe();
          return sub;
        },
        next(x) {
          innerSubscriber = mapper(x).subscribe((val) => {
            subscriber.next(val);
          });
        },
        complete() {
          innerSubscriber?.unsubscribe();
        },
      });
      return () => {
        if (innerSubscriber) {
          unsubscribe(innerSubscriber);
        }
        unsubscribe(outerSubscriber);
      };
    });
}

export default switchMap;
