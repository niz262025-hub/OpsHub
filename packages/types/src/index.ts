export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type UserId = Brand<string, 'UserId'>;

export interface PublicConfig {
  readonly appName: 'OpsHub';
}
