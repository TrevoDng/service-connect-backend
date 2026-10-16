// src/config/database.config.ts
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

function requiredEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return val;
}

const sequelize = new Sequelize(
  requiredEnv('DB_NAME'),
  requiredEnv('DB_USER'),
  requiredEnv('DB_PASSWORD'),
  {
    host: requiredEnv('DB_HOST'),
    port: Number(process.env.DB_PORT) || 5433,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connected successfully');
    
    // Import models AFTER connection to avoid circular deps
    const { User, SecretCode, AuditLog } = await import('../models/index.js');
    
    // Setup associations (without firebase)
    User.hasMany(SecretCode, { 
      as: 'generatedCodes', 
      foreignKey: 'createdBy',
      constraints: false
    });
    
    User.hasMany(SecretCode, { 
      as: 'usedCodes', 
      foreignKey: 'usedBy' 
    });
    
    User.hasMany(AuditLog, { 
      foreignKey: 'userId' 
    });
    
    SecretCode.belongsTo(User, { 
      as: 'creator', 
      foreignKey: 'createdBy',
      constraints: false
    });
    
    SecretCode.belongsTo(User, { 
      as: 'user', 
      foreignKey: 'usedBy' 
    });
    
    AuditLog.belongsTo(User, { 
      foreignKey: 'userId' 
    });
    
    // Sync models
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('✅ Models synced');
    } else {
      await sequelize.sync();
      console.log('✅ Models synced (production mode)');
    }
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

export { sequelize, connectDB };
export default sequelize;