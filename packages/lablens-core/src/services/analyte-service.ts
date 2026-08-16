import type { Analyte, TestGroup } from "../domain/analyte";
import type { AnalyteRepository } from "../repositories/analyte-repository";
import { AppError } from "../errors";

export interface AnalyteService {
  findById(id: string): Promise<Analyte | null>;
  findByKey(key: string): Promise<Analyte | null>;
  getByKey(key: string): Promise<Analyte>;
  search(query: string, limit?: number): Promise<Analyte[]>;
  list(): Promise<Analyte[]>;
  listGroups(): Promise<TestGroup[]>;
  listByGroup(groupKey: string): Promise<Analyte[]>;
}

export class AnalyteServiceImpl implements AnalyteService {
  private readonly repository: AnalyteRepository;

  constructor(repository: AnalyteRepository) {
    this.repository = repository;
  }

  findById(id: string): Promise<Analyte | null> {
    return this.repository.findById(id);
  }

  findByKey(key: string): Promise<Analyte | null> {
    return this.repository.findByKey(key);
  }

  async getByKey(key: string): Promise<Analyte> {
    const analyte = await this.repository.findByKey(key);
    if (!analyte) {
      throw new AppError("ANALYTE_NOT_FOUND", `Analyte "${key}" not found`);
    }
    return analyte;
  }

  search(query: string, limit?: number): Promise<Analyte[]> {
    return this.repository.search(query, limit);
  }

  list(): Promise<Analyte[]> {
    return this.repository.list();
  }

  async listGroups(): Promise<TestGroup[]> {
    const analytes = await this.repository.list();
    const groups = new Map<string, TestGroup>();
    for (const analyte of analytes) {
      if (analyte.group && !groups.has(analyte.group.key)) {
        groups.set(analyte.group.key, analyte.group);
      }
    }
    return [...groups.values()];
  }

  listByGroup(groupKey: string): Promise<Analyte[]> {
    return this.repository.listByGroup(groupKey);
  }
}
