// src/models/Service.ts
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.config';

export interface ServiceAttributes {
  id: string;
  providerId: string;
  title: string;
  description: string;
  category: string;
  price?: string;
  location: string;
  availability?: string;
  estimatedDuration?: string;
  skills: string[];
  status: 'pending' | 'active' | 'completed' | 'deleted';
}

export interface ServiceCreationAttributes extends Optional<
  ServiceAttributes,
  'id' | 'price' | 'availability' | 'estimatedDuration' | 'skills' | 'status'
> {}

class Service extends Model<ServiceAttributes, ServiceCreationAttributes> implements ServiceAttributes {
  declare id: string;
  declare providerId: string;
  declare title: string;
  declare description: string;
  declare category: string;
  declare price?: string;
  declare location: string;
  declare availability?: string;
  declare estimatedDuration?: string;
  declare skills: string[];
  declare status: 'pending' | 'active' | 'completed' | 'deleted';

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Service.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    providerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'provider_id',
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    price: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    availability: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    estimatedDuration: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'estimated_duration',
    },
    skills: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'completed', 'deleted'),
      allowNull: false,
      defaultValue: 'active',
    },
  },
  {
    sequelize,
    modelName: 'Service',
    tableName: 'services',
    timestamps: true,
    underscored: true,
  }
);

export default Service;