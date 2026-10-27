// src/models/Dispute.ts
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.config';

export const DISPUTE_CATEGORIES = [
  'price',
  'quality',
  'no_show',
  'damage',
  'communication',
  'other',
] as const;
export type DisputeCategory = typeof DISPUTE_CATEGORIES[number];

export const DISPUTE_STATUSES = [
  'open',
  'awaiting_info',
  'resolved',
  'closed',
] as const;
export type DisputeStatus = typeof DISPUTE_STATUSES[number];

export const DISPUTE_RESOLUTIONS = [
  'favours_client',
  'favours_provider',
  'mutual_agreement',
  'no_action',
] as const;
export type DisputeResolution = typeof DISPUTE_RESOLUTIONS[number];

export const DISPUTE_ROLES = ['CLIENT', 'PROVIDER'] as const;

export interface DisputeAttributes {
  id: string;
  bookingId: string;
  requestRef: string;
  raisedByUserId: string;
  raisedByRole: 'CLIENT' | 'PROVIDER';
  raisedByDisplayName: string;
  againstUserId: string;
  againstRole: 'CLIENT' | 'PROVIDER';
  againstDisplayName: string;
  category: DisputeCategory;
  reason: string;
  photos: string[];
  status: DisputeStatus;
  resolution?: DisputeResolution | null;
  finalBookingStatus?: string | null;
  resolutionNote?: string | null;
  resolvedByUserId?: string | null;
  resolvedByDisplayName?: string | null;
  resolvedAt?: Date | null;
}

export interface DisputeCreationAttributes
  extends Optional<
    DisputeAttributes,
    | 'id'
    | 'photos'
    | 'status'
    | 'resolution'
    | 'finalBookingStatus'
    | 'resolutionNote'
    | 'resolvedByUserId'
    | 'resolvedByDisplayName'
    | 'resolvedAt'
  > {}

class Dispute
  extends Model<DisputeAttributes, DisputeCreationAttributes>
  implements DisputeAttributes
{
  declare id: string;
  declare bookingId: string;
  declare requestRef: string;
  declare raisedByUserId: string;
  declare raisedByRole: 'CLIENT' | 'PROVIDER';
  declare raisedByDisplayName: string;
  declare againstUserId: string;
  declare againstRole: 'CLIENT' | 'PROVIDER';
  declare againstDisplayName: string;
  declare category: DisputeCategory;
  declare reason: string;
  declare photos: string[];
  declare status: DisputeStatus;
  declare resolution?: DisputeResolution | null;
  declare finalBookingStatus?: string | null;
  declare resolutionNote?: string | null;
  declare resolvedByUserId?: string | null;
  declare resolvedByDisplayName?: string | null;
  declare resolvedAt?: Date | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Dispute.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    bookingId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'booking_id',
    },
    requestRef: {
      type: DataTypes.STRING(30),
      allowNull: false,
      field: 'request_ref',
    },
    raisedByUserId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'raised_by_user_id',
    },
    raisedByRole: {
      type: DataTypes.ENUM(...DISPUTE_ROLES),
      allowNull: false,
      field: 'raised_by_role',
    },
    raisedByDisplayName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'raised_by_display_name',
    },
    againstUserId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'against_user_id',
    },
    againstRole: {
      type: DataTypes.ENUM(...DISPUTE_ROLES),
      allowNull: false,
      field: 'against_role',
    },
    againstDisplayName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'against_display_name',
    },
    category: {
      type: DataTypes.ENUM(...DISPUTE_CATEGORIES),
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    photos: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: false,
      defaultValue: [],
    },
    status: {
      type: DataTypes.ENUM(...DISPUTE_STATUSES),
      allowNull: false,
      defaultValue: 'open',
    },
    resolution: {
      type: DataTypes.ENUM(...DISPUTE_RESOLUTIONS),
      allowNull: true,
    },
    finalBookingStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'final_booking_status',
    },
    resolutionNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'resolution_note',
    },
    resolvedByUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'resolved_by_user_id',
    },
    resolvedByDisplayName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'resolved_by_display_name',
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'resolved_at',
    },
  },
  {
    sequelize,
    modelName: 'Dispute',
    tableName: 'disputes',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['booking_id'] },
      { fields: ['raised_by_user_id'] },
      { fields: ['against_user_id'] },
      { fields: ['status'] },
    ],
  }
);

export default Dispute;