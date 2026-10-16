// types/express-augmentation.d.ts
import { User as UserModel } from '../models';

declare module 'express' {
  interface Request {
    user?: UserModel;
  }
}