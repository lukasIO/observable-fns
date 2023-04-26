import { describe, it } from "vitest";
import { Observable, multicast } from "../src/index.js";
import { completionWithValues, delay } from "./_helpers.js";

describe("multicast tests", () => {
  it("multicast() causes a single immediate init() call for multiple subscriptions", async (t) => {
    let capturedCompletions = 0;
    let capturedValues: any[] = [];
    let initRuns = 0;

    const source = new Observable((observer) => {
      initRuns++;
      setTimeout(() => observer.next(1), 10);
      setTimeout(() => observer.next(2), 20);
      setTimeout(() => observer.complete(), 30);
    });
    const multicasted = multicast(source);

    for (let index = 0; index < 2; index++) {
      multicasted.subscribe(
        (value) => capturedValues.push(value),
        () => undefined,
        () => capturedCompletions++
      );
    }

    await completionWithValues(multicasted);
    await delay(1);

    t.expect(initRuns).toBe(1);
    t.expect(capturedValues).toMatchObject([1, 1, 2, 2]);
    t.expect(capturedCompletions).toBe(2);
  });

  it("multicast() proxies errors correctly", async (t) => {
    const source = new Observable((observer) => {
      setTimeout(() => observer.error(Error("I am supposed to fail")), 10);
    });

    const hot = multicast(source);
    await t.expect(completionWithValues(hot)).rejects.toThrowError();
  });

  it("multicast()-ed observable unsubscribes from source", async (t) => {
    const source = new Observable<number>((observer) => {
      let counter = 0;
      const interval = setInterval(() => {
        observer.next(++counter);
      }, 100);
      return () => clearInterval(interval);
    });

    const multicasted = multicast(source);

    const values1: number[] = [];
    const subscription1 = multicasted.subscribe((value) => {
      values1.push(value);
    });

    await delay(140);

    const values2: number[] = [];
    const subscription2 = multicasted.subscribe((value) => {
      values2.push(value);
    });

    await delay(540);
    subscription1.unsubscribe();
    subscription2.unsubscribe();

    const values3: number[] = [];
    const subscription3 = multicasted.subscribe((value) => {
      values3.push(value);
    });

    await delay(240);
    subscription3.unsubscribe();

    t.expect(values1).toMatchObject([1, 2, 3, 4, 5, 6]);
    t.expect(values2).toMatchObject([2, 3, 4, 5, 6]);
    t.expect(values3).toMatchObject([1, 2]);
  });
});
