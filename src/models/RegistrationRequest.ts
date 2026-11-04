import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.config';

export interface RegistrationRequestAttributes {
  id: string;
  role: 'EMPLOYEE' | 'PROVIDER';
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  documents: string[]; // Array of uploaded file URLs
  status: 'pending' | 'declined' | 'approved';
}

export interface RegistrationRequestCreationAttributes
  extends Optional<RegistrationRequestAttributes, 'id' | 'phone' | 'status'> {}

class RegistrationRequest
  extends Model<RegistrationRequestAttributes, RegistrationRequestCreationAttributes>
  implements RegistrationRequestAttributes
{
  declare id: string;
  declare role: 'EMPLOYEE' | 'PROVIDER';
  declare firstName: string;
  declare lastName: string;
  declare email: string;
  declare phone?: string;
  declare documents: string[];
  declare status: 'pending' | 'declined' | 'approved';
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

RegistrationRequest.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    role: { type: DataTypes.ENUM('EMPLOYEE', 'PROVIDER'), allowNull: false },
    firstName: { type: DataTypes.STRING, allowNull: false },
    lastName: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    documents: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [] },
    status: { type: DataTypes.ENUM('pending', 'declined', 'approved'), defaultValue: 'pending' },
  },
  {
    sequelize,
    modelName: 'RegistrationRequest',
    tableName: 'registration_requests',
    timestamps: true,
    underscored: true,
  }
);

export default RegistrationRequest;