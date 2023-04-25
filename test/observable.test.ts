import test from "ava";
import { Observable } from "../src/index";
import { completionWithValues, delay } from "./_helpers";
import startWith from "../src/startWith";
import { Subscription } from "../src/observable";
import { distinctUntilChanged } from "../src/distinctUntilChanged";

test("can subscribe to an observable", async (t) => {
  let subscriberFnCallCount = 0;

  const observable = new Observable<number>((observer) => {
    subscriberFnCallCount++;

    setTimeout(() => {
      observer.next(123);
      observer.complete();
    }, 1);
  });

  const values1 = await completionWithValues(observable);
  const values2 = await completionWithValues(observable);

  t.is(subscriberFnCallCount, 2);
  t.deepEqual(values1, [123]);
  t.deepEqual(values2, [123]);
});

test("can subscribe to a failing observable", async (t) => {
  let handlerCallCount = 0;

  const observable = new Observable((observer) => {
    setTimeout(() => observer.error(Error("I am supposed to be rejected.")), 1);
  });

  const promise1 = completionWithValues(observable).then(
    () => t.fail("Observable is supposed to fail."),
    () => Promise.resolve(handlerCallCount++)
  );
  await delay(10);
  const promise2 = completionWithValues(observable).then(
    () => t.fail("Observable is supposed to fail."),
    () => Promise.resolve(handlerCallCount++)
  );

  await Promise.all([promise1.catch(() => true), promise2.catch(() => true)]);
  t.is(handlerCallCount, 2);
});

test("handles a throwing subscriber", async (t) => {
  let handlerCallCount = 0;

  const observable = new Observable(() => {
    throw Error("I am supposed to be rejected.");
  });

  const promise1 = completionWithValues(observable).then(
    () => t.fail("Promise should not become fulfilled"),
    () => Promise.resolve(handlerCallCount++)
  );
  await delay(10);
  const promise2 = completionWithValues(observable).then(
    () => t.fail("Promise should not become fulfilled"),
    () => Promise.resolve(handlerCallCount++)
  );

  await Promise.all([promise1, promise2]);
  t.is(handlerCallCount, 2);
});

test("can subscribe to multiple values", async (t) => {
  let capturedValues: any[] = [];
  let capturedCompletions = 0;

  const observable = new Observable((observer) => {
    setTimeout(() => observer.next(1), 10);
    setTimeout(() => observer.next(2), 20);
    setTimeout(() => observer.complete(), 30);
  });

  for (let index = 0; index < 2; index++) {
    observable.subscribe(
      (value) => capturedValues.push(value),
      () => undefined,
      () => capturedCompletions++
    );
  }

  await completionWithValues(observable);
  await delay(1);

  t.deepEqual(capturedValues, [1, 1, 2, 2]);
  t.is(capturedCompletions, 2);
});

test("can subscribe to values and errors", async (t) => {
  let capturedErrorMessages: string[] = [];
  let capturedValues: any[] = [];
  let capturedCompletions = 0;

  const observable = new Observable((observer) => {
    setTimeout(() => observer.next(1), 10);
    setTimeout(() => observer.error(Error("Fails as expected.")), 20);
    setTimeout(() => observer.next(2), 30);
    setTimeout(() => observer.complete(), 40);
  });

  for (let index = 0; index < 2; index++) {
    observable.subscribe(
      (value) => capturedValues.push(value),
      (error) => capturedErrorMessages.push(error.message),
      () => capturedCompletions++
    );
  }

  await completionWithValues(observable).catch(() => undefined);
  await delay(1);

  t.deepEqual(capturedValues, [1, 1]);
  t.deepEqual(capturedErrorMessages, [
    "Fails as expected.",
    "Fails as expected.",
  ]);
  t.is(capturedCompletions, 0);
});

test("startWith() works", async (t) => {
  let subscriberFnCallCount = 0;

  const observable = new Observable<number>((observer) => {
    subscriberFnCallCount++;

    setTimeout(() => {
      observer.next(123);
      observer.complete();
    }, 1);
  }).pipe(startWith(5));
  let firstValue: number | undefined = undefined;

  observable.subscribe((val) => (firstValue ??= val));

  const values1 = await completionWithValues(observable);
  const values2 = await completionWithValues(observable);

  t.is(subscriberFnCallCount, 3);
  t.deepEqual(firstValue, 5);
  t.deepEqual(values1, [5, 123]);
  t.deepEqual(values2, [5, 123]);
});

test("distinctUntilChanged() works", async (t) => {
  const observable = new Observable<number>((observer) => {
    setTimeout(() => {
      observer.next(123);
      observer.next(123);
      observer.next(1);
      observer.complete();
    }, 1);
  }).pipe(distinctUntilChanged());

  const values1 = await completionWithValues(observable);
  t.deepEqual(values1, [123, 1]);
});

test("fromEvent works", async (t) => {
  const eventTarget = new EventTarget();

  let eventCounter = 0;
  const observable = Observable.fromEvent(eventTarget, "test");
  const subscription = observable.subscribe((val) => {
    eventCounter += 1;
  });

  eventTarget.dispatchEvent(new Event("test"));
  eventTarget.dispatchEvent(new Event("test"));
  eventTarget.dispatchEvent(new Event("test"));

  t.is(eventCounter, 3);
  subscription.unsubscribe();
  eventTarget.dispatchEvent(new Event("test"));
  t.is(eventCounter, 3);
  t.is(subscription.closed, true);
});
