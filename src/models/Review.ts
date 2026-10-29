// src/models/Review.ts
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.config';

export interface ReviewAttributes {
  id: string;
  bookingId: string;
  clientId: string;
  clientDisplayName: string;
  providerId: string;
  providerDisplayName: string;
  rating: number;
  comment?: string | null;
  photos: string[];
  tags: string[];
  wouldRecommend: boolean;
  providerReplyText?: string | null;
  providerRepliedAt?: Date | null;
}

export interface ReviewCreationAttributes
  extends Optional<
    ReviewAttributes,
    | 'id'
    | 'comment'
    | 'photos'
    | 'tags'
    | 'wouldRecommend'
    | 'providerReplyText'
    | 'providerRepliedAt'
  > {}

class Review
  extends Model<ReviewAttributes, ReviewCreationAttributes>
  implements ReviewAttributes
{
  declare id: string;
  declare bookingId: string;
  declare clientId: string;
  declare clientDisplayName: string;
  declare providerId: string;
  declare providerDisplayName: string;
  declare rating: number;
  declare comment?: string | null;
  declare photos: string[];
  declare tags: string[];
  declare wouldRecommend: boolean;
  declare providerReplyText?: string | null;
  declare providerRepliedAt?: Date | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Review.init(
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
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    photos: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: false,
      defaultValue: [],
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    wouldRecommend: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'would_recommend',
    },
    providerReplyText: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'provider_reply_text',
    },
    providerRepliedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'provider_replied_at',
    },
  },
  {
    sequelize,
    modelName: 'Review',
    tableName: 'reviews',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['provider_id'] },
      { fields: ['client_id'] },
    ],
  }
);

export default Review;