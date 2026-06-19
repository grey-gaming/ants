// Test fixtures for integration tests
export const testUser = {
	id: "00000000-0000-0000-0000-000000000001",
	email: "admin@example.com",
	name: "Admin User",
	password: "admin123",
};

export const testAgent = {
	id: "22222222-2222-2222-2222-222222222222",
	name: "Test Agent",
	description: "Test agent for integration tests",
	modelId: "llama3",
	systemPrompt: "You are a helpful test assistant.",
	tier: "T1",
	isActive: true,
};

export const testThread = {
	id: "33333333-3333-3333-3333-333333333333",
	userId: testUser.id,
	agentTypeId: testAgent.id,
	title: "Test Thread",
};
