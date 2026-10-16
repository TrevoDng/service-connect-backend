// src/types/api.types.ts
export interface AuthRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends AuthRequest {
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  token?: string;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  }
}

export interface AuthResponse extends ApiResponse {
  token: string;
  data: {
    user: any;
  };
}