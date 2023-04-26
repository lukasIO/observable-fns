import Observable, { ObservableLike, Subscription } from "./observable.js";
import unsubscribe from "./unsubscribe.js";

function switchMap<In, Out>(mapper: (value: In) => Observable<Out>) {
  return (source: ObservableLike<In>) =>
    new Observable<Out>((subscriber) => {
      let innerSubscriber: Subscription<Out> | null = null;

      // Whether or not the source subscription has completed
      let isComplete = false;

      const checkCompleted = () =>
        isComplete && !innerSubscriber && subscriber.complete();
      const cleanup = () => {
        innerSubscriber?.unsubscribe();
        unsubscribe(outerSubscriber);
      };

      const outerSubscriber = source.subscribe({
        next(x) {
          innerSubscriber?.unsubscribe();
          innerSubscriber = mapper(x).subscribe({
            next(innerVal) {
              subscriber.next(innerVal);
            },
            complete() {
              innerSubscriber = null;
              checkCompleted();
            },
          });
        },
        complete() {
          isComplete = true;
          checkCompleted();
        },
      });
      return () => {
        cleanup();
      };
    });
}

export default switchMap;
