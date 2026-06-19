import { countTokens } from "./token-counter";

export function sseFormat(data: unknown): string {
	const payload = JSON.stringify(data);
	return `event:\ndata: ${payload}\n\n`;
}

export async function* createSSEStream(
	iterable: AsyncIterable<unknown>,
): AsyncIterable<string> {
	for await (const chunk of iterable) {
		yield sseFormat(chunk);
	}
}

export { countTokens };
