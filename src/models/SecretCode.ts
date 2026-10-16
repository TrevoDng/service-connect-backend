import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.config';

export interface SecretCodeAttributes {
  id: string;
  code: string;
  isUsed: boolean;
  expiresAt: Date;
  createdBy: string;
  assignedEmail: string;
  usedBy?: string;
  usedAt?: Date;
}

export interface SecretCodeCreationAttributes extends Optional<SecretCodeAttributes, 'id' | 'isUsed' | 'usedBy' | 'usedAt'> {}

class SecretCode extends Model<SecretCodeAttributes, SecretCodeCreationAttributes> implements SecretCodeAttributes {
  declare id: string;
  declare code: string;
  declare isUsed: boolean;
  declare expiresAt: Date;
  declare createdBy: string;
  declare assignedEmail: string;
  declare usedBy: string;
  declare usedAt: Date;
  
  public readonly createdAt!: Date;
}

SecretCode.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    isUsed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_used',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'created_by',
    },
    assignedEmail: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'assigned_email',
    },
    usedBy: {
      type: DataTypes.UUID,
      field: 'used_by',
    },
    usedAt: {
      type: DataTypes.DATE,
      field: 'used_at',
    },
  },
  {
    sequelize,
    modelName: 'SecretCode',
    tableName: 'secret_codes',
    timestamps: true,
    underscored: true,
  }
);

// Define associations after model initialization
import User from './User';

// This establishes the relationship
SecretCode.belongsTo(User, { 
  foreignKey: 'createdBy', 
  as: 'createdByAdmin',
  targetKey: 'id'
});

export default SecretCode;