import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import { RP_ID, RP_NAME, RP_ORIGIN, FIXED_CHALLENGE } from '@/lib/store';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { action, response } = body;
  const username = 'web3-experience'; // 固定值

  if (action === 'options') {
    const userID = new TextEncoder().encode(username);

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID,
      userName: username,
      attestationType: 'none',
      supportedAlgorithmIDs: [-7, -257],
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    options.challenge = FIXED_CHALLENGE;
    return NextResponse.json(options);
  }

  if (action === 'verify') {
    if (!response) {
      return NextResponse.json({ error: 'Response is required' }, { status: 400 });
    }

    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response,
      expectedChallenge: FIXED_CHALLENGE,
      expectedOrigin: RP_ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: false,
    });

    if (verified && registrationInfo) {
      return NextResponse.json({
        verified: true,
        credentialID: registrationInfo.credentialID,
        credentialPublicKey: Buffer.from(registrationInfo.credentialPublicKey).toString('base64'),
        counter: registrationInfo.counter,
      });
    }

    return NextResponse.json({ verified: false }, { status: 400 });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
