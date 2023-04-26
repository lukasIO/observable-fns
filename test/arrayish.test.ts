import { describe, it } from "vitest";
import {
  Observable,
  filter,
  flatMap,
  map,
  scan,
  switchMap,
} from "../src/index.js";
import { completionWithValues, delay } from "./_helpers.js";

describe("pipe tests", () => {
  it("filter() works", async (t) => {
    const odd = Observable.from([1, 2, 3, 4, 5]).pipe(
      filter(async (value) => {
        await delay(Math.round(Math.random() * 20));
        return value % 2 === 1;
      })
    );
    t.expect(await completionWithValues(odd)).toMatchObject([1, 3, 5]);
  });

  it("map() works", async (t) => {
    const doubled = Observable.from([1, 2, 3, 4, 5]).pipe(
      map(async (value) => {
        await delay(Math.round(Math.random() * 20));
        return value * 2;
      })
    );
    t.expect(await completionWithValues(doubled)).toMatchObject([
      2, 4, 6, 8, 10,
    ]);
  });

  it("flatMap() works", async (t) => {
    const twiceTheSize = Observable.from([1, 2, 3, 4, 5]).pipe(
      flatMap(async (value) => {
        await delay(Math.round(Math.random() * 20));
        return [value * 2 - 1, value * 2];
      })
    );
    t.expect(await completionWithValues(twiceTheSize)).toMatchObject([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("scan() with a seed works", async (t) => {
    const scanned = Observable.from(["a", "b", "c"]).pipe(
      scan(
        (array, value, index) => [...array, { index, value }],
        [] as Array<{ index: number; value: string }>
      )
    );
    t.expect(await completionWithValues(scanned)).toMatchObject([
      [{ index: 0, value: "a" }],
      [
        { index: 0, value: "a" },
        { index: 1, value: "b" },
      ],
      [
        { index: 0, value: "a" },
        { index: 1, value: "b" },
        { index: 2, value: "c" },
      ],
    ]);
  });

  it("scan() without a seed works", async (t) => {
    const maxObservable = Observable.from([2, 3, 1, 5, 4]).pipe(
      scan((max, value) => (value > max ? value : max))
    );
    t.expect(await completionWithValues(maxObservable)).toMatchObject([
      2, 3, 3, 5, 5,
    ]);
  });

  it("switchMap() works", async (t) => {
    const switchObservable = new Observable((subscriber) => {
      setTimeout(() => {
        subscriber.next(1);
      }, 1);
      setTimeout(() => {
        subscriber.next(2);
      }, 2);
      setTimeout(() => {
        subscriber.next(3);
        subscriber.complete();
      }, 3);
    }).pipe(
      switchMap((val) => {
        console.log("new observable of", Math.pow(val, 2));
        return Observable.from([Math.pow(val, 2)]);
      })
    );
    await t
      .expect(await completionWithValues(switchObservable))
      .toMatchObject([1, 4, 9]);
  });
});
