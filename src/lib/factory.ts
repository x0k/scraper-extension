export interface Factory<T, R> {
  Create(config: T): R;
}

export interface AsyncFactory<T, R> {
  Create(config: T): Promise<R>;
}

export type FactoryFn<T, R> = (config: T) => R;
