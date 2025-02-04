/**
 * Based on <https://raw.githubusercontent.com/zenparsing/zen-observable/master/src/Observable.js>
 * At commit: f63849a8c60af5d514efc8e9d6138d8273c49ad6
 */
/// <reference path="./symbols.d.ts" />

import { getSymbol, hasSymbol, hasSymbols } from "./_symbols.js";

export type UnsubscribeFn = () => void;
export type Subscriber<T> = (
  observer: SubscriptionObserver<T>
) => UnsubscribeFn | Subscription<any> | void;

export interface ObservableLike<T> {
  subscribe: (
    observer: Observer<T>
  ) => UnsubscribeFn | { unsubscribe: UnsubscribeFn } | void;
  [Symbol.observable](): Observable<T> | ObservableLike<T>;
}

export interface Observer<T> {
  start?(subscription: Subscription<T>): any;
  next?(value: T): void;
  error?(errorValue: any): void;
  complete?(): void;
}

const SymbolIterator = getSymbol("iterator");
const SymbolObservable = getSymbol("observable");
const SymbolSpecies = getSymbol("species");

// === Abstract Operations ===

function getMethod<ObjectT extends {}>(
  obj: ObjectT,
  key: keyof ObjectT
): Function | undefined {
  const value = obj[key];

  if (value == null) {
    return undefined;
  }

  if (typeof value !== "function") {
    throw new TypeError(value + " is not a function");
  }

  return value;
}

function getSpecies<ObjectT extends {}>(obj: ObjectT) {
  let ctor: Function | undefined = obj.constructor;
  if (ctor !== undefined) {
    ctor = (ctor as any)[SymbolSpecies];
    if (ctor === null) {
      ctor = undefined;
    }
  }
  return ctor !== undefined ? ctor : Observable;
}

function isObservable(x: any): x is Observable<any> {
  return x instanceof Observable; // SPEC: Brand check
}

function hostReportError(error: Error) {
  if ((hostReportError as any).log) {
    (hostReportError as any).log(error);
  } else {
    setTimeout(() => {
      throw error;
    }, 0);
  }
}

function enqueue<Fn extends () => void>(fn: Fn) {
  Promise.resolve().then(() => {
    try {
      fn();
    } catch (e) {
      hostReportError(e as Error);
    }
  });
}

function cleanupSubscription<T>(subscription: Subscription<T>) {
  const cleanup = subscription._cleanup;
  if (cleanup === undefined) {
    return;
  }

  subscription._cleanup = undefined;

  if (!cleanup) {
    return;
  }

  try {
    if (typeof cleanup === "function") {
      cleanup();
    } else {
      const unsubscribe = getMethod(cleanup, "unsubscribe");
      if (unsubscribe) {
        unsubscribe.call(cleanup);
      }
    }
  } catch (e) {
    hostReportError(e as Error);
  }
}

function closeSubscription<T>(subscription: Subscription<T>) {
  subscription._observer = undefined;
  subscription._queue = undefined;
  subscription._state = "closed";
}

function flushSubscription<T>(subscription: Subscription<T>) {
  const queue = subscription._queue;
  if (!queue) {
    return;
  }
  subscription._queue = undefined;
  subscription._state = "ready";
  for (const item of queue) {
    notifySubscription(subscription, item.type, item.value);
    if ((subscription._state as string) === "closed") {
      break;
    }
  }
}

function notifySubscription<T>(
  subscription: Subscription<T>,
  type: "next" | "error" | "complete",
  value: T
) {
  subscription._state = "running";

  const observer = subscription._observer;

  try {
    const m = observer ? getMethod(observer, type) : undefined;
    switch (type) {
      case "next":
        if (m) m.call(observer, value);
        break;
      case "error":
        closeSubscription(subscription);
        if (m) m.call(observer, value);
        else throw value;
        break;
      case "complete":
        closeSubscription(subscription);
        if (m) m.call(observer);
        break;
    }
  } catch (e) {
    hostReportError(e as Error);
  }

  if ((subscription._state as string) === "closed") {
    cleanupSubscription(subscription);
  } else if (subscription._state === "running") {
    subscription._state = "ready";
  }
}

function onNotify<T>(
  subscription: Subscription<T>,
  type: "next" | "error" | "complete",
  value?: T
) {
  if (subscription._state === "closed") {
    return;
  }

  if (subscription._state === "buffering") {
    subscription._queue = subscription._queue || [];
    subscription._queue.push({ type, value });
    return;
  }

  if (subscription._state !== "ready") {
    subscription._state = "buffering";
    subscription._queue = [{ type, value }];
    enqueue(() => flushSubscription(subscription));
    return;
  }

  notifySubscription(subscription, type, value);
}

