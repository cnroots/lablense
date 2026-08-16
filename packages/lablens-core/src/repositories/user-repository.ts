import type { NewUser, User, UserInsert } from "../domain/user";

export interface UserRepository {
  findById(id: string): Promise<User | null>;

  list(): Promise<User[]>;

  insert(user: UserInsert): Promise<User>;

  update(id: string, patch: Partial<NewUser>): Promise<User>;

  delete(id: string): Promise<void>;
}
