// the test harness uses an ephemeral loopback port. Keep the real API's
// origin checks unchanged by translating only this local transport origin.
export default {
	fetch(request: Request, env: E2EFrontendEnv): Promise<Response> {
		const url = new URL(request.url);
		if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
		const localOrigin = url.origin;
		url.protocol = 'http:';
		url.host = 'localhost:5173';
		const forwarded = new Request(url, request);
		forwarded.headers.set('Host', url.host);
		if (forwarded.headers.get('Origin') === localOrigin) {
			forwarded.headers.set('Origin', url.origin);
		}
		return env.API.fetch(forwarded);
	},
} satisfies ExportedHandler<E2EFrontendEnv>;
