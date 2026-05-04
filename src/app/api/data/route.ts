import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const KEY = 'argent-poche';
const EMPTY = { children: [], transactions: [] };

export async function GET() {
  const data = await redis.get(KEY);
  return NextResponse.json(data ?? EMPTY);
}

export async function POST(req: Request) {
  const body = await req.json();
  await redis.set(KEY, body);
  return NextResponse.json({ ok: true });
}
