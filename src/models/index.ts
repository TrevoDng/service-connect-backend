import sequelize from '../config/database.config';
import User from './User';
import SecretCode from './SecretCode';
import AuditLog from './AuditLog';
import Service from './Service';
import Booking from './Booking';
import BookingPriceHistory from './BookingPriceHistory';
import WorkSession from './WorkSession';
import Notification, { NotificationAttributes, NotificationCreationAttributes } from './Notification';
import DisputeMessage, { DisputeMessageAttributes, DisputeMessageCreationAttributes } from './DisputeMessage';
import Dispute from './Dispute';
import Review, { ReviewAttributes, ReviewCreationAttributes } from './Review';
import ChatThread, { ChatThreadAttributes, ChatThreadCreationAttributes } from './ChatThread';
import ChatMessage, { ChatMessageAttributes, ChatMessageCreationAttributes, ChatMessageStatus, ChatAttachment } from './ChatMessage';
import RegistrationRequest from './RegistrationRequest';

export {
  sequelize,
  User,
  SecretCode,
  AuditLog,
  Service,
  Booking,
  BookingPriceHistory,
  WorkSession,
  Notification,
  NotificationAttributes,
  NotificationCreationAttributes,
  Dispute,
  DisputeMessage,
  DisputeMessageAttributes,
  DisputeMessageCreationAttributes,
  Review,
  ReviewAttributes,
  ReviewCreationAttributes,
  ChatThread,
  ChatThreadAttributes,
  ChatThreadCreationAttributes,
  ChatMessage,
  ChatMessageAttributes,
  ChatMessageCreationAttributes,
  ChatMessageStatus,
  ChatAttachment,
  RegistrationRequest,
};