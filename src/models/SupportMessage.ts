// src/models/SupportMessage.ts
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.config';
import type { ChatAttachment } from './ChatMessage';

// ============================================================
// STATUS / SENDER ROLE ENUMS
// ============================================================

export const SUPPORT_MESSAGE_STATUSES = [
  'sending',
  'sent',
  'delivered',
  'read',
] as const;

export type SupportMessageStatus = typeof SUPPORT_MESSAGE_STATUSES[number];

export const SUPPORT_SENDER_ROLES = [
  'CLIENT',
  'PROVIDER',
  'ADMIN',
  'EMPLOYEE',
] as const;

export type SupportSenderRole = typeof SUPPORT_SENDER_ROLES[number];

// ============================================================
// ATTRIBUTES
// ============================================================

export interface SupportMessageAttributes {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: SupportSenderRole;
  text: string;
  attachments?: ChatAttachment[] | null;
  sentAt: Date;
  status: SupportMessageStatus;
  readAt?: Date | null;
}

export interface SupportMessageCreationAttributes
  extends Optional<
    SupportMessageAttributes,
    'id' | 'attachments' | 'readAt' | 'status' | 'sentAt'
  > {}

class SupportMessage
  extends Model<SupportMessageAttributes, SupportMessageCreationAttributes>
  implements SupportMessageAttributes
{
  declare id: string;
  declare ticketId: string;
  declare senderId: string;
  declare senderRole: SupportSenderRole;
  declare text: string;
  declare attachments?: ChatAttachment[] | null;
  declare sentAt: Date;
  declare status: SupportMessageStatus;
  declare readAt?: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

SupportMessage.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ticketId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'ticket_id',
    },
    senderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'sender_id',
    },
    senderRole: {
      type: DataTypes.ENUM(...SUPPORT_SENDER_ROLES),
      allowNull: false,
      field: 'sender_role',
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    attachments: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'sent_at',
    },
    status: {
      type: DataTypes.ENUM(...SUPPORT_MESSAGE_STATUSES),
      allowNull: false,
      defaultValue: 'sent',
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'read_at',
    },
  },
  {
    sequelize,
    modelName: 'SupportMessage',
    tableName: 'support_messages',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['ticket_id', 'sent_at'] },
      { fields: ['sender_id'] },
    ],
  }
);

export default SupportMessage;