// src/models/Booking.ts
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.config';

// ============================================================
// STATUS ENUM (matches frontend BookingStatus exactly)
// ============================================================
export const BOOKING_STATUSES = [
  'requested',
  'accepted',
  'consultation_paid',
  'evaluated',
  'price_proposed',
  'price_agreed',
  'in_progress',
  'completed',
  'declined',
  'cancelled',
  'price_disputed',
] as const;

export type BookingStatus = typeof BOOKING_STATUSES[number];

// ============================================================
// ATTRIBUTES (Phase 1 subset)
// ============================================================
export interface BookingAttributes {
  id: string;
  requestRef: string;
  clientId: string;
  clientDisplayName: string;
  providerId: string;
  providerDisplayName: string;
  serviceTitle: string;
  serviceCategory: string;
  description: string;
  requestPhotos: string[];
  requestedDate: Date;
  status: BookingStatus;
  declineReason?: string;
  suggestedPrice: number;
  consultationFee: number;
  consultationPaidAt?: Date;
  consultationClockIn?: Date;
  consultationClockOut?: Date;
  consultationReferenceCode?: string | null;
  consultationReferenceExpiresAt?: Date | null;
  consultationNotes?: string;
  consultationPhotos: string[];
  siteVisited: boolean;
  finalPrice?: number;
  pendingCounterParty?: 'CLIENT' | 'PROVIDER' | null;
  holdFirm: boolean;
  clientCounterCount: number;
  providerCounterCount: number;
  workSessionId?: string | null;
  hasComplaint: boolean;
  complaintText?: string | null;
  clientConfirmedComplete: boolean;
}

export interface BookingCreationAttributes extends Optional<
  BookingAttributes,
  | 'id'
  | 'requestRef'
  | 'requestPhotos'
  | 'declineReason'
  | 'consultationFee' 
  | 'consultationPaidAt'
  | 'consultationClockIn'
  | 'consultationClockOut'
  | 'consultationReferenceCode'
  | 'consultationReferenceExpiresAt'
  | 'consultationNotes'
  | 'consultationPhotos'
  | 'siteVisited'
  | 'finalPrice'
  | 'pendingCounterParty'
  | 'holdFirm'
  | 'clientCounterCount'
  | 'providerCounterCount'
  | 'workSessionId'
  | 'hasComplaint'
  | 'complaintText'
  | 'clientConfirmedComplete'
> {}

class Booking
  extends Model<BookingAttributes, BookingCreationAttributes>
  implements BookingAttributes
{
  declare id: string;
  declare requestRef: string;
  declare clientId: string;
  declare clientDisplayName: string;
  declare providerId: string;
  declare providerDisplayName: string;
  declare serviceTitle: string;
  declare serviceCategory: string;
  declare description: string;
  declare requestPhotos: string[];
  declare requestedDate: Date;
  declare status: BookingStatus;
  declare declineReason?: string;
  declare suggestedPrice: number;
  declare consultationFee: number;
  declare consultationPaidAt?: Date;
  declare consultationClockIn?: Date;
  declare consultationClockOut?: Date;
  declare consultationReferenceCode?: string | null;
  declare consultationReferenceExpiresAt?: Date | null;
  declare consultationNotes?: string;
  declare consultationPhotos: string[];
  declare siteVisited: boolean;
  declare finalPrice?: number;
  declare pendingCounterParty?: 'CLIENT' | 'PROVIDER' | null;
  declare holdFirm: boolean;
  declare clientCounterCount: number;
  declare providerCounterCount: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
  declare workSessionId?: string | null;
  declare hasComplaint: boolean;
  declare complaintText?: string | null;
  declare clientConfirmedComplete: boolean;
}

Booking.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    requestRef: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
      field: 'request_ref',
    },
    clientId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'client_id',
    },
    clientDisplayName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'client_display_name',
    },
    providerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'provider_id',
    },
    providerDisplayName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'provider_display_name',
    },
    serviceTitle: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'service_title',
    },
    serviceCategory: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'service_category',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    requestPhotos: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: false,
      defaultValue: [],
      field: 'request_photos',
    },
    requestedDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'requested_date',
    },
    status: {
      type: DataTypes.ENUM(...BOOKING_STATUSES),
      allowNull: false,
      defaultValue: 'requested',
    },
    declineReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'decline_reason',
    },
    suggestedPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'suggested_price',
    },
    consultationFee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'consultation_fee',
    },
    consultationPaidAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'consultation_paid_at',
    },
        consultationClockIn: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'consultation_clock_in',
    },
    consultationClockOut: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'consultation_clock_out',
    },
    consultationReferenceCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'consultation_reference_code',
    },
    consultationReferenceExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'consultation_reference_expires_at',
    },
    consultationNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'consultation_notes',
    },
    consultationPhotos: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: false,
      defaultValue: [],
      field: 'consultation_photos',
    },
    siteVisited: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'site_visited',
    },
    finalPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'final_price',
    },
    pendingCounterParty: {
      type: DataTypes.ENUM('CLIENT', 'PROVIDER'),
      allowNull: true,
      field: 'pending_counter_party',
    },
    holdFirm: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'hold_firm',
    },
    clientCounterCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'client_counter_count',
    },
    providerCounterCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'provider_counter_count',
    },
    workSessionId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'work_session_id',
    },
        hasComplaint: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'has_complaint',
    },
    complaintText: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'complaint_text',
    },
    clientConfirmedComplete: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'client_confirmed_complete',
    },
  },
  {
    sequelize,
    modelName: 'Booking',
    tableName: 'bookings',
    timestamps: true,
    underscored: true,
  }
);

export default Booking;