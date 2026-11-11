// src/models/SupportTicket.ts
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.config';

// ============================================================
// STATUS / ROLE ENUMS
// ============================================================

export const SUPPORT_TICKET_STATUSES = [
  'open',
  'claimed',
  'closed',
] as const;

export type SupportTicketStatus = typeof SUPPORT_TICKET_STATUSES[number];

export const SUPPORT_REQUESTER_ROLES = [
  'CLIENT',
  'PROVIDER',
] as const;

export type SupportRequesterRole = typeof SUPPORT_REQUESTER_ROLES[number];

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

// ============================================================
// ATTRIBUTES
// ============================================================

export interface SupportTicketAttributes {
  id: string;
  requesterId: string;
  requesterRole: SupportRequesterRole;
  subject?: string | null;
  status: SupportTicketStatus;
  assignedStaffId?: string | null;
  assignedAt?: Date | null;
  lastActivityAt: Date;
  lastMessagePreview?: string | null;
  autoCloseAt: Date;
  closedAt?: Date | null;
}

export interface SupportTicketCreationAttributes
  extends Optional<
    SupportTicketAttributes,
    | 'id'
    | 'subject'
    | 'status'
    | 'assignedStaffId'
    | 'assignedAt'
    | 'lastActivityAt'
    | 'lastMessagePreview'
    | 'autoCloseAt'
    | 'closedAt'
  > {}

class SupportTicket
  extends Model<SupportTicketAttributes, SupportTicketCreationAttributes>
  implements SupportTicketAttributes
{
  declare id: string;
  declare requesterId: string;
  declare requesterRole: SupportRequesterRole;
  declare subject?: string | null;
  declare status: SupportTicketStatus;
  declare assignedStaffId?: string | null;
  declare assignedAt?: Date | null;
  declare lastActivityAt: Date;
  declare lastMessagePreview?: string | null;
  declare autoCloseAt: Date;
  declare closedAt?: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

SupportTicket.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    requesterId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'requester_id',
    },
    requesterRole: {
      type: DataTypes.ENUM(...SUPPORT_REQUESTER_ROLES),
      allowNull: false,
      field: 'requester_role',
    },
    subject: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...SUPPORT_TICKET_STATUSES),
      allowNull: false,
      defaultValue: 'open',
    },
    assignedStaffId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'assigned_staff_id',
    },
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'assigned_at',
    },
    lastActivityAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'last_activity_at',
    },
    lastMessagePreview: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'last_message_preview',
    },
    autoCloseAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'auto_close_at',
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'closed_at',
    },
  },
  {
    sequelize,
    modelName: 'SupportTicket',
    tableName: 'support_tickets',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeValidate: (ticket) => {
        const now = new Date();

        if (!ticket.lastActivityAt) {
          ticket.lastActivityAt = now;
        }

        if (!ticket.autoCloseAt) {
          ticket.autoCloseAt = new Date(
            ticket.lastActivityAt.getTime() + TWELVE_HOURS_MS
          );
        }

        if (ticket.status === 'closed' && !ticket.closedAt) {
          ticket.closedAt = now;
        }
      },
    },
    indexes: [
      { fields: ['requester_id'] },
      { fields: ['assigned_staff_id'] },
      { fields: ['status'] },
      { fields: ['last_activity_at'] },
      { fields: ['auto_close_at'] },
      { fields: ['status', 'auto_close_at'], name: 'support_tickets_autoclose_idx' },
    ],
  }
);

export default SupportTicket;