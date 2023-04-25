import {
  Subscription as SubscriptionClass,
  SubscriptionObserver as SubscriptionObserverClass,
} from "./observable.js";

export { default as filter } from "./filter.js";
export { default as flatMap } from "./flatMap.js";
export { default as interval } from "./interval.js";
export { default as map } from "./map.js";
export { default as merge } from "./merge.js";
export { default as multicast } from "./multicast.js";
export { default as Observable, ObservableLike } from "./observable.js";
export { default as scan } from "./scan.js";
export { default as Subject } from "./subject.js";
export { default as unsubscribe } from "./unsubscribe.js";
export { default as startWith } from "./startWith.js";
export { default as switchMap } from "./switchMap.js";
export { default as distinctUntilChanged } from "./distinctUntilChanged.js";

type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;

// Export only the type, not the class itself
export type Subscription<T> = SubscriptionClass<T>;
export type SubscriptionObserver<T> = Omit<
  SubscriptionObserverClass<T>,
  "_subscription"
>;