export class Subscription<T> {
  public _cleanup?: ReturnType<Subscriber<T>>;
  public _observer?: Observer<T>;
  public _queue?: Array<{ type: "next" | "error" | "complete"; value: any }>;
  public _state: "initializing" | "ready" | "buffering" | "running" | "closed";

  constructor(observer: Observer<T>, subscriber: Subscriber<T>) {
    // ASSERT: observer is an object
    // ASSERT: subscriber is callable

    this._cleanup = undefined;
    this._observer = observer;
    this._queue = undefined;
    this._state = "initializing";

    const subscriptionObserver = new SubscriptionObserver(this);

    try {
      this._cleanup = subscriber.call(undefined, subscriptionObserver);
    } catch (e) {
      subscriptionObserver.error(e);
    }

    if (this._state === "initializing") {
      this._state = "ready";
    }
  }

  get closed() {
    return this._state === "closed";
  }

  unsubscribe() {
    if (this._state !== "closed") {
      closeSubscription(this);
      cleanupSubscription(this);
    }
  }
}

export class SubscriptionObserver<T> {
  private _subscription: Subscription<T>;

  constructor(subscription: Subscription<T>) {
    this._subscription = subscription;
  }
  get closed() {
    return this._subscription._state === "closed";
  }
  next(value: T) {
    onNotify(this._subscription, "next", value);
  }
  error(value: any) {
    onNotify(this._subscription, "error", value);
  }
  complete() {
    onNotify(this._subscription, "complete");
  }
}

/**
 * The basic Observable class. This primitive is used to wrap asynchronous
 * data streams in a common standardized data type that is interoperable
 * between libraries and can be composed to represent more complex processes.
 */
export class Observable<T> {
  // @ts-ignore
  // FIXME
  public [Symbol.observable]: () => this;
  private _subscriber: Subscriber<T>;

  constructor(subscriber: Subscriber<T>) {
    if (!(this instanceof Observable)) {
      throw new TypeError("Observable cannot be called as a function");
    }

    if (typeof subscriber !== "function") {
      throw new TypeError("Observable initializer must be a function");
    }

    this._subscriber = subscriber;
  }

  subscribe(
    onNext: (value: T) => void,
    onError?: (error: any) => void,
    onComplete?: () => void
  ): Subscription<T>;
  subscribe(observer: Observer<T>): Subscription<T>;
  subscribe(
    nextOrObserver: Observer<T> | ((value: T) => void),
    onError?: (error: any) => void,
    onComplete?: () => void
  ): Subscription<T> {
    if (typeof nextOrObserver !== "object" || nextOrObserver === null) {
      nextOrObserver = {
        next: nextOrObserver,
        error: onError,
        complete: onComplete,
      };
    }
    return new Subscription(nextOrObserver, this._subscriber);
  }

  pipe<Out extends ObservableLike<any>>(
    first: (input: ObservableLike<T>) => Out
  ): Out;
  pipe<Out extends ObservableLike<any>, Inter1 extends ObservableLike<any>>(
    first: (input: ObservableLike<T>) => Inter1,
    second: (input: Inter1) => Out
  ): Out;
  pipe<
    Out extends ObservableLike<any>,
    Inter1 extends ObservableLike<any>,
    Inter2 extends ObservableLike<any>
  >(
    first: (input: ObservableLike<T>) => Inter1,
    second: (input: Inter1) => Inter2,
    third: (input: Inter2) => Out
  ): Out;
  pipe<
    Out extends ObservableLike<any>,
    Inter1 extends ObservableLike<any>,
    Inter2 extends ObservableLike<any>,
    Inter3 extends ObservableLike<any>
  >(
    first: (input: ObservableLike<T>) => Inter1,
    second: (input: Inter1) => Inter2,
    third: (input: Inter2) => Inter3,
    fourth: (input: Inter3) => Out
  ): Out;
  pipe<
    Out extends ObservableLike<any>,
    Inter1 extends ObservableLike<any>,
    Inter2 extends ObservableLike<any>,
    Inter3 extends ObservableLike<any>,
    Inter4 extends ObservableLike<any>
  >(
    first: (input: ObservableLike<T>) => Inter1,
    second: (input: Inter1) => Inter2,
    third: (input: Inter2) => Inter3,
    fourth: (input: Inter3) => Inter4,
    fifth: (input: Inter4) => Out
  ): Out;
  pipe<
    Out extends ObservableLike<any>,
    Inter1 extends ObservableLike<any>,
    Inter2 extends ObservableLike<any>,
    Inter3 extends ObservableLike<any>,
    Inter4 extends ObservableLike<any>,
    Inter5 extends ObservableLike<any>
  >(
    first: (input: ObservableLike<T>) => Inter1,
    second: (input: Inter1) => Inter2,
    third: (input: Inter2) => Inter3,
    fourth: (input: Inter3) => Inter4,
    fifth: (input: Inter4) => Inter5,
    sixth: (input: Inter5) => Out
  ): Out;
  pipe<Out extends ObservableLike<T>>(
    ...mappers: Array<(input: Out) => Out>
  ): Out;
  pipe<Out extends ObservableLike<any>>(
    first: (input: ObservableLike<T>) => ObservableLike<any>,
    ...mappers: Array<(input: ObservableLike<any>) => ObservableLike<any>>
  ): Out {
    // tslint:disable-next-line no-this-assignment
    let intermediate: ObservableLike<any> = this;

    for (const mapper of [first, ...mappers]) {
      intermediate = mapper(intermediate);
    }

    return intermediate as Out;
  }

