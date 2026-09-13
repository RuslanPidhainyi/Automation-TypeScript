import { APIResponse } from '@playwright/test';
import { BuggyEndpoint } from '../../constants/endpoints';
import { HttpClient } from '../HttpClient';

/**
 * `API/Controllers/BuggyController.cs` - deterministic error responses, the
 * probes for the error pipeline. Always raw: the status is the point.
 */
export class BuggyController {
  constructor(private readonly http: HttpClient) {}

  getRaw(endpoint: BuggyEndpoint): Promise<APIResponse> {
    return this.http.get(endpoint);
  }
}
