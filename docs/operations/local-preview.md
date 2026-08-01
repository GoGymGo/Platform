# Free local preview deployment

This deployment runs the real GoGymGo PostGIS database, forward migrations,
API, and operations worker in Docker. Separate free Cloudflare Quick Tunnels
give the API and browser app temporary public HTTPS URLs. Expo also remains
available locally at `http://localhost:8081`.

It is intended for development and testing only. The public URLs change after
the tunnel containers are recreated, the computer, Docker and Expo must remain
on, and Cloudflare does not provide an uptime guarantee for Quick Tunnels.

## Start

Run the preview helper from the repository root:

```powershell
.\tooling\scripts\start-free-preview.cmd
```

The script:

1. mounts the existing Google application-default credentials read-only;
2. starts PostgreSQL/PostGIS;
3. runs the complete migration set;
4. starts the API and worker;
5. creates the API HTTPS tunnel;
6. writes the new URL to the ignored `apps/member-app/.env.local`; and
7. restarts Expo so the current bundle uses that URL;
8. creates a secure browser-app HTTPS tunnel; and
9. restarts the API with both local and secure browser origins allowed.

The final output includes the local app URL, a secure phone/browser URL and the
temporary public API URL. Use the secure phone URL for location verification;
mobile browsers commonly block geolocation on plain LAN `http://` origins.

## Stop

```powershell
.\tooling\scripts\stop-free-preview.cmd
```

Stopping preserves the Docker database volume. Do not use `docker compose down
--volumes` unless the preview database is intentionally being discarded.

## Security boundary

- Never commit `services/api/.env`, `apps/member-app/.env.local`, Google credential
  files, or generated tunnel URLs.
- Authentication remains Firebase-backed. The tunnels do not bypass API
  authorization; browser and mobile requests use the same Firebase user ID and
  bearer-token guard.
- The Cloudflare containers can reach only the API or Expo web service they
  publish. PostgreSQL is not exposed through either tunnel.
- This preview is not a substitute for an always-on production deployment,
  approved public legal URLs, store identities, or physical-device testing.
