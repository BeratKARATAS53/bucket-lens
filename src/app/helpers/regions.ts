export type ProviderId = 'backblaze' | 'wasabi' | 's3' | 'r2' | 'spaces' | 'minio' | 'ftp';

export interface StorageRegion {
	id: string;
	label: string;
	endpoint: string;
}

export const PROVIDERS: readonly ProviderId[] = [
	'backblaze',
	'wasabi',
	's3',
	'r2',
	'spaces',
	'minio',
	'ftp',
];

const BACKBLAZE_REGIONS: readonly StorageRegion[] = [
	{ id: 'us-west-000', label: 'US West', endpoint: 's3.us-west-000.backblazeb2.com' },
	{ id: 'us-west-001', label: 'US West', endpoint: 's3.us-west-001.backblazeb2.com' },
	{ id: 'us-west-002', label: 'US West', endpoint: 's3.us-west-002.backblazeb2.com' },
	{ id: 'eu-central-003', label: 'EU Central', endpoint: 's3.eu-central-003.backblazeb2.com' },
	{ id: 'us-west-004', label: 'US West', endpoint: 's3.us-west-004.backblazeb2.com' },
	{ id: 'us-east-005', label: 'US East', endpoint: 's3.us-east-005.backblazeb2.com' },
	{ id: 'ca-east-006', label: 'CA East', endpoint: 's3.ca-east-006.backblazeb2.com' },
];

const WASABI_REGIONS: readonly StorageRegion[] = [
	{ id: 'us-east-1', label: 'US East 1 (N. Virginia)', endpoint: 's3.wasabisys.com' },
	{ id: 'us-east-2', label: 'US East 2 (N. Virginia)', endpoint: 's3.us-east-2.wasabisys.com' },
	{
		id: 'us-central-1',
		label: 'US Central 1 (Texas)',
		endpoint: 's3.us-central-1.wasabisys.com',
	},
	{ id: 'us-west-1', label: 'US West 1 (Oregon)', endpoint: 's3.us-west-1.wasabisys.com' },
	{ id: 'us-west-2', label: 'US West 2 (San Jose)', endpoint: 's3.us-west-2.wasabisys.com' },
	{
		id: 'ca-central-1',
		label: 'CA Central 1 (Toronto)',
		endpoint: 's3.ca-central-1.wasabisys.com',
	},
	{
		id: 'eu-central-1',
		label: 'EU Central 1 (Amsterdam)',
		endpoint: 's3.eu-central-1.wasabisys.com',
	},
	{
		id: 'eu-central-2',
		label: 'EU Central 2 (Frankfurt)',
		endpoint: 's3.eu-central-2.wasabisys.com',
	},
	{
		id: 'eu-west-1',
		label: 'EU West 1 (United Kingdom)',
		endpoint: 's3.eu-west-1.wasabisys.com',
	},
	{ id: 'eu-west-2', label: 'EU West 2 (Paris)', endpoint: 's3.eu-west-2.wasabisys.com' },
	{
		id: 'eu-west-3',
		label: 'EU West 3 (United Kingdom)',
		endpoint: 's3.eu-west-3.wasabisys.com',
	},
	{ id: 'eu-south-1', label: 'EU South 1 (Milan)', endpoint: 's3.eu-south-1.wasabisys.com' },
	{
		id: 'ap-northeast-1',
		label: 'AP Northeast 1 (Tokyo)',
		endpoint: 's3.ap-northeast-1.wasabisys.com',
	},
	{
		id: 'ap-northeast-2',
		label: 'AP Northeast 2 (Osaka)',
		endpoint: 's3.ap-northeast-2.wasabisys.com',
	},
	{
		id: 'ap-southeast-1',
		label: 'AP Southeast 1 (Singapore)',
		endpoint: 's3.ap-southeast-1.wasabisys.com',
	},
	{
		id: 'ap-southeast-2',
		label: 'AP Southeast 2 (Sydney)',
		endpoint: 's3.ap-southeast-2.wasabisys.com',
	},
];

const S3_REGIONS: readonly StorageRegion[] = [
	{ id: 'us-east-1', label: 'US East (N. Virginia)', endpoint: 's3.us-east-1.amazonaws.com' },
	{ id: 'us-east-2', label: 'US East (Ohio)', endpoint: 's3.us-east-2.amazonaws.com' },
	{ id: 'us-west-1', label: 'US West (N. California)', endpoint: 's3.us-west-1.amazonaws.com' },
	{ id: 'us-west-2', label: 'US West (Oregon)', endpoint: 's3.us-west-2.amazonaws.com' },
	{ id: 'ca-central-1', label: 'Canada (Central)', endpoint: 's3.ca-central-1.amazonaws.com' },
	{ id: 'ca-west-1', label: 'Canada West (Calgary)', endpoint: 's3.ca-west-1.amazonaws.com' },
	{ id: 'mx-central-1', label: 'Mexico (Central)', endpoint: 's3.mx-central-1.amazonaws.com' },
	{ id: 'sa-east-1', label: 'South America (São Paulo)', endpoint: 's3.sa-east-1.amazonaws.com' },
	{ id: 'eu-central-1', label: 'Europe (Frankfurt)', endpoint: 's3.eu-central-1.amazonaws.com' },
	{ id: 'eu-central-2', label: 'Europe (Zurich)', endpoint: 's3.eu-central-2.amazonaws.com' },
	{ id: 'eu-west-1', label: 'Europe (Ireland)', endpoint: 's3.eu-west-1.amazonaws.com' },
	{ id: 'eu-west-2', label: 'Europe (London)', endpoint: 's3.eu-west-2.amazonaws.com' },
	{ id: 'eu-west-3', label: 'Europe (Paris)', endpoint: 's3.eu-west-3.amazonaws.com' },
	{ id: 'eu-north-1', label: 'Europe (Stockholm)', endpoint: 's3.eu-north-1.amazonaws.com' },
	{ id: 'eu-south-1', label: 'Europe (Milan)', endpoint: 's3.eu-south-1.amazonaws.com' },
	{ id: 'eu-south-2', label: 'Europe (Spain)', endpoint: 's3.eu-south-2.amazonaws.com' },
	{ id: 'af-south-1', label: 'Africa (Cape Town)', endpoint: 's3.af-south-1.amazonaws.com' },
	{ id: 'ap-east-1', label: 'Asia Pacific (Hong Kong)', endpoint: 's3.ap-east-1.amazonaws.com' },
	{ id: 'ap-south-1', label: 'Asia Pacific (Mumbai)', endpoint: 's3.ap-south-1.amazonaws.com' },
	{
		id: 'ap-south-2',
		label: 'Asia Pacific (Hyderabad)',
		endpoint: 's3.ap-south-2.amazonaws.com',
	},
	{
		id: 'ap-southeast-1',
		label: 'Asia Pacific (Singapore)',
		endpoint: 's3.ap-southeast-1.amazonaws.com',
	},
	{
		id: 'ap-southeast-2',
		label: 'Asia Pacific (Sydney)',
		endpoint: 's3.ap-southeast-2.amazonaws.com',
	},
	{
		id: 'ap-southeast-3',
		label: 'Asia Pacific (Jakarta)',
		endpoint: 's3.ap-southeast-3.amazonaws.com',
	},
	{
		id: 'ap-southeast-4',
		label: 'Asia Pacific (Melbourne)',
		endpoint: 's3.ap-southeast-4.amazonaws.com',
	},
	{
		id: 'ap-southeast-5',
		label: 'Asia Pacific (Malaysia)',
		endpoint: 's3.ap-southeast-5.amazonaws.com',
	},
	{
		id: 'ap-northeast-1',
		label: 'Asia Pacific (Tokyo)',
		endpoint: 's3.ap-northeast-1.amazonaws.com',
	},
	{
		id: 'ap-northeast-2',
		label: 'Asia Pacific (Seoul)',
		endpoint: 's3.ap-northeast-2.amazonaws.com',
	},
	{
		id: 'ap-northeast-3',
		label: 'Asia Pacific (Osaka)',
		endpoint: 's3.ap-northeast-3.amazonaws.com',
	},
	{ id: 'me-south-1', label: 'Middle East (Bahrain)', endpoint: 's3.me-south-1.amazonaws.com' },
	{ id: 'me-central-1', label: 'Middle East (UAE)', endpoint: 's3.me-central-1.amazonaws.com' },
	{ id: 'il-central-1', label: 'Israel (Tel Aviv)', endpoint: 's3.il-central-1.amazonaws.com' },
];

const R2_REGIONS: readonly StorageRegion[] = [
	{
		id: 'auto',
		label: 'Automatic',
		endpoint: '<account-id>.r2.cloudflarestorage.com',
	},
	{ id: 'wnam', label: 'Western North America', endpoint: '<account-id>.r2.cloudflarestorage.com' },
	{ id: 'enam', label: 'Eastern North America', endpoint: '<account-id>.r2.cloudflarestorage.com' },
	{ id: 'weur', label: 'Western Europe', endpoint: '<account-id>.r2.cloudflarestorage.com' },
	{ id: 'eeur', label: 'Eastern Europe', endpoint: '<account-id>.r2.cloudflarestorage.com' },
	{ id: 'apac', label: 'Asia Pacific', endpoint: '<account-id>.r2.cloudflarestorage.com' },
];

const SPACES_REGIONS: readonly StorageRegion[] = [
	{ id: 'nyc3', label: 'New York', endpoint: 'nyc3.digitaloceanspaces.com' },
	{ id: 'sfo3', label: 'San Francisco', endpoint: 'sfo3.digitaloceanspaces.com' },
	{ id: 'ams3', label: 'Amsterdam', endpoint: 'ams3.digitaloceanspaces.com' },
	{ id: 'sgp1', label: 'Singapore', endpoint: 'sgp1.digitaloceanspaces.com' },
	{ id: 'fra1', label: 'Frankfurt', endpoint: 'fra1.digitaloceanspaces.com' },
	{ id: 'tor1', label: 'Toronto', endpoint: 'tor1.digitaloceanspaces.com' },
	{ id: 'blr1', label: 'Bangalore', endpoint: 'blr1.digitaloceanspaces.com' },
	{ id: 'syd1', label: 'Sydney', endpoint: 'syd1.digitaloceanspaces.com' },
];

const MINIO_REGIONS: readonly StorageRegion[] = [
	{ id: 'us-east-1', label: 'Default', endpoint: 'localhost:9000' },
];

const REGIONS: Record<Exclude<ProviderId, 'ftp'>, readonly StorageRegion[]> = {
	backblaze: BACKBLAZE_REGIONS,
	wasabi: WASABI_REGIONS,
	s3: S3_REGIONS,
	r2: R2_REGIONS,
	spaces: SPACES_REGIONS,
	minio: MINIO_REGIONS,
};

const CLUSTER_TO_REGION: Record<string, string> = {
	'000': 'us-west-000',
	'001': 'us-west-001',
	'002': 'us-west-002',
	'003': 'eu-central-003',
	'004': 'us-west-004',
	'005': 'us-east-005',
	'006': 'ca-east-006',
};

export function isProvider(value: string): value is ProviderId {
	return (PROVIDERS as readonly string[]).includes(value);
}

export function providerLabelKey(
	provider: string,
):
	| 'providerBackblaze'
	| 'providerWasabi'
	| 'providerS3'
	| 'providerR2'
	| 'providerSpaces'
	| 'providerMinio'
	| 'providerFtp' {
	if (provider === 'wasabi') return 'providerWasabi';
	if (provider === 's3') return 'providerS3';
	if (provider === 'r2') return 'providerR2';
	if (provider === 'spaces') return 'providerSpaces';
	if (provider === 'minio') return 'providerMinio';
	if (provider === 'ftp') return 'providerFtp';

	return 'providerBackblaze';
}

export function regionsFor(provider: ProviderId): readonly StorageRegion[] {
	if (provider === 'ftp') return [];

	return REGIONS[provider];
}

export function defaultRegion(provider: ProviderId): StorageRegion {
	if (provider === 'ftp') return { id: '21', label: '21', endpoint: '' };

	const regions = regionsFor(provider);
	const preferred =
		provider === 'backblaze'
			? 'us-west-004'
			: provider === 'r2'
				? 'auto'
				: provider === 'spaces'
					? 'nyc3'
					: provider === 'minio'
						? 'us-east-1'
						: 'us-east-1';
	return regions.find((region) => region.id === preferred) ?? regions[0];
}

export function regionFromKeyId(keyId: string): string | null {
	const trimmed = keyId.trim();
	if (!/^\d{3}[0-9a-f]{12,}$/i.test(trimmed)) return null;

	return CLUSTER_TO_REGION[trimmed.slice(0, 3)] ?? null;
}

export function regionById(provider: ProviderId, id: string): StorageRegion | undefined {
	return regionsFor(provider).find((region) => region.id === id);
}

export function isKnownEndpoint(endpoint: string): boolean {
	return (['backblaze', 'wasabi', 's3', 'r2', 'spaces', 'minio'] as const).some((provider) =>
		regionsFor(provider).some((region) => region.endpoint === endpoint),
	);
}

export function normalizeEndpoint(value: string): string {
	return value
		.trim()
		.replace(/^(https?|ftps?):\/\//i, '')
		.replace(/\/.*$/, '')
		.trim();
}

export function connectionTitle(connection: {
	name?: string;
	provider: string;
	bucket: string;
	endpoint: string;
}): string {
	const label = connection.name?.trim();
	if (label) return label;

	if (connection.provider !== 'ftp') return connection.bucket;

	const path = connection.bucket.replace(/^\/+|\/+$/g, '');
	return path || connection.endpoint;
}

export function connectionMeta(connection: {
	provider: string;
	region: string;
	endpoint: string;
}): string {
	if (connection.provider !== 'ftp') return connection.region;

	const port = connection.region && connection.region !== '21' ? `:${connection.region}` : '';
	return `${connection.endpoint}${port}`;
}

export function objectUrl(
	connection: {
		provider: string;
		endpoint: string;
		bucket: string;
		region?: string;
		secure?: boolean;
	},
	key: string,
): string {
	const encodedKey = key
		.split('/')
		.map((part) => encodeURIComponent(part))
		.join('/');
	if (connection.provider === 'ftp') {
		const scheme = connection.secure ? 'ftps' : 'ftp';
		const port = connection.region && connection.region !== '21' ? `:${connection.region}` : '';
		const root = connection.bucket.replace(/^\/+|\/+$/g, '');
		const path = [root, key.replace(/^\/+/, '')].filter(Boolean).join('/');
		return `${scheme}://${connection.endpoint}${port}/${path}`;
	}
	if (connection.provider === 's3') {
		return `https://${connection.bucket}.${connection.endpoint}/${encodedKey}`;
	}

	const scheme = connection.provider === 'minio' && connection.endpoint.includes('localhost')
		? 'http'
		: 'https';
	return `${scheme}://${connection.endpoint}/${encodeURIComponent(connection.bucket)}/${encodedKey}`;
}
