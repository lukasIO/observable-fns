import Observable, { ObservableLike, Subscription } from "./observable.js";
import unsubscribe from "./unsubscribe.js";

function switchMap<In, Out>(mapper: (value: In) => Observable<Out>) {
  return (source: ObservableLike<In>) =>
    new Observable<Out>((subscriber) => {
      let innerSubscriber: Subscription<Out> | null = null;
      let innerObservable: Observable<Out>;

      // Whether or not the source subscription has completed
      let isComplete = false;

      const checkCompleted = () =>
        isComplete && !innerSubscriber && subscriber.complete();
      const cleanup = () => {
        innerSubscriber?.unsubscribe();
        unsubscribe(outerSubscriber);
      };

      const outerSubscriber = source.subscribe({
        start(sub) {
          // Cancel the previous inner subscription if there was one
          innerSubscriber?.unsubscribe();
          return sub;
        },
        next(x) {
          innerSubscriber?.unsubscribe();
          innerObservable = mapper(x);
          innerSubscriber = innerObservable.subscribe({
            next(x) {
              subscriber.next(x);
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
