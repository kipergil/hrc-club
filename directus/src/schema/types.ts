/** Minimal, hand-rolled shapes for the parts of Directus's field/relation meta we set. */

export interface FieldMeta {
  interface?: string;
  options?: Record<string, unknown>;
  display?: string;
  display_options?: Record<string, unknown>;
  readonly?: boolean;
  hidden?: boolean;
  sort?: number;
  width?: "half" | "full";
  note?: string;
  required?: boolean;
  special?: string[];
  group?: string;
}

export interface FieldSchema {
  is_nullable?: boolean;
  is_unique?: boolean;
  is_primary_key?: boolean;
  is_indexed?: boolean;
  has_auto_increment?: boolean;
  default_value?: string | number | boolean | null;
  max_length?: number | null;
  numeric_precision?: number | null;
  numeric_scale?: number | null;
}

export interface FieldDefinition {
  field: string;
  type: string;
  meta?: FieldMeta;
  /** Pass `null` for alias/virtual fields (o2m, m2m, presentation) that have no DB column. */
  schema?: FieldSchema | null;
}

export interface RelationDefinition {
  /** The collection holding the foreign key column (the "many" side). */
  collection: string;
  field: string;
  related_collection: string;
  /** Name of the alias field to create on the related ("one") collection, if any. */
  oneField?: string;
  onDelete?: "SET NULL" | "CASCADE" | "NO ACTION";
}

export interface RelationFieldDefinition {
  field: FieldDefinition;
  relation: RelationDefinition;
}

export interface CollectionDefinition {
  collection: string;
  icon: string;
  note: string;
  singleton?: boolean;
  sortField?: string;
  displayTemplate?: string;
  /** Non-relational fields, created alongside the collection. */
  fields: FieldDefinition[];
  /** m2o and file fields, created in a second pass once every collection exists. */
  relationFields: RelationFieldDefinition[];
}
