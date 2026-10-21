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

/** `validate`'s result: Standard Schema's result, with Motherload's issues. */
export type SchemaResult<T> =
  | { readonly value: T; readonly issues?: undefined }
  | { readonly value?: undefined; readonly issues: readonly [SchemaIssue, ...SchemaIssue[]] };

/** One way a value fails: ajv's error, with its place in the value as Standard Schema's path. */
export interface SchemaIssue extends StandardSchemaV1.Issue {
  /** ajv's message: "must be string", "must have required property 'name'". */
  readonly message: string;
  /** Where in the value: object keys as strings, array indexes as numbers; a missing or unexpected property's key ends it. */
  readonly path: ReadonlyArray<string | number>;
  /** The keyword that failed: "type", "required", "minLength", "additionalProperties", "format". */
  readonly keyword: string;
  /** ajv's details for that keyword: `{ type: "string" }`, `{ missingProperty: "name" }`, `{ limit: 1 }`. */
  readonly params: Readonly<Record<string, unknown>>;
  /** Where in the schema, as a JSON Pointer: "#/properties/name/minLength". */
  readonly schemaPath: string;
}

/**
 * The default export of a `.schema.jsonc` or `.schema.json5` module: `T` is the type the schema
 * describes, `S` the schema itself as a literal type. Nothing on it throws, except a Standard JSON
 * Schema target it cannot produce, as that spec requires.
 */
export interface Schema<T, S = unknown> extends StandardSchemaV1<T, T>, StandardJSONSchemaV1<T, T> {
  /**
   * Checks the whole value and reports every way it fails (ajv with `allErrors`). Never throws: a value
   * the validator cannot check (nested deeper than the stack, a getter that throws) is one issue, `keyword: "error"`.
   * On success, `value` is the value passed in, the same object, typed `T`: ajv changes nothing.
   */
  validate(value: unknown): SchemaResult<T>;
  /** Whether `value` is valid, as a type guard. Stops at the first failure (a second validator, without `allErrors`); `false` for a value it cannot check. Never throws. */
  is(value: unknown): value is T;
  /** The JSON Schema as written in the file. A `$ref` to another file stays a reference here. */
  readonly schema: S;
  /**
   * Standard Schema v1 and Standard JSON Schema v1, for libraries that accept either. `jsonSchema.input`
   * and `.output` give the schema, self-contained, in the "draft-07" or "draft-2020-12" target's draft,
   * and throw for another target or for a keyword the target cannot express. Motherload's `validate`
   * comes first, so that a call through `~standard` takes its signature, `SchemaResult<T>`, and not
   * Standard Schema's, which may be a promise.
   */
  readonly "~standard": {
    /** The same function as `validate`. */
    readonly validate: (value: unknown) => SchemaResult<T>;
  } & StandardSchemaV1.Props<T, T> &
    StandardJSONSchemaV1.Props<T, T>;
}
