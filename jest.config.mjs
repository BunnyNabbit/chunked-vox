/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

/** @type {import('jest').Config} */
export const config = {
	// Indicates whether the coverage information should be collected while executing the test
	collectCoverage: true,
	// The directory where Jest should output its coverage files
	coverageDirectory: "coverage",
	// Indicates which provider should be used to instrument code for coverage
	coverageProvider: "v8",
	watchPathIgnorePatterns: ["__file_snapshots__"],
}

export default config
