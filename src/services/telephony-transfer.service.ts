import { Call, Provider } from '@prisma/client';
import axios from 'axios';

import { env } from '../config/env-config';

export class TelephonyTransferService {
  async transferCall(call: Pick<Call, 'externalId' | 'provider'>, transferTo: string): Promise<void> {
    if (!call.externalId) {
      throw new Error('Cannot transfer call without provider external ID');
    }

    switch (call.provider) {
      case Provider.TWILIO:
        await this.transferTwilioCall(call.externalId, transferTo);
        return;
      case Provider.EXOTEL:
      case Provider.PLIVO:
      case Provider.VONAGE:
        throw new Error(`Transfer is not implemented for provider ${call.provider}`);
      default:
        throw new Error(`Unsupported provider ${String(call.provider)}`);
    }
  }

  private async transferTwilioCall(callSid: string, transferTo: string): Promise<void> {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials are not configured');
    }

    const twiml = `<Response><Dial>${this.escapeXml(transferTo)}</Dial></Response>`;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls/${callSid}.json`;
    const payload = new URLSearchParams({ Twiml: twiml });

    await axios.post(url, payload.toString(), {
      auth: {
        username: env.TWILIO_ACCOUNT_SID,
        password: env.TWILIO_AUTH_TOKEN,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 15000,
    });
  }

  private escapeXml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export const telephonyTransferService = new TelephonyTransferService();
