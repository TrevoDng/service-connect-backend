// src/models/WorkSession.ts
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.config';

export const WORK_SESSION_STATUSES = [
  'arrived',
  'confirmed',
  'in_progress',
  'completed',
] as const;

export type WorkSessionStatus = typeof WORK_SESSION_STATUSES[number];

// ---------- JSONB sub-shapes (mirror frontend types) ----------

export interface ClockEventJson {
  id: string;
  type: 'in' | 'out';
  at: string;
  referenceCode?: string;
  confirmedByClient: boolean;
}

export interface WorkPhotoJson {
  id: string;
  url: string;
  caption?: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface ProgressStageJson {
  id: string;
  label: string;
  date: string;
  photos: WorkPhotoJson[];
}

export interface GateEventJson {
  status:
    | 'pending'
    | 'confirmed'
    | 'confirmed_late'
    | 'auto_proceeded'
    | 'skipped'
    | 'contested';
  attemptedAt?: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
  resolvedByDisplayName?: string;
  note?: string;
}

// ---------- Attributes ----------

export interface WorkSessionAttributes {
  id: string;
  bookingId: string;
  providerId: string;
  clientId: string;
  status: WorkSessionStatus;
  currentReferenceCode?: string | null;
  referenceCodeExpiresAt?: Date | null;
  clockEvents: ClockEventJson[];
  beforePhotos: WorkPhotoJson[];
  progressStages: ProgressStageJson[];
  finalPhotos: WorkPhotoJson[];
  daysWorked: number;
  totalHours: number;
  completedAt?: Date | null;
  arrivedAt?: Date | null;
  gateConfirmedByClient: boolean;
  gateConfirmedAt?: Date | null;
  gateEvent?: GateEventJson | null;
}

export interface WorkSessionCreationAttributes extends Optional<
  WorkSessionAttributes,
  | 'id'
  | 'status'
  | 'currentReferenceCode'
  | 'referenceCodeExpiresAt'
  | 'clockEvents'
  | 'beforePhotos'
  | 'progressStages'
  | 'finalPhotos'
  | 'daysWorked'
  | 'totalHours'
  | 'completedAt'
  | 'arrivedAt'
  | 'gateConfirmedByClient'
  | 'gateConfirmedAt'
  | 'gateEvent'
> {}

class WorkSession
  extends Model<WorkSessionAttributes, WorkSessionCreationAttributes>
  implements WorkSessionAttributes
{
  declare id: string;
  declare bookingId: string;
  declare providerId: string;
  declare clientId: string;
  declare status: WorkSessionStatus;
  declare currentReferenceCode?: string | null;
  declare referenceCodeExpiresAt?: Date | null;
  declare clockEvents: ClockEventJson[];
  declare beforePhotos: WorkPhotoJson[];
  declare progressStages: ProgressStageJson[];
  declare finalPhotos: WorkPhotoJson[];
  declare daysWorked: number;
  declare totalHours: number;
  declare completedAt?: Date | null;
  declare arrivedAt?: Date | null;
  declare gateConfirmedByClient: boolean;
  declare gateConfirmedAt?: Date | null;
  declare gateEvent?: GateEventJson | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

WorkSession.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    bookingId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'booking_id',
    },
    providerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'provider_id',
    },
    clientId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'client_id',
    },
    status: {
      type: DataTypes.ENUM(...WORK_SESSION_STATUSES),
      allowNull: false,
      defaultValue: 'arrived',
    },
    currentReferenceCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'current_reference_code',
    },
    referenceCodeExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reference_code_expires_at',
    },
    clockEvents: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      field: 'clock_events',
    },
    beforePhotos: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      field: 'before_photos',
    },
    progressStages: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      field: 'progress_stages',
    },
    finalPhotos: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      field: 'final_photos',
    },
    daysWorked: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'days_worked',
    },
    totalHours: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'total_hours',
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at',
    },
    arrivedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'arrived_at',
    },
    gateConfirmedByClient: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'gate_confirmed_by_client',
    },
    gateConfirmedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'gate_confirmed_at',
    },
    gateEvent: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'gate_event',
    },
  },
  {
    sequelize,
    modelName: 'WorkSession',
    tableName: 'work_sessions',
    timestamps: true,
    underscored: true,
  }
);

export default WorkSession;