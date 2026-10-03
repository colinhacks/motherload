// The types a generated module refers to. motherload has no run-time export: a data file's module
// is data, and a schema's module carries its own validator.

/** The Standard Schema v1 interface (https://standardschema.dev), copied so that these types depend on no package. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
    readonly types?: Types<Input, Output> | undefined;
  }
  export type Result<Output> = SuccessResult<Output> | FailureResult;
  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }
  export interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }
  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }
  export interface PathSegment {
    readonly key: PropertyKey;
  }
  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }
  export type InferInput<Schema extends StandardSchemaV1> = NonNullable<Schema["~standard"]["types"]>["input"];
  export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<Schema["~standard"]["types"]>["output"];
}

/** A validation failure from `parse`: the message lists every issue, and `issues` holds them. */
export interface SchemaError extends TypeError {
  readonly issues: ReadonlyArray<{ readonly message: string; readonly path: ReadonlyArray<string> }>;
}

/** The default export of a `.schema.json` module: `T` is the type the schema describes, `S` the schema itself as a literal type. */
export interface Schema<T, S = unknown> extends StandardSchemaV1<T, T> {
  readonly "~standard": StandardSchemaV1.Props<T, T> & { readonly validate: (value: unknown) => StandardSchemaV1.Result<T> };
  /** The JSON Schema the module was built from. */
  readonly schema: S;
  /** Whether `value` is valid. */
  is(value: unknown): value is T;
  /** `value` when it is valid; otherwise throws a `SchemaError`. */
  parse(value: unknown): T;
}
