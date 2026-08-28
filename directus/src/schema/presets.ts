import type { FieldDefinition, RelationDefinition } from "./types.js";

export function idField(): FieldDefinition {
  return {
    field: "id",
    type: "uuid",
    meta: { interface: "input", readonly: true, hidden: true, special: ["uuid"] },
    schema: { is_primary_key: true, has_auto_increment: false, is_nullable: false },
  };
}

export function dateCreatedField(): FieldDefinition {
  return {
    field: "date_created",
    type: "timestamp",
    meta: { special: ["date-created"], interface: "datetime", readonly: true, hidden: true, width: "half" },
    schema: { is_nullable: true },
  };
}

export function dateUpdatedField(): FieldDefinition {
  return {
    field: "date_updated",
    type: "timestamp",
    meta: { special: ["date-updated"], interface: "datetime", readonly: true, hidden: true, width: "half" },
    schema: { is_nullable: true },
  };
}

export function textField(
  field: string,
  opts: {
    required?: boolean;
    nullable?: boolean;
    note?: string;
    maxLength?: number;
    interface?: string;
    unique?: boolean;
    defaultValue?: string;
  } = {},
): FieldDefinition {
  return {
    field,
    type: "string",
    meta: {
      interface: opts.interface ?? "input",
      required: opts.required ?? false,
      note: opts.note,
      width: "full",
    },
    schema: {
      is_nullable: opts.nullable ?? !opts.required,
      max_length: opts.maxLength ?? 255,
      is_unique: opts.unique ?? false,
      default_value: opts.defaultValue ?? null,
    },
  };
}

/** Long-form plain text / Markdown body. */
export function richTextField(
  field: string,
  opts: { note?: string; nullable?: boolean; interface?: string } = {},
): FieldDefinition {
  return {
    field,
    type: "text",
    meta: { interface: opts.interface ?? "input-rich-text-md", note: opts.note },
    schema: { is_nullable: opts.nullable ?? true },
  };
}

export function booleanField(field: string, defaultValue: boolean, note?: string): FieldDefinition {
  return {
    field,
    type: "boolean",
    meta: { interface: "boolean", note, width: "half" },
    schema: { default_value: defaultValue, is_nullable: false },
  };
}

export function integerField(
  field: string,
  opts: { defaultValue?: number | null; nullable?: boolean; note?: string } = {},
): FieldDefinition {
  return {
    field,
    type: "integer",
    meta: { interface: "input", note: opts.note, width: "half" },
    schema: {
      default_value: opts.defaultValue === undefined ? 0 : opts.defaultValue,
      is_nullable: opts.nullable ?? true,
    },
  };
}

export function decimalField(
  field: string,
  opts: { precision?: number; scale?: number; nullable?: boolean; note?: string } = {},
): FieldDefinition {
  return {
    field,
    type: "decimal",
    meta: { interface: "input", note: opts.note, width: "half" },
    schema: {
      is_nullable: opts.nullable ?? true,
      numeric_precision: opts.precision ?? 10,
      numeric_scale: opts.scale ?? 2,
    },
  };
}

/** Timestamp (date + time). */
export function timestampField(
  field: string,
  opts: { nullable?: boolean; note?: string } = {},
): FieldDefinition {
  return {
    field,
    type: "timestamp",
    meta: { interface: "datetime", note: opts.note, width: "half" },
    schema: { is_nullable: opts.nullable ?? true },
  };
}

/** Calendar date with no time component — match dates, season boundaries. */
export function dateOnlyField(
  field: string,
  opts: { nullable?: boolean; note?: string } = {},
): FieldDefinition {
  return {
    field,
    type: "date",
    meta: { interface: "datetime", note: opts.note, width: "half" },
    schema: { is_nullable: opts.nullable ?? true },
  };
}

/** Wall-clock time with no date — session start/end times. */
export function timeOnlyField(
  field: string,
  opts: { nullable?: boolean; note?: string } = {},
): FieldDefinition {
  return {
    field,
    type: "time",
    meta: { interface: "datetime", note: opts.note, width: "half" },
    schema: { is_nullable: opts.nullable ?? true },
  };
}

export function selectField(
  field: string,
  choices: readonly string[],
  opts: {
    defaultValue?: string;
    nullable?: boolean;
    note?: string;
    labels?: Record<string, string>;
    required?: boolean;
  } = {},
): FieldDefinition {
  return {
    field,
    type: "string",
    meta: {
      interface: "select-dropdown",
      options: { choices: choices.map((value) => ({ text: opts.labels?.[value] ?? value, value })) },
      display: "labels",
      note: opts.note,
      required: opts.required ?? false,
      width: "half",
    },
    schema: {
      default_value: opts.defaultValue ?? null,
      is_nullable: opts.nullable ?? true,
      max_length: 32,
    },
  };
}

/**
 * A URL-safe slug. Indexed and unique by default — every one of these is
 * looked up by a route parameter (`/news/:slug`, `/teams/:slug`), so the
 * index is load-bearing, not decorative.
 */
export function slugField(field = "slug", opts: { note?: string } = {}): FieldDefinition {
  return {
    field,
    type: "string",
    meta: {
      interface: "input",
      required: true,
      note: opts.note ?? "URL segment — lowercase, hyphenated, never changed once published.",
      width: "half",
    },
    schema: { is_nullable: false, max_length: 120, is_unique: true, is_indexed: true },
  };
}

export interface M2OOptions {
  required?: boolean;
  nullable?: boolean;
  note?: string;
  template?: string;
  /** Alias field name to create on the related collection for the reverse O2M list. */
  oneField?: string;
  onDelete?: RelationDefinition["onDelete"];
}

/** A many-to-one field + its relation, e.g. `hrc_fixtures.team -> hrc_teams`. */
export function m2o(
  collection: string,
  field: string,
  relatedCollection: string,
  opts: M2OOptions = {},
): { field: FieldDefinition; relation: RelationDefinition } {
  return {
    field: {
      field,
      type: "uuid",
      meta: {
        interface: "select-dropdown-m2o",
        special: ["m2o"],
        required: opts.required ?? false,
        note: opts.note,
        width: "half",
        options: opts.template ? { template: opts.template } : undefined,
        display: "related-values",
      },
      schema: { is_nullable: opts.nullable ?? true },
    },
    relation: {
      collection,
      field,
      related_collection: relatedCollection,
      oneField: opts.oneField,
      onDelete: opts.onDelete ?? "SET NULL",
    },
  };
}

/**
 * A single-file relation to `directus_files`. Directus models these as a
 * uuid column with `special: ["file"]` plus a relation row — the same two
 * writes an m2o needs, which is why these live in `relationFields` rather
 * than `fields`.
 *
 * `onDelete` is SET NULL, never CASCADE: deleting an image from the file
 * library must not silently delete the news article that referenced it.
 */
export function fileField(
  collection: string,
  field: string,
  opts: { note?: string; image?: boolean } = {},
): { field: FieldDefinition; relation: RelationDefinition } {
  return {
    field: {
      field,
      type: "uuid",
      meta: {
        interface: opts.image === false ? "file" : "file-image",
        special: ["file"],
        note: opts.note,
        width: "half",
      },
      schema: { is_nullable: true },
    },
    relation: {
      collection,
      field,
      related_collection: "directus_files",
      onDelete: "SET NULL",
    },
  };
}
