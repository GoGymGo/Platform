import { BadRequestException } from '@nestjs/common';
import type { OperatorWorkQueueKind } from './dto/operator.dto';
import { operatorWorkQueueKinds } from './dto/operator.dto';

export interface OperatorQueueCursor {
  createdAt: Date;
  id: string;
  kind: OperatorWorkQueueKind;
}

export interface OperatorAuditCursor {
  createdAt: Date;
  id: string;
}

export function compareOperatorQueueTuple(
  left: { createdAt: string; id: string; kind: OperatorWorkQueueKind },
  right: { createdAt: string; id: string; kind: OperatorWorkQueueKind },
): number {
  return (
    left.createdAt.localeCompare(right.createdAt) ||
    left.kind.localeCompare(right.kind) ||
    left.id.localeCompare(right.id)
  );
}

export function encodeOperatorQueueCursor(cursor: OperatorQueueCursor): string {
  return encode({
    createdAt: cursor.createdAt.toISOString(),
    id: cursor.id,
    kind: cursor.kind,
  });
}

export function decodeOperatorQueueCursor(
  value?: string,
): OperatorQueueCursor | null {
  if (!value) return null;
  const cursor = decode(value);
  const createdAt = readDate(cursor.createdAt);
  const id = readString(cursor.id, 128);
  const kind = readString(cursor.kind, 64);
  if (!operatorWorkQueueKinds.includes(kind as OperatorWorkQueueKind)) {
    throw invalidCursor();
  }
  return { createdAt, id, kind: kind as OperatorWorkQueueKind };
}

export function encodeOperatorAuditCursor(cursor: OperatorAuditCursor): string {
  return encode({ createdAt: cursor.createdAt.toISOString(), id: cursor.id });
}

export function decodeOperatorAuditCursor(
  value?: string,
): OperatorAuditCursor | null {
  if (!value) return null;
  const cursor = decode(value);
  return {
    createdAt: readDate(cursor.createdAt),
    id: readString(cursor.id, 64),
  };
}

function encode(value: Record<string, string>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decode(value: string): Record<string, unknown> {
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    );
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
      throw invalidCursor();
    }
    return decoded as Record<string, unknown>;
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw invalidCursor();
  }
}

function readDate(value: unknown): Date {
  if (typeof value !== 'string') throw invalidCursor();
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    throw invalidCursor();
  }
  return date;
}

function readString(value: unknown, maxLength: number): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLength
  ) {
    throw invalidCursor();
  }
  return value;
}

function invalidCursor(): BadRequestException {
  return new BadRequestException({
    code: 'OPERATOR_CURSOR_INVALID',
    message: 'The pagination cursor is invalid. Restart from the first page.',
  });
}
