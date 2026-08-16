export type Sex = "male" | "female" | "other";

export interface User {
  id: string;
  name?: string;
  ageYears?: number;
  sex?: Sex;
  createdAt: string;
}

export interface NewUser {
  name?: string;
  ageYears?: number;
  sex?: Sex;
}

export type UserInsert = NewUser & {
  id: string;
  createdAt: string;
};
