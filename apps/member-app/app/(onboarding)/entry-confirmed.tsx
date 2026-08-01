import { Redirect } from 'expo-router';

export default function EntryConfirmedRedirect() {
  return (
    <Redirect
      href={{
        pathname: '/home',
        params: { registered: '1' }
      }}
    />
  );
}
