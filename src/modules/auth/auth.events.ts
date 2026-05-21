import { eventBus, EventTypes } from '../../shared/events/index.js';

export interface OtpRequestedPayload {
  phone: string;
  requestId: string;
  timestamp: Date;
}

export interface OtpVerifiedPayload {
  userId: string;
  phone: string;
  isNewUser: boolean;
  timestamp: Date;
}

export interface LoginPayload {
  userId: string;
  context: string;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface LogoutPayload {
  userId: string;
  timestamp: Date;
}

export const authEvents = {
  emitOtpRequested: async (payload: OtpRequestedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.AUTH_OTP_REQUESTED, payload, 'auth');
  },

  emitOtpVerified: async (payload: OtpVerifiedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.AUTH_OTP_VERIFIED, payload, 'auth');
  },

  emitLogin: async (payload: LoginPayload): Promise<void> => {
    await eventBus.publish(EventTypes.AUTH_LOGIN, payload, 'auth');
  },

  emitLogout: async (payload: LogoutPayload): Promise<void> => {
    await eventBus.publish(EventTypes.AUTH_LOGOUT, payload, 'auth');
  },
};
