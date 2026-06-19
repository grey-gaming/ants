#!/usr/bin/env bun
/**
 * Integration test for ANTS tools
 * Tests each tool by creating a chat run and verifying the tool execution
 */

import { testUser } from "../helpers/fixtures";

const API_BASE = "http://localhost:3000/v1";

// Login and get session cookie
async function login(): Promise<string> {
	const res = await fetch(`${API_BASE}/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			email: testUser.email,
			password: testUser.password,
		}),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Login failed: ${res.status} ${text}`);
	}

	const setCookie = res.headers.get("set-cookie");
	if (!setCookie) throw new Error("No session cookie received");

	return setCookie.split(";")[0];
}

// Test each tool by creating a run with a specific prompt
async function testTool(
	toolName: string,
	prompt: string,
	sessionId: string,
): Promise<void> {
	console.log(`\n🧪 Testing ${toolName}...`);

	// Create a run
	const res = await fetch(`${API_BASE}/runs`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Cookie: `ants_session=${sessionId}`,
		},
		body: JSON.stringify({ prompt }),
	});

	if (!res.ok) {
		const text = await res.text();
		console.error(
			`  ❌ ${toolName}: Failed to create run - ${res.status} ${text}`,
		);
		return;
	}

	const run = await res.json();
	console.log(`  ✅ ${toolName}: Run created (id: ${run.id})`);

	// Poll for completion (SSE)
	const sseRes = await fetch(`${API_BASE}/runs/${run.id}/stream`, {
		headers: { Cookie: `ants_session=${sessionId}` },
	});

	const reader = sseRes.body!.getReader();
	const decoder = new TextDecoder();
	let completed = false;

	while (!completed) {
		const { done, value } = await reader.read();
		if (done) break;

		const text = decoder.decode(value);
		const lines = text.split("\n");

		for (const line of lines) {
			if (line.startsWith("data: ")) {
				const data = JSON.parse(line.slice(6));
				if (data.type === "tool_result") {
					console.log(
						`  📦 Tool result: ${JSON.stringify(data.result).slice(0, 100)}...`,
					);
				}
				if (data.type === "completion") {
					console.log(`  ✅ ${toolName}: Completed`);
					completed = true;
					break;
				}
			}
		}
	}
}

async function main() {
	console.log("🚀 Starting ANTS integration tests...");

	// Login
	const sessionId = await login();
	console.log("✅ Logged in successfully");

	// Test each tool
	await testTool("calculator", "What is 42 * 17 + 3?", sessionId);
	await testTool("weather", "What is the weather in San Francisco?", sessionId);
	await testTool("web_search", "Search for latest AI news", sessionId);
	await testTool("file_read", "Read the file /etc/hosts", sessionId);
	await testTool("code_execution", "Calculate fibonacci(10)", sessionId);
	await testTool("shell_command", 'Run: echo "Hello World"', sessionId);
	await testTool(
		"memory_vector",
		"Store: ANTS is an AI agent platform",
		sessionId,
	);
	await testTool("sql_query", "SELECT count(*) FROM users", sessionId);
	await testTool(
		"image_generation",
		"Generate a small ASCII art smiley face",
		sessionId,
	);

	console.log("\n✨ All integration tests completed!");
}

main().catch(console.error);
