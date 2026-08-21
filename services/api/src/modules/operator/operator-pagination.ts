import { BadRequestException } from '@nestjs/common';
import type { OperatorWorkQueueKind } from './dto/operator.dto';
import { operatorWorkQueueKinds } from './dto/operator.dto';
import type { PartnerVisitStatus } from './dto/operator-portal.dto';
import { partnerVisitStatuses } from './dto/operator-portal.dto';

export interface OperatorQueueCursor {
  createdAt: Date;
  id: string;
  kind: OperatorWorkQueueKind;
}

export interface OperatorAuditCursor {
  createdAt: Date;
  id: string;
}

export interface PartnerCompetitionCursor {
  gymLocationId: string;
  id: string;
  startsAt: Date;
}

export interface PartnerVisitCursor {
  gymLocationId: string;
  gymName: string;
  status: PartnerVisitStatus;
}

export interface GymQrCredentialCursor {
  id: string;
  version: number;
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

export function encodePartnerCompetitionCursor(
  cursor: PartnerCompetitionCursor,
): string {
  return encode({
    gymLocationId: cursor.gymLocationId,
    id: cursor.id,
    startsAt: cursor.startsAt.toISOString(),
  });
}

export function decodePartnerCompetitionCursor(
  value?: string,
): PartnerCompetitionCursor | null {
  if (!value) return null;
  const cursor = decode(value);
  return {
    gymLocationId: readString(cursor.gymLocationId, 64),
    id: readString(cursor.id, 64),
    startsAt: readDate(cursor.startsAt),
  };
}

export function encodePartnerVisitCursor(cursor: PartnerVisitCursor): string {
  return encode({
    gymLocationId: cursor.gymLocationId,
    gymName: cursor.gymName,
    status: cursor.status,
  });
}

export function decodePartnerVisitCursor(
  value?: string,
): PartnerVisitCursor | null {
  if (!value) return null;
  const cursor = decode(value);
  const status = readString(cursor.status, 32);
  if (!partnerVisitStatuses.includes(status as PartnerVisitStatus)) {
    throw invalidCursor();
  }
  return {
    gymLocationId: readString(cursor.gymLocationId, 64),
    gymName: readString(cursor.gymName, 160),
    status: status as PartnerVisitStatus,
  };
}

export function encodeGymQrCredentialCursor(
  cursor: GymQrCredentialCursor,
): string {
  return encode({ id: cursor.id, version: String(cursor.version) });
}

export function decodeGymQrCredentialCursor(
  value?: string,
): GymQrCredentialCursor | null {
  if (!value) return null;
  const cursor = decode(value);
  const versionText = readString(cursor.version, 16);
  const version = Number(versionText);
  if (!Number.isSafeInteger(version) || version < 1) throw invalidCursor();
  return { id: readString(cursor.id, 64), version };
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
