// src/models/BookingPriceHistory.ts
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.config';

export const PRICE_STAGES = [
  'suggested',
  'consultation',
  'final_proposed',
  'final_agreed',
] as const;

export type PriceStage = typeof PRICE_STAGES[number];

export interface BookingPriceHistoryAttributes {
  id: string;
  bookingId: string;
  stage: PriceStage;
  amount: number;
  byUserId: string;
  note?: string;
}

export interface BookingPriceHistoryCreationAttributes
  extends Optional<BookingPriceHistoryAttributes, 'id' | 'note'> {}

class BookingPriceHistory
  extends Model<BookingPriceHistoryAttributes, BookingPriceHistoryCreationAttributes>
  implements BookingPriceHistoryAttributes
{
  declare id: string;
  declare bookingId: string;
  declare stage: PriceStage;
  declare amount: number;
  declare byUserId: string;
  declare note?: string;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

BookingPriceHistory.init(
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
    stage: {
      type: DataTypes.ENUM(...PRICE_STAGES),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    byUserId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'by_user_id',
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'BookingPriceHistory',
    tableName: 'booking_price_history',
    timestamps: true,
    underscored: true,
  }
);

export default BookingPriceHistory;