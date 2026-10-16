// src/models/AuditLog.ts
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.config';

export interface AuditLogAttributes {
  id: string;
  eventType: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  userId?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: any;
}

export interface AuditLogCreationAttributes extends Optional<AuditLogAttributes, 'id' | 'userId' | 'email' | 'ipAddress' | 'userAgent' | 'details'> {}

class AuditLog extends Model<AuditLogAttributes, AuditLogCreationAttributes> implements AuditLogAttributes {
  declare id: string;
  declare eventType: string;
  declare severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  declare userId: string;
  declare email: string;
  declare ipAddress: string;
  declare userAgent: string;
  declare details: any;
  
  declare readonly createdAt: Date;
}

AuditLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    eventType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'event_type',
    },
    severity: {
      type: DataTypes.ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL'),
      defaultValue: 'INFO',
    },
    userId: {
      type: DataTypes.UUID,
      field: 'user_id',
    },
    email: {
      type: DataTypes.STRING(255),
    },
    ipAddress: {
      type: DataTypes.INET,
      field: 'ip_address',
    },
    userAgent: {
      type: DataTypes.TEXT,
      field: 'user_agent',
    },
    details: {
      type: DataTypes.JSONB,
    },
  },
  {
    sequelize,
    modelName: 'AuditLog',
    tableName: 'audit_logs',
    timestamps: true,
    underscored: true,
  }
);

export default AuditLog;