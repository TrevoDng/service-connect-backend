// models/User.ts
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.config';
import bcrypt from 'bcryptjs';

export interface UserAttributes {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phone?: string; // Made optional with '?'
  serviceType?: string;
  companyName?: string;
  registrationNumber?: string;
  role: 'ADMIN' | 'EMPLOYEE' | 'CLIENT' | 'PROVIDER';
  status: 'pending_email' | 'email_verified' | 'pending_approval' | 'active' | 'rejected' | 'deactivated';
  secretCode?: string;
  lastLogin?: Date;
  createdBy?: string;
  approvedAt?: Date;
  approvedBy?: string;
  verificationToken?: string;
  verificationTokenExpires?: Date;
}

// Add 'phone' and 'verificationToken' and 'verificationTokenExpires' to Optional
export interface UserCreationAttributes extends Optional<UserAttributes, 
  'id' | 
  'phone' | 
  'secretCode' | 
  'lastLogin' | 
  'createdBy' | 
  'approvedAt' | 
  'approvedBy' | 
  'verificationToken' | 
  'verificationTokenExpires' | 
  'serviceType' | 
  'companyName' |
  'registrationNumber'
> {}

// ✅ FIXED: Use 'declare' keyword to prevent shadowing and not use public/private keywords in Model definition
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: string;
  declare email: string;
  declare firstName: string;
  declare lastName: string;
  declare phone?: string; // Made optional
  declare serviceType?: string;
  declare companyName?: string;
  declare registrationNumber?: string;
  declare password: string;
  declare role: 'ADMIN' | 'EMPLOYEE' | 'CLIENT' 'PROVIDER';
  declare status: 'pending_email' | 'email_verified' | 'pending_approval' | 'active' | 'rejected' | 'deactivated';
   declare secretCode?: string;
  declare lastLogin?: Date;
  declare createdBy?: string;
  declare approvedAt?: Date;
  declare approvedBy?: string;
  declare verificationToken?: string;
  declare verificationTokenExpires?: Date;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  public async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    firstName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true, // Already optional in database
    },
    serviceType: {
      type: DataTypes.STRING(255),
      field: 'service_type',
      allowNull: true,
    },
    companyName: {
      type: DataTypes.STRING(255),
      field: 'company_name',
      allowNull: true,
    },
    registrationNumber: {
      type: DataTypes.STRING(255),
      field: 'registration_number',
      allowNull: true,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('ADMIN', 'EMPLOYEE', 'CLIENT', 'PROVIDER'),
      defaultValue: 'CLIENT',
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending_email', 'email_verified', 'pending_approval', 'active', 'rejected', 'deactivated'),
      defaultValue: 'pending_email',
      allowNull: false,
    },
    secretCode: {
      type: DataTypes.STRING(255),
      field: 'secret_code',
      allowNull: true,
    },
    lastLogin: {
      type: DataTypes.DATE,
      field: 'last_login',
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.STRING(255),
      field: 'created_by',
      allowNull: true,
    },
    approvedAt: {
      type: DataTypes.DATE,
      field: 'approved_at',
      allowNull: true,
    },
    approvedBy: {
      type: DataTypes.STRING(255),
      field: 'approved_by',
      allowNull: true,
    },
    verificationToken: {
      type: DataTypes.STRING(255),
      field: 'verification_token',
      allowNull: true,
    },
    verificationTokenExpires: {
      type: DataTypes.DATE,
      field: 'verification_token_expires',
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    underscored: true,
    // hooks: {
    //   beforeCreate: async (user: User) => {
    //     console.log('🔐 BEFORE CREATE HOOK FIRED!');
    //     console.log('Original password:', user.password);
    //     if (user.password) {
    //       user.password = await bcrypt.hash(user.password, 12);
    //       console.log('Hashed password:', user.password);
    //     }
    //   },
    //   beforeUpdate: async (user: User) => {
    //     console.log('🔄 BEFORE UPDATE HOOK FIRED!');
    //     if (user.changed('password')) {
    //       console.log('Password changed, hashing...');
    //       user.password = await bcrypt.hash(user.password, 12);
    //     }
    //   },
    // },
  }
);



export default User;
