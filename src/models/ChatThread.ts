// src/models/ChatThread.ts
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.config';

// ============================================================
// ATTRIBUTES
// ============================================================
//
// One thread per (client, provider) pair. Enforced by a unique index.
// Participant display data is NOT stored here — it's joined from User
// at read time (see step 2's toApi mapper). This keeps names/avatars
// in sync with the User table automatically.
//
// `linkedBookingId` is optional — most threads start before any booking
// exists. When a booking is created from the same pair, we can attach it.

export interface ChatThreadAttributes {
  id: string;
  clientId: string;
  providerId: string;
  linkedBookingId?: string | null;
  lastMessageAt: Date;
  lastMessagePreview?: string | null;
}

export interface ChatThreadCreationAttributes
  extends Optional<
    ChatThreadAttributes,
    'id' | 'linkedBookingId' | 'lastMessagePreview' | 'lastMessageAt'
  > {}

class ChatThread
  extends Model<ChatThreadAttributes, ChatThreadCreationAttributes>
  implements ChatThreadAttributes
{
  declare id: string;
  declare clientId: string;
  declare providerId: string;
  declare linkedBookingId?: string | null;
  declare lastMessageAt: Date;
  declare lastMessagePreview?: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ChatThread.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    clientId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'client_id',
    },
    providerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'provider_id',
    },
    linkedBookingId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'linked_booking_id',
    },
    lastMessageAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'last_message_at',
    },
    lastMessagePreview: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'last_message_preview',
    },
  },
  {
    sequelize,
    modelName: 'ChatThread',
    tableName: 'chat_threads',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['client_id', 'provider_id'],
        name: 'chat_threads_client_provider_unique',
      },
      { fields: ['last_message_at'] },
    ],
  }
);

export default ChatThread;