let creatorInviteDismissed = false;

export function dismissCreatorInvite() {
  creatorInviteDismissed = true;
}

export function shouldShowCreatorInvite() {
  return !creatorInviteDismissed;
}
