// packages/shared/src/timestamp.ts

export interface TimestampLike {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
}