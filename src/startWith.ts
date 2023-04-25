import Observable, { ObservableLike } from "./observable.js";
import unsubscribe from "./unsubscribe.js";

function startWith<T>(input: T) {
  return (source: ObservableLike<T>): Observable<T> => {
    return new Observable((subscriber) => {
      const subscription = Observable.of(input)
        .concat(Observable.from(source))
        .subscribe(subscriber);

      return () => unsubscribe(subscription);
    });
  };
}

export default startWith;
