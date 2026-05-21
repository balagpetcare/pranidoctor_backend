import { AuthChannel as PrismaAuthChannel } from '../../generated/prisma/index.js';
import { AUTH_CHANNELS, type AuthChannel } from './identity-core.js';

export function toPrismaAuthChannel(channel: AuthChannel | string): PrismaAuthChannel {
  switch (channel) {
    case AUTH_CHANNELS.adminPanel:
      return PrismaAuthChannel.ADMIN_PANEL;
    case AUTH_CHANNELS.doctorPanel:
      return PrismaAuthChannel.DOCTOR_PANEL;
    case AUTH_CHANNELS.technicianPanel:
      return PrismaAuthChannel.TECHNICIAN_PANEL;
    case AUTH_CHANNELS.mobile:
    default:
      return PrismaAuthChannel.MOBILE;
  }
}
