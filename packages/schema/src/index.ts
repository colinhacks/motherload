// The types a schema's generated module refers to; `motherload` exports them too. Neither has a
// run-time export: a schema's module carries its own validator.

/** The Standard Typed, Standard Schema and Standard JSON Schema v1 interfaces (https://standardschema.dev), as `@standard-schema/spec` 1.1.0 publishes them, copied so that these types depend on no package. */
export interface StandardTypedV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardTypedV1.Props<Input, Output>;
}

export declare namespace StandardTypedV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly types?: Types<Input, Output> | undefined;
  }
  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }
  export type InferInput<Schema extends StandardTypedV1> = NonNullable<Schema["~standard"]["types"]>["input"];
  export type InferOutput<Schema extends StandardTypedV1> = NonNullable<Schema["~standard"]["types"]>["output"];
}

export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> extends StandardTypedV1.Props<Input, Output> {
    readonly validate: (value: unknown, options?: Options | undefined) => Result<Output> | Promise<Result<Output>>;
  }
  export type Result<Output> = SuccessResult<Output> | FailureResult;
  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }
  export interface Options {
    readonly libraryOptions?: Record<string, unknown> | undefined;
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
  export type Types<Input = unknown, Output = Input> = StandardTypedV1.Types<Input, Output>;
  export type InferInput<Schema extends StandardTypedV1> = StandardTypedV1.InferInput<Schema>;
  export type InferOutput<Schema extends StandardTypedV1> = StandardTypedV1.InferOutput<Schema>;
}

export interface StandardJSONSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardJSONSchemaV1.Props<Input, Output>;
}

export declare namespace StandardJSONSchemaV1 {
  export interface Props<Input = unknown, Output = Input> extends StandardTypedV1.Props<Input, Output> {
    readonly jsonSchema: Converter;
  }
  /** Converts the schema to JSON Schema in the target's draft; throws for a target it cannot produce. */
  export interface Converter {
    readonly input: (options: Options) => Record<string, unknown>;
    readonly output: (options: Options) => Record<string, unknown>;
  }
  export type Target = "draft-2020-12" | "draft-07" | "openapi-3.0" | ({} & string);
  export interface Options {
    readonly target: Target;
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }
  export type Types<Input = unknown, Output = Input> = StandardTypedV1.Types<Input, Output>;
  export type InferInput<Schema extends StandardTypedV1> = StandardTypedV1.InferInput<Schema>;
  export type InferOutput<Schema extends StandardTypedV1> = StandardTypedV1.InferOutput<Schema>;
}

/** A validation failure from `parse`: the message lists every issue, and `issues` holds them. */
export interface SchemaError extends TypeError {
  readonly issues: ReadonlyArray<{ readonly message: string; readonly path: ReadonlyArray<string> }>;
}

/** The default export of a `.schema.jsonc` or `.schema.json5` module: `T` is the type the schema describes, `S` the schema itself as a literal type. */
export interface Schema<T, S = unknown> extends StandardSchemaV1<T, T>, StandardJSONSchemaV1<T, T> {
  /**
   * Standard Schema v1 and Standard JSON Schema v1. `jsonSchema.input` and `.output` give the schema,
   * self-contained, in the "draft-07" or "draft-2020-12" target's draft, and throw for another target
   * or for a keyword the target cannot express.
   */
  readonly "~standard": StandardSchemaV1.Props<T, T> & StandardJSONSchemaV1.Props<T, T> & { readonly validate: (value: unknown) => StandardSchemaV1.Result<T> };
  /** The JSON Schema the module was built from. */
  readonly schema: S;
  /** Whether `value` is valid. */
  is(value: unknown): value is T;
  /** `value` when it is valid; otherwise throws a `SchemaError`. */
  parse(value: unknown): T;
}
