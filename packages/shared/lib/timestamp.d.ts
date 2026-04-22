export interface TimestampLike {
    seconds: number;
    nanoseconds: number;
    toDate(): Date;
    toMillis(): number;
    isEqual(other: TimestampLike): boolean;
    toJSON(): {
        seconds: number;
        nanoseconds: number;
        type: string;
    };
    valueOf(): string;
}
//# sourceMappingURL=timestamp.d.ts.map