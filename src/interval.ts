import { Observable } from "./observable.js";

/**
 * Creates an observable that yields a new value every `period` milliseconds.
 * The first value emitted is 0, then 1, 2, etc. The first value is not emitted
 * immediately, but after the first interval.
 */
export default function interval(period: number) {
  return new Observable<number>((observer) => {
    let counter = 0;

    const handle = setInterval(() => {
      observer.next(counter++);
    }, period);

    return () => clearInterval(handle);
  });
}
