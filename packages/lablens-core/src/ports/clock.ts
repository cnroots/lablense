export interface Clock {
  nowISO(): string;
}

export const systemClock: Clock = {
  nowISO: () => new Date().toISOString()
};
