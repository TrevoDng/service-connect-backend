// src/models/DisputeMessage.ts
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.config';

export const DISPUTE_AUTHOR_ROLES = [
  'CLIENT',
  'PROVIDER',
  'EMPLOYEE',
  'ADMIN',
  'SYSTEM',
] as const;
export type DisputeAuthorRole = typeof DISPUTE_AUTHOR_ROLES[number];

export interface DisputeMessageAttributes {
  id: string;
  disputeId: string;
  authorId: string;
  authorDisplayName: string;
  authorRole: DisputeAuthorRole;
  text: string;
  internal: boolean;
}

export interface DisputeMessageCreationAttributes
  extends Optional<DisputeMessageAttributes, 'id' | 'internal'> {}

class DisputeMessage
  extends Model<DisputeMessageAttributes, DisputeMessageCreationAttributes>
  implements DisputeMessageAttributes
{
  declare id: string;
  declare disputeId: string;
  declare authorId: string;
  declare authorDisplayName: string;
  declare authorRole: DisputeAuthorRole;
  declare text: string;
  declare internal: boolean;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

DisputeMessage.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    disputeId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'dispute_id',
    },
    authorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'author_id',
    },
    authorDisplayName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'author_display_name',
    },
    authorRole: {
      type: DataTypes.ENUM(...DISPUTE_AUTHOR_ROLES),
      allowNull: false,
      field: 'author_role',
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    internal: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'DisputeMessage',
    tableName: 'dispute_messages',
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ['dispute_id'] }],
  }
);

export default DisputeMessage;