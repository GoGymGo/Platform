import { defaultProvider } from '@aws-sdk/credential-provider-node';
import type { Credential } from 'firebase-admin/app';
import {
  AwsClient,
  type AwsClientOptions,
  type AwsSecurityCredentialsSupplier,
} from 'google-auth-library';

const awsSubjectTokenType =
  'urn:ietf:params:aws:token-type:aws4_request' as const;
const googleStsTokenUrl = 'https://sts.googleapis.com/v1/token' as const;
const workloadProviderAudience =
  /^\/\/iam\.googleapis\.com\/projects\/[1-9][0-9]*\/locations\/global\/workloadIdentityPools\/[a-z0-9-]{4,32}\/providers\/[a-z0-9-]{4,32}$/;
const awsRegion = /^[a-z]{2}(?:-gov)?-[a-z]+-[1-9][0-9]*$/;
const googleProjectId = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

const firebaseScopes = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/firebase.database',
  'https://www.googleapis.com/auth/firebase.messaging',
  'https://www.googleapis.com/auth/identitytoolkit',
  'https://www.googleapis.com/auth/userinfo.email',
];

export interface FirebaseAwsFederationConfig {
  audience: string;
  service_account_impersonation_url: string;
  subject_token_type: typeof awsSubjectTokenType;
  token_url: typeof googleStsTokenUrl;
  type: 'external_account';
}

interface AwsCredentialIdentity {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

interface FirebaseAwsFederationDependencies {
  createAwsClient?: (
    options: AwsClientOptions,
  ) => Pick<AwsClient, 'credentials' | 'getAccessToken'>;
  getAwsCredentials?: () => Promise<AwsCredentialIdentity>;
  now?: () => number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isFirebaseAwsFederationConfig(
  value: unknown,
): value is FirebaseAwsFederationConfig {
  return isRecord(value) && value.type === 'external_account';
}

function validateConfig(
  config: FirebaseAwsFederationConfig,
  expectedProjectId: string,
): void {
  if (!googleProjectId.test(expectedProjectId)) {
    throw new Error('A valid Firebase project ID is required.');
  }
  if (!workloadProviderAudience.test(config.audience)) {
    throw new Error('Invalid Google workload identity provider audience.');
  }
  if (config.subject_token_type !== awsSubjectTokenType) {
    throw new Error('Invalid AWS workload identity subject token type.');
  }
  if (config.token_url !== googleStsTokenUrl) {
    throw new Error('Invalid Google Security Token Service URL.');
  }

  const impersonationUrl = new URL(config.service_account_impersonation_url);
  if (
    impersonationUrl.origin !== 'https://iamcredentials.googleapis.com' ||
    impersonationUrl.search !== '' ||
    impersonationUrl.hash !== ''
  ) {
    throw new Error('Invalid Google service-account impersonation URL.');
  }

  const match = impersonationUrl.pathname.match(
    /^\/v1\/projects\/-\/serviceAccounts\/([^/]+):generateAccessToken$/,
  );
  const serviceAccountEmail = match ? decodeURIComponent(match[1] ?? '') : '';
  if (
    !/^[a-z0-9][a-z0-9-]*@[a-z0-9.-]+\.iam\.gserviceaccount\.com$/.test(
      serviceAccountEmail,
    ) ||
    !serviceAccountEmail.endsWith(
      `@${expectedProjectId}.iam.gserviceaccount.com`,
    )
  ) {
    throw new Error(
      'The impersonated service account must belong to the Firebase project.',
    );
  }
}

export function createFirebaseAwsFederatedCredential(
  config: FirebaseAwsFederationConfig,
  expectedProjectId: string,
  region: string,
  dependencies: FirebaseAwsFederationDependencies = {},
): Credential {
  validateConfig(config, expectedProjectId);
  if (!awsRegion.test(region)) {
    throw new Error('A valid AWS region is required for Firebase federation.');
  }

  const getAwsCredentials = dependencies.getAwsCredentials ?? defaultProvider();
  const supplier: AwsSecurityCredentialsSupplier = {
    getAwsRegion: () => Promise.resolve(region),
    getAwsSecurityCredentials: async () => {
      const credentials = await getAwsCredentials();
      return {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        ...(credentials.sessionToken
          ? { token: credentials.sessionToken }
          : {}),
      };
    },
  };

  const createAwsClient =
    dependencies.createAwsClient ??
    ((options: AwsClientOptions) => new AwsClient(options));
  const client = createAwsClient({
    audience: config.audience,
    aws_security_credentials_supplier: supplier,
    scopes: firebaseScopes,
    service_account_impersonation_url: config.service_account_impersonation_url,
    subject_token_type: config.subject_token_type,
    token_url: config.token_url,
    type: config.type,
  });
  const now = dependencies.now ?? Date.now;

  return {
    async getAccessToken() {
      const accessToken = await client.getAccessToken();
      const expiryDate = client.credentials.expiry_date;
      if (!accessToken.token || !expiryDate || expiryDate <= now()) {
        throw new Error(
          'Google workload identity federation did not return a valid access token.',
        );
      }
      return {
        access_token: accessToken.token,
        expires_in: Math.max(1, Math.floor((expiryDate - now()) / 1_000)),
      };
    },
  };
}
