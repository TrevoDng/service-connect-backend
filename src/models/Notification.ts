// src/models/Notification.ts
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.config';

export interface NotificationAttributes {
  id: string;
  userId: string;
  type: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  title: string;
  message: string;
  linkTo: string;
  actorId?: string | null;
  actorDisplayName?: string | null;
  bookingId?: string | null;
  workSessionId?: string | null;
  threadId?: string | null;
  readAt?: Date | null;
}

export interface NotificationCreationAttributes
  extends Optional<
    NotificationAttributes,
    | 'id'
    | 'priority'
    | 'actorId'
    | 'actorDisplayName'
    | 'bookingId'
    | 'workSessionId'
    | 'threadId'
    | 'readAt'
  > {}

class Notification
  extends Model<NotificationAttributes, NotificationCreationAttributes>
  implements NotificationAttributes
{
  declare id: string;
  declare userId: string;
  declare type: string;
  declare priority: 'low' | 'normal' | 'high' | 'urgent';
  declare title: string;
  declare message: string;
  declare linkTo: string;
  declare actorId?: string | null;
  declare actorDisplayName?: string | null;
  declare bookingId?: string | null;
  declare workSessionId?: string | null;
  declare threadId?: string | null;
  declare readAt?: Date | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Notification.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    type: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'normal',
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    linkTo: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: 'link_to',
    },
    actorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'actor_id',
    },
    actorDisplayName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'actor_display_name',
    },
    bookingId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'booking_id',
    },
    workSessionId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'work_session_id',
    },
    threadId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'thread_id',
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'read_at',
    },
  },
  {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id', 'created_at'] },
      { fields: ['user_id', 'read_at'] },
    ],
  }
);

export default Notification;