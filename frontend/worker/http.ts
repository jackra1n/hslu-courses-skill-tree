export function json(
	body: unknown,
	status: number,
	extraHeaders: Record<string, string> = {},
): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-store',
			...extraHeaders,
		},
	});
}

// null means the byte limit was exceeded; an absent body is an empty string.
export async function readBoundedBody(
	request: Request,
	maxBytes: number,
): Promise<string | null> {
	const reader = request.body?.getReader();
	if (!reader) return '';
	const decoder = new TextDecoder();
	let total = 0;
	let text = '';
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) return text + decoder.decode();
			total += value.byteLength;
			if (total > maxBytes) {
				await reader.cancel().catch(() => undefined);
				return null;
			}
			text += decoder.decode(value, { stream: true });
		}
	} finally {
		reader.releaseLock();
	}
}
