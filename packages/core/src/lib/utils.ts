export function generateId(): string {
	return crypto.randomUUID();
}

export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

export function truncateOutput(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text;
	return text.slice(0, maxChars) + "[TRUNCATED]";
}
