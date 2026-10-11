import { Provider } from '@angular/core';
import { BucketService } from '../services/bucket.service';
import { ConnectionService } from '../services/connection.service';
import { DEMO_MODE, DemoBucketService, DemoConnectionService } from './demo';

export const demoProviders: Provider[] = [
	{ provide: DEMO_MODE, useValue: true },
	{ provide: BucketService, useClass: DemoBucketService },
	{ provide: ConnectionService, useClass: DemoConnectionService },
];