  tap(
    onNext: (value: T) => void,
    onError?: (error: any) => void,
    onComplete?: () => void
  ): Observable<T>;
  tap(observer: Observer<T>): Observable<T>;
  tap(
    nextOrObserver: Observer<T> | ((value: T) => void),
    onError?: (error: any) => void,
    onComplete?: () => void
  ): Observable<T> {
    const tapObserver =
      typeof nextOrObserver !== "object" || nextOrObserver === null
        ? {
            next: nextOrObserver,
            error: onError,
            complete: onComplete,
          }
        : nextOrObserver;

    return new Observable<T>((observer) => {
      return this.subscribe({
        next(value) {
          tapObserver.next && tapObserver.next(value);
          observer.next(value);
        },
        error(error) {
          tapObserver.error && tapObserver.error(error);
          observer.error(error);
        },
        complete() {
          tapObserver.complete && tapObserver.complete();
          observer.complete();
        },
        start(subscription) {
          tapObserver.start && tapObserver.start(subscription);
        },
      });
    });
  }

  forEach(fn: (value: T, done: UnsubscribeFn) => void) {
    return new Promise((resolve, reject) => {
      if (typeof fn !== "function") {
        reject(new TypeError(fn + " is not a function"));
        return;
      }

      function done() {
        subscription.unsubscribe();
        resolve(undefined);
      }

      const subscription = this.subscribe({
        next(value: T) {
          try {
            fn(value, done);
          } catch (e) {
            reject(e);
            subscription.unsubscribe();
          }
        },
        error(error) {
          reject(error);
        },
        complete() {
          resolve(undefined);
        },
      });
    });
  }

  map<R>(fn: (value: T) => R) {
    if (typeof fn !== "function") {
      throw new TypeError(fn + " is not a function");
    }

    const C = getSpecies(this) as typeof Observable;

    return new C<R>((observer) =>
      this.subscribe({
        next(value) {
          let propagatedValue: T | R = value;
          try {
            propagatedValue = fn(value);
          } catch (e) {
            return observer.error(e);
          }
          observer.next(propagatedValue);
        },
        error(e) {
          observer.error(e);
        },
        complete() {
          observer.complete();
        },
      })
    );
  }

  filter<R extends T>(fn: (value: T) => boolean) {
    if (typeof fn !== "function") {
      throw new TypeError(fn + " is not a function");
    }

    const C = getSpecies(this) as typeof Observable;

    return new C<R>((observer) =>
      this.subscribe({
        next(value) {
          try {
            if (!fn(value)) return;
          } catch (e) {
            return observer.error(e);
          }
          observer.next(value as R);
        },
        error(e) {
          observer.error(e);
        },
        complete() {
          observer.complete();
        },
      })
    );
  }

  reduce<R>(fn: (accumulated: R | T, value: T) => R): Observable<R | T>;
  reduce<R>(fn: (accumulated: R, value: T) => R, seed: R): Observable<R>;
  reduce<R>(fn: (accumulated: R | T, value: T) => R, seed?: R | T) {
    if (typeof fn !== "function") {
      throw new TypeError(fn + " is not a function");
    }

    const C = getSpecies(this) as typeof Observable;
    const hasSeed = arguments.length > 1;
    let hasValue = false;
    let acc = seed;

    return new C<R>((observer) =>
      this.subscribe({
        next(value) {
          const first = !hasValue;
          hasValue = true;

          if (!first || hasSeed) {
            try {
              acc = fn(acc as R | T, value);
            } catch (e) {
              return observer.error(e);
            }
          } else {
            acc = value;
          }
        },

        error(e) {
          observer.error(e);
        },

        complete() {
          if (!hasValue && !hasSeed) {
            return observer.error(
              new TypeError("Cannot reduce an empty sequence")
            );
          }

          observer.next(acc as R);
          observer.complete();
        },
      })
    );
  }

