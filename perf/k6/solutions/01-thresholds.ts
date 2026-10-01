// SOLUTION 1: thresholds for one endpoint
//
// Tags split the one big http_req_duration metric into series. A threshold can then target a single
// series with the `metric{tag:value}` syntax, so each endpoint gets the limit that suits it.
import http from 'k6/http';
import { sleep } from 'k6';
import type { Options } from 'k6/options';
import { url } from '../lib/config.ts';

export const options: Options = {
  vus: 2,
  duration: '8s',
  thresholds: {
    'http_req_duration{name:products}': ['p(95)<200'], // the endpoint we care about is strict
    'http_req_duration{name:slow}': ['p(95)<600'], // the slow one only needs to stay within its own budget
    http_req_failed: ['rate<0.01'],
  },
};

export default function (): void {
  http.get(url('/api/products?size=5'), { tags: { name: 'products' } });
  http.get(url('/api/slow?ms=400'), { tags: { name: 'slow' } });
  sleep(0.2);
}
