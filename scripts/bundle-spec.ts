import { readdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OPENAPI_DIR = join(__dirname, "..", "openapi");

function readYamlFile(filePath: string): unknown {
	const content = readFileSync(filePath, "utf-8");
	return YAML.parse(content);
}

function readAndMergeDir(dirPath: string): Record<string, unknown> {
	const merged: Record<string, unknown> = {};
	const files = readdirSync(dirPath)
		.filter((f) => f.endsWith(".yaml"))
		.sort();

	for (const file of files) {
		const content = readYamlFile(join(dirPath, file));
		if (content && typeof content === "object") {
			Object.assign(merged, content);
		}
	}

	return merged;
}

function resolveRefs(obj: unknown, basePath: string): unknown {
	if (obj === null || obj === undefined) {
		return obj;
	}
	if (typeof obj === "string") {
		return obj;
	}
	if (Array.isArray(obj)) {
		return obj.map((item) => resolveRefs(item, basePath));
	}
	if (typeof obj === "object") {
		const record = obj as Record<string, unknown>;
		if (typeof record.$ref === "string") {
			const ref = record.$ref as string;
			if (ref.endsWith(".yaml") || ref.includes(".yaml#")) {
				return resolveFileRef(ref, basePath);
			}
			return record;
		}
		const resolved: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(record)) {
			resolved[key] = resolveRefs(value, basePath);
		}
		return resolved;
	}
	return obj;
}

function resolveFileRef(ref: string, fromPath: string): unknown {
	const hashIndex = ref.indexOf("#");
	const filePath = hashIndex >= 0 ? ref.substring(0, hashIndex) : ref;
	const fragment = hashIndex >= 0 ? ref.substring(hashIndex + 1) : "";

	const fullPath = join(fromPath, filePath);
	const content = readYamlFile(fullPath);

	if (!fragment) {
		return resolveRefs(content, dirname(fullPath));
	}

	const parts = fragment.split("/");
	let current: unknown = content;
	for (const part of parts) {
		if (part === "" || part === undefined) continue;
		if (current && typeof current === "object") {
			current = (current as Record<string, unknown>)[part];
		} else {
			return { $ref: ref };
		}
	}

	return resolveRefs(current, dirname(fullPath));
}

function main(): void {
	const spec = readYamlFile(join(OPENAPI_DIR, "spec.yaml")) as Record<
		string,
		unknown
	>;

	const paths = readAndMergeDir(join(OPENAPI_DIR, "paths"));
	const schemas = readAndMergeDir(join(OPENAPI_DIR, "schemas"));
	const parameters = readYamlFile(
		join(OPENAPI_DIR, "parameters.yaml"),
	) as Record<string, unknown>;
	const responses = readYamlFile(join(OPENAPI_DIR, "responses.yaml")) as Record<
		string,
		unknown
	>;

	const resolvedPaths = resolveRefs(
		paths,
		join(OPENAPI_DIR, "paths"),
	) as Record<string, unknown>;
	const resolvedSchemas = resolveRefs(
		schemas,
		join(OPENAPI_DIR, "schemas"),
	) as Record<string, unknown>;
	const resolvedParameters = resolveRefs(parameters, OPENAPI_DIR) as Record<
		string,
		unknown
	>;
	const resolvedResponses = resolveRefs(responses, OPENAPI_DIR) as Record<
		string,
		unknown
	>;

	const components = (spec.components || {}) as Record<string, unknown>;

	const bundled = {
		...spec,
		paths: resolvedPaths,
		components: {
			...components,
			securitySchemes: components.securitySchemes,
			parameters: resolvedParameters,
			responses: resolvedResponses,
			schemas: resolvedSchemas,
		},
	};

	const outputPath = join(OPENAPI_DIR, "bundled.yaml");
	writeFileSync(outputPath, YAML.stringify(bundled, { lineWidth: 0 }), "utf-8");

	console.log(`Bundled spec written to ${outputPath}`);
}

main();
