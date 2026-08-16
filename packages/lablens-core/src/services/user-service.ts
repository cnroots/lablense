import type { NewUser, User } from "../domain/user";
import type { UserRepository } from "../repositories/user-repository";
import type { Clock } from "../ports/clock";
import type { IdGenerator } from "../ports/id-generator";
import { AppError } from "../errors";
import { newUserSchema } from "../validation";

export interface UserService {
  create(input: NewUser): Promise<User>;
  get(id: string): Promise<User>;
  list(): Promise<User[]>;
  update(id: string, patch: Partial<NewUser>): Promise<User>;
  delete(id: string): Promise<void>;
}

export class UserServiceImpl implements UserService {
  private readonly repository: UserRepository;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(repository: UserRepository, clock: Clock, ids: IdGenerator) {
    this.repository = repository;
    this.clock = clock;
    this.ids = ids;
  }

  async create(input: NewUser): Promise<User> {
    const parsed = newUserSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(
        "INVALID_VALUE",
        parsed.error.issues.map((i) => i.message).join("; "),
        parsed.error.issues
      );
    }
    return this.repository.insert({
      ...parsed.data,
      id: this.ids.generate(),
      createdAt: this.clock.nowISO()
    });
  }

  async get(id: string): Promise<User> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new AppError("USER_NOT_FOUND", `User "${id}" not found`);
    }
    return user;
  }

  list(): Promise<User[]> {
    return this.repository.list();
  }

  async update(id: string, patch: Partial<NewUser>): Promise<User> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError("USER_NOT_FOUND", `User "${id}" not found`);
    }
    const parsed = newUserSchema.partial().safeParse(patch);
    if (!parsed.success) {
      throw new AppError(
        "INVALID_VALUE",
        parsed.error.issues.map((i) => i.message).join("; "),
        parsed.error.issues
      );
    }
    return this.repository.update(id, parsed.data);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError("USER_NOT_FOUND", `User "${id}" not found`);
    }
    await this.repository.delete(id);
  }
}
