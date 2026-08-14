import { BadRequestException } from '@nestjs/common';

const aliasPattern = /^[A-Z0-9_]{3,24}$/;
const generatedPrivateAliasPattern = /^GG_[A-F0-9]{12}$/;
const reservedAliasPattern =
  /^(GOGYMGO|ADMIN|ADMINISTRATOR|MODERATOR|OFFICIAL|SUPPORT|SYSTEM)(_|$)/;

export function normalizeAlias(value: string): string {
  return value.trim().toUpperCase();
}

export function aliasValidationError(value: string): string | null {
  const alias = normalizeAlias(value);
  if (alias.length < 3 || alias.length > 24) {
    return 'Use 3-24 characters.';
  }
  if (!aliasPattern.test(alias)) {
    return 'Use ASCII letters, numbers, and underscores only.';
  }
  if (
    reservedAliasPattern.test(alias) ||
    generatedPrivateAliasPattern.test(alias)
  ) {
    return 'Choose an Alias that is not reserved by GoGymGo.';
  }
  return null;
}

export function requireValidPublicAlias(value: string): string {
  const alias = normalizeAlias(value);
  const message = aliasValidationError(alias);
  if (message) {
    throw new BadRequestException({
      code: 'SCREEN_NAME_INVALID',
      message,
    });
  }
  return alias;
}

export function isGeneratedPrivateAlias(value: string): boolean {
  return generatedPrivateAliasPattern.test(normalizeAlias(value));
}
