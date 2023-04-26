import { describe, it } from "vitest";
import { Observable, distinctUntilChanged, startWith } from "../src/index.js";
import { completionWithValues, delay } from "./_helpers.js";

describe("observable tests", () => {
  it("can subscribe to an observable", async (t) => {
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

    t.expect(subscriberFnCallCount).toBe(2);
    t.expect(values1).toMatchObject([123]);
    t.expect(values2).toMatchObject([123]);
  });

  it("can subscribe to a failing observable", async (t) => {
    let handlerCallCount = 0;

    const observable = new Observable((observer) => {
      setTimeout(
        () => observer.error(Error("I am supposed to be rejected.")),
        1
      );
    });
    const prom1 = t
      .expect(
        completionWithValues(observable).then(() => (handlerCallCount += 1))
      )
      .rejects.toThrowError();

    await delay(10);
    const prom2 = t
      .expect(
        completionWithValues(observable).then(() => (handlerCallCount += 1))
      )
      .rejects.toThrowError();
    await Promise.all([prom1, prom2]);
    t.expect(handlerCallCount).toBe(0);
  });

  it("handles a throwing subscriber", async (t) => {
    let handlerCallCount = 0;

    const observable = new Observable(() => {
      throw Error("I am supposed to be rejected.");
    });

    await t
      .expect(
        completionWithValues(observable).then(() => (handlerCallCount += 1))
      )
      .rejects.toThrowError();
    await t
      .expect(
        completionWithValues(observable).then(() => (handlerCallCount += 1))
      )
      .rejects.toThrowError();
    t.expect(handlerCallCount).toBe(0);
  });

  it("can subscribe to multiple values", async (t) => {
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

    t.expect(capturedValues).toMatchObject([1, 1, 2, 2]);
    t.expect(capturedCompletions).toBe(2);
  });

  it("can subscribe to values and errors", async (t) => {
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

    t.expect(capturedValues).toMatchObject([1, 1]);
    t.expect(capturedErrorMessages).toMatchObject([
      "Fails as expected.",
      "Fails as expected.",
    ]);
    t.expect(capturedCompletions).toBe(0);
  });

  it("startWith() works", async (t) => {
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

    t.expect(subscriberFnCallCount).toBe(3);
    t.expect(firstValue).toBe(5);
    t.expect(values1).toMatchObject([5, 123]);
    t.expect(values2).toMatchObject([5, 123]);
  });

  it("distinctUntilChanged() works", async (t) => {
    const observable = new Observable<number>((observer) => {
      setTimeout(() => {
        observer.next(123);
        observer.next(123);
        observer.next(1);
        observer.complete();
      }, 1);
    }).pipe(distinctUntilChanged());

    const values1 = await completionWithValues(observable);
    t.expect(values1).toMatchObject([123, 1]);
  });

  it("fromEvent works", async (t) => {
    const eventTarget = new EventTarget();

    let eventCounter = 0;
    const observable = Observable.fromEvent(eventTarget, "test");
    const subscription = observable.subscribe((val) => {
      eventCounter += 1;
    });

    eventTarget.dispatchEvent(new Event("test"));
    eventTarget.dispatchEvent(new Event("test"));
    eventTarget.dispatchEvent(new Event("test"));

    t.expect(eventCounter).toBe(3);
    subscription.unsubscribe();
    eventTarget.dispatchEvent(new Event("test"));
    t.expect(eventCounter).toBe(3);
    t.expect(subscription.closed).toBe(true);
  });
});
