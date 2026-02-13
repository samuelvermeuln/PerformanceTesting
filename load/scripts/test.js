import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.TARGET_URL || 'https://comunidadedoamor.site';
const MAX_VUS = parseInt(__ENV.MAX_VUS || '50');
const TEST_DURATION = __ENV.TEST_DURATION || '10m';
const RAMP_UP = __ENV.RAMP_UP || '2m';
const RAMP_DOWN = __ENV.RAMP_DOWN || '1m';

export let errorRate = new Rate('errors');
export let responseTime = new Trend('response_time');

export let options = {
    stages: [
        // Ramp-up gradual para não derrubar a VPS de uma vez
        { duration: RAMP_UP, target: Math.floor(MAX_VUS * 0.3) },
        { duration: RAMP_UP, target: MAX_VUS },
        // Carga sustentada
        { duration: TEST_DURATION, target: MAX_VUS },
        // Ramp-down
        { duration: RAMP_DOWN, target: 0 },
    ],
    thresholds: {
        http_req_duration: ['p(95)<5000'],  // 95% das requests < 5s
        errors: ['rate<0.5'],                // menos de 50% de erro
    },
    // Sem abort automático - roda até você parar manualmente
    noConnectionReuse: false,
    userAgent: 'K6-LoadTest/1.0',
    insecureSkipTLSVerify: true,
};

export default function () {
    // GET na página principal
    let res = http.get(BASE_URL, {
        headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        },
        timeout: '30s',
    });

    check(res, {
        'status is 200': (r) => r.status === 200,
        'status is not 5xx': (r) => r.status < 500,
    });

    responseTime.add(res.timings.duration);

    if (res.status >= 400) {
        errorRate.add(1);
    } else {
        errorRate.add(0);
    }

    // Sleep curto entre requests para simular usuários reais
    // mas manter throughput alto
    sleep(Math.random() * 0.5 + 0.1);
}