  concat<R>(...sources: Array<Observable<R>>) {
    const C = getSpecies(this) as typeof Observable;

    return new C<T | R>((observer) => {
      let subscription: Subscription<T | R> | undefined;
      let index = 0;

      function startNext(next: Observable<any>) {
        subscription = next.subscribe({
          next(v) {
            observer.next(v);
          },
          error(e) {
            observer.error(e);
          },
          complete() {
            if (index === sources.length) {
              subscription = undefined;
              observer.complete();
            } else {
              startNext(C.from(sources[index++]));
            }
          },
        });
      }

      startNext(this);

      return () => {
        if (subscription) {
          subscription.unsubscribe();
          subscription = undefined;
        }
      };
    });
  }

  flatMap<R>(fn: (value: T) => ObservableLike<R>): Observable<R> {
    if (typeof fn !== "function") {
      throw new TypeError(fn + " is not a function");
    }

    const C = getSpecies(this) as typeof Observable;

    return new C<R>((observer) => {
      const subscriptions: Array<Subscription<R>> = [];

      const outer = this.subscribe({
        next(value) {
          let normalizedValue: ObservableLike<R> | T;
          if (fn) {
            try {
              normalizedValue = fn(value);
            } catch (e) {
              return observer.error(e);
            }
          } else {
            normalizedValue = value;
          }

          const inner = C.from<R>(normalizedValue as any).subscribe({
            next(innerValue) {
              observer.next(innerValue);
            },
            error(e) {
              observer.error(e);
            },
            complete() {
              const i = subscriptions.indexOf(inner);
              if (i >= 0) subscriptions.splice(i, 1);
              completeIfDone();
            },
          });

          subscriptions.push(inner);
        },
        error(e) {
          observer.error(e);
        },
        complete() {
          completeIfDone();
        },
      });

      function completeIfDone() {
        if (outer.closed && subscriptions.length === 0) {
          observer.complete();
        }
      }

      return () => {
        subscriptions.forEach((s) => s.unsubscribe());
        outer.unsubscribe();
      };
    });
  }

  [SymbolObservable]() {
    return this;
  }

  static from<I>(
    x: Observable<I> | ObservableLike<I> | ArrayLike<I>
  ): Observable<I> {
    const C = (
      typeof this === "function" ? this : Observable
    ) as typeof Observable;

    if (x == null) {
      throw new TypeError(x + " is not an object");
    }

    const observableMethod = getMethod(x as any, SymbolObservable);
    if (observableMethod) {
      const observable = observableMethod.call(x);

      if (Object(observable) !== observable) {
        throw new TypeError(observable + " is not an object");
      }

      if (isObservable(observable) && observable.constructor === C) {
        return observable;
      }

      return new C<I>((observer) => observable.subscribe(observer));
    }

    if (hasSymbol("iterator")) {
      const iteratorMethod = getMethod(x as any, SymbolIterator);
      if (iteratorMethod) {
        return new C<I>((observer) => {
          enqueue(() => {
            if (observer.closed) return;
            for (const item of iteratorMethod.call(x)) {
              observer.next(item);
              if (observer.closed) return;
            }
            observer.complete();
          });
        });
      }
    }

    if (Array.isArray(x)) {
      return new C<I>((observer) => {
        enqueue(() => {
          if (observer.closed) return;
          for (const item of x) {
            observer.next(item);
            if (observer.closed) return;
          }
          observer.complete();
        });
      });
    }

    throw new TypeError(x + " is not observable");
  }

  static of<I>(...items: I[]): Observable<I> {
    const C = (
      typeof this === "function" ? this : Observable
    ) as typeof Observable;

    return new C<I>((observer) => {
      enqueue(() => {
        if (observer.closed) return;
        for (const item of items) {
          observer.next(item);
          if (observer.closed) return;
        }
        observer.complete();
      });
    });
  }

  static fromEvent<T extends Event = Event>(
    target: T["target"],
    eventName: string,
    options: AddEventListenerOptions = {}
  ): Observable<T> {
    return new Observable<T>((observer) => {
      if (observer.closed) return;
      const listener = (ev: T) => {
        observer.next(ev);
      };
      target?.addEventListener(eventName, listener as EventListener, options);

      return () =>
        target?.removeEventListener(eventName, listener as EventListener);
    });
  }

  static get [SymbolSpecies]() {
    return this;
  }
}

if (hasSymbols()) {
  Object.defineProperty(Observable, Symbol("extensions"), {
    value: {
      symbol: SymbolObservable,
      hostReportError,
    },
    configurable: true,
  });
}

export default Observable;
