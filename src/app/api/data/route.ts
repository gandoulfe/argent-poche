import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const FILE = join(process.cwd(), 'data.json');
const EMPTY = { children: [], transactions: [] };

function read() {
  if (!existsSync(FILE)) return EMPTY;
  try { return JSON.parse(readFileSync(FILE, 'utf-8')); }
  catch { return EMPTY; }
}

export async function GET() {
  return NextResponse.json(read());
}

export async function POST(req: Request) {
  const body = await req.json();
  writeFileSync(FILE, JSON.stringify(body));
  return NextResponse.json({ ok: true });
}
