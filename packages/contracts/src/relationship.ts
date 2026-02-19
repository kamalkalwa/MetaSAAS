/**
 * Relationship Definitions
 *
 * Defines how entities relate to each other. Relationships are declared in
 * entity definitions and used by the platform to:
 *   - Set up foreign keys in the database
 *   - Generate join queries in CRUD actions
 *   - Render related data in the UI
 */

/** Supported relationship cardinalities */
export type RelationshipType = "belongsTo" | "hasMany" | "manyToMany";

/**
 * Declares a relationship between two entities.
 *
 * Examples:
 *   { type: 'belongsTo', entity: 'Company' }
 *     → This entity has a companyId foreign key
 *
 *   { type: 'hasMany', entity: 'Deal', foreignKey: 'contactId' }
 *     → The Deal entity has a contactId pointing back here
 *
 *   { type: 'manyToMany', entity: 'Label', through: 'entity_labels' }
 *     → Junction table 'entity_labels' connects the two
 */
export interface RelationshipDefinition {
  /** The cardinality of the relationship */
  type: RelationshipType;

  /** The name of the related entity (PascalCase, e.g., "Company") */
  entity: string;

  /**
   * The foreign key column name.
   * Defaults to `{relatedEntityName}Id` for belongsTo,
   * or `{thisEntityName}Id` for hasMany.
   */
  foreignKey?: string;

  /** For manyToMany: the name of the junction table */
  through?: string;

  /**
   * Optional alias when an entity has multiple relationships to the same entity.
   * e.g., a Task might have { type: 'belongsTo', entity: 'User', as: 'assignee' }
   * and { type: 'belongsTo', entity: 'User', as: 'reporter' }
   */
  as?: string;
}
