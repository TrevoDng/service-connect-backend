// src/models/ChatMessage.ts
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.config';

// ============================================================
// STATUS ENUM (matches frontend MessageStatus exactly)
// ============================================================
export const CHAT_MESSAGE_STATUSES = [
  'sending',
  'sent',
  'delivered',
  'read',
] as const;

export type ChatMessageStatus = typeof CHAT_MESSAGE_STATUSES[number];

// ============================================================
// ATTACHMENT SHAPE (matches frontend ChatAttachment)
// ============================================================
export interface ChatAttachment {
  id: string;
  url: string;
  type: 'image' | 'file';
  name?: string;
  size?: number;
}

// ============================================================
// ATTRIBUTES
// ============================================================
//
// `text` is allowNull:false with '' default. Empty string is valid here
// because attachments can carry a message with no text body. The step-2
// controller will enforce "at least one of text or attachments" — the DB
// just records what it's given.
//
// `attachments` is JSONB — matches the frontend shape directly. No
// separate attachments table for now (they're small, ordered, and always
// read with their parent message).

export interface ChatMessageAttributes {
  id: string;
  threadId: string;
  senderId: string;
  text: string;
  attachments?: ChatAttachment[] | null;
  sentAt: Date;
  status: ChatMessageStatus;
  readAt?: Date | null;
}

export interface ChatMessageCreationAttributes
  extends Optional<
    ChatMessageAttributes,
    'id' | 'attachments' | 'readAt' | 'status' | 'sentAt'
  > {}

class ChatMessage
  extends Model<ChatMessageAttributes, ChatMessageCreationAttributes>
  implements ChatMessageAttributes
{
  declare id: string;
  declare threadId: string;
  declare senderId: string;
  declare text: string;
  declare attachments?: ChatAttachment[] | null;
  declare sentAt: Date;
  declare status: ChatMessageStatus;
  declare readAt?: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ChatMessage.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    threadId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'thread_id',
    },
    senderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'sender_id',
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
      type: DataTypes.ENUM(...CHAT_MESSAGE_STATUSES),
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
    modelName: 'ChatMessage',
    tableName: 'chat_messages',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['thread_id', 'sent_at'] },
      { fields: ['sender_id'] },
    ],
  }
);

export default ChatMessage;