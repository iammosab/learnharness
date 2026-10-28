import assert from "node:assert/strict";
import { test } from "node:test";
import {
	REMOTE_LANGUAGES,
	parseRemoteKotlinRun,
	remoteLanguageFor,
	resolveEngine,
	classifyRun,
	formatReport,
	type RemoteKotlinResponse,
} from "../src/core/code-playground.ts";

/**
 * Fixtures are verbatim replies captured from
 * api.kotlinlang.org/api/2.4.21/compiler/run on 2026-10-28 — not invented
 * shapes. Every outcome arrives as HTTP 200, so this mapping is the only thing
 * that distinguishes them.
 */
const OK: RemoteKotlinResponse = {
	errors: { "File.kt": [] },
	exception: null,
	text: "<outStream>sum=15\n</outStream>",
};

const COMPILE_ERROR: RemoteKotlinResponse = {
	errors: {
		"File.kt": [
			{ interval: { start: { line: 1, ch: 8 } }, message: "Variable is unused.", severity: "WARNING" },
			{
				interval: { start: { line: 1, ch: 15 } },
				message: "Initializer type mismatch: expected 'Int', actual 'String'.",
				severity: "ERROR",
			},
			{ interval: { start: { line: 2, ch: 12 } }, message: "Unresolved reference 'y'.", severity: "ERROR" },
		],
	},
	exception: null,
	text: "",
};

const THREW: RemoteKotlinResponse = {
	errors: { "File.kt": [] },
	exception: {
		message: "Index 10 out of bounds for length 3",
		fullName: "java.lang.ArrayIndexOutOfBoundsException",
		stackTrace: [
			{ className: "java.util.Arrays$ArrayList", methodName: "get", fileName: null, lineNumber: -1 },
			{ className: "FileKt", methodName: "main", fileName: "File.kt", lineNumber: 3 },
			// The service appends a synthetic entry-point frame with no line.
			{ className: "FileKt", methodName: "main", fileName: "File.kt", lineNumber: -1 },
		],
	},
	text: "",
};

const TIMED_OUT: RemoteKotlinResponse = {
	errors: { "File.kt": [] },
	exception: null,
	text: "<errStream>Evaluation stopped while it's taking too long‏</errStream>",
};

test("a clean run surfaces stdout and compiles", () => {
	const r = parseRemoteKotlinRun(OK);
	assert.equal(r.compile.ok, true);
	assert.equal(r.run.stdout, "sum=15\n");
	assert.equal(r.run.exit, 0);
	assert.equal(r.run.timedOut, false);
	assert.equal(classifyRun({ compileOk: true, exit: 0, timedOut: false }), "none");
});

test("ERROR diagnostics fail the compile with 1-based line:col; WARNINGs are dropped", () => {
	const r = parseRemoteKotlinRun(COMPILE_ERROR);
	assert.equal(r.compile.ok, false);
	// The service reports zero-based positions; a learner reads 1-based.
	assert.match(r.compile.stderr, /^File\.kt:2:16: error: Initializer type mismatch/m);
	assert.match(r.compile.stderr, /^File\.kt:3:13: error: Unresolved reference 'y'\./m);
	assert.doesNotMatch(r.compile.stderr, /Variable is unused/, "a warning must not read as a failure");
	assert.equal(r.compile.stderr.split("\n").length, 2);
	assert.equal(classifyRun({ compileOk: r.compile.ok, exit: r.run.exit }), "syntax");
});

test("a thrown exception compiles but exits non-zero, keeping only locatable frames", () => {
	const r = parseRemoteKotlinRun(THREW);
	assert.equal(r.compile.ok, true);
	assert.equal(r.run.exit, 1);
	assert.match(r.run.stderr ?? "", /^java\.lang\.ArrayIndexOutOfBoundsException: Index 10 out of bounds/);
	assert.match(r.run.stderr ?? "", /at FileKt\.main\(File\.kt:3\)/);
	assert.doesNotMatch(r.run.stderr ?? "", /Arrays\$ArrayList/, "JDK-internal frames teach nothing here");
	assert.doesNotMatch(r.run.stderr ?? "", /File\.kt:-1/, "a synthetic frame is noise in learner-facing output");
	assert.equal((r.run.stderr ?? "").split("\n").length, 2, "one message line + one actionable frame");
	assert.equal(classifyRun({ compileOk: true, exit: r.run.exit, timedOut: false }), "runtime");
});

test("the service's execution cap maps onto the runner's timeout vocabulary", () => {
	const r = parseRemoteKotlinRun(TIMED_OUT);
	assert.equal(r.run.timedOut, true);
	assert.equal(r.run.exit, 124, "same code timeout(1) gives the sandbox runner");
	assert.equal(classifyRun({ compileOk: true, exit: r.run.exit, timedOut: r.run.timedOut }), "timeout");
});

test("both streams are captured when a program writes to each", () => {
	const r = parseRemoteKotlinRun({
		errors: {},
		exception: null,
		text: "<outStream>out-1\n</outStream><errStream>err-1\n</errStream><outStream>out-2\n</outStream>",
	});
	assert.equal(r.run.stdout, "out-1\nout-2\n");
	assert.equal(r.run.stderr, "err-1");
	assert.equal(r.run.timedOut, false);
});

test("an empty reply degrades to a clean empty run rather than throwing", () => {
	const r = parseRemoteKotlinRun({});
	assert.equal(r.compile.ok, true);
	assert.equal(r.run.stdout, "");
	assert.equal(r.run.exit, 0);
});

test("remoteLanguageFor canonicalises the names a teacher actually writes", () => {
	for (const written of ["kotlin", "Kotlin", "KOTLIN", "kt"]) {
		assert.equal(remoteLanguageFor(written), "kotlin", written);
	}
	assert.equal(remoteLanguageFor("c"), null);
	assert.equal(remoteLanguageFor("spanish"), null);
});

test("every remote id is a language the registry already knows", () => {
	for (const id of Object.keys(REMOTE_LANGUAGES)) {
		assert.equal(remoteLanguageFor(id), REMOTE_LANGUAGES[id], id);
	}
});

test("the local sandbox outranks the remote service whenever it can serve", () => {
	const both = resolveEngine("kotlin", true, "kotlinc 2.2.21", { available: true, version: "Kotlin 2.4.21" });
	assert.equal(both.kind, "runner", "code must not leave the host when it need not");
	assert.equal(both.runnerLanguage, "kotlin");
});

test("remote carries Kotlin when the sandbox cannot", () => {
	const e = resolveEngine("kotlin", false, undefined, { available: true, version: "Kotlin 2.4.21" });
	assert.equal(e.kind, "remote");
	assert.equal(e.remoteLanguage, "kotlin");
	assert.equal(e.runnable, true);
	assert.equal(e.label, "Kotlin");
	assert.equal(e.reason, "Kotlin 2.4.21");
});

test("with neither engine, Kotlin refuses honestly and names both routes", () => {
	const e = resolveEngine("kotlin", false, undefined, { available: false });
	assert.equal(e.kind, "none");
	assert.equal(e.runnable, false);
	assert.match(e.reason ?? "", /sandbox runner or a remote compiler service/);
	assert.match(e.reason ?? "", /Editing and feedback still work/);
});

test("a remote service does not make sandbox-only languages runnable", () => {
	const e = resolveEngine("c", false, undefined, { available: true, version: "Kotlin 2.4.21" });
	assert.equal(e.kind, "none");
	assert.match(e.reason ?? "", /sandbox runner/);
	assert.doesNotMatch(e.reason ?? "", /remote/);
});

test("the pre-existing engine truth table is unchanged", () => {
	assert.equal(resolveEngine("javascript").kind, "native");
	assert.equal(resolveEngine("c", true).kind, "runner");
	assert.equal(resolveEngine("c", false).kind, "none");
	assert.equal(resolveEngine("python", true).kind, "runner");
	assert.equal(resolveEngine("braincraft").kind, "none");
});

// ─── JUnit-backed checks ────────────────────────────────────────────────────

import {
	KOTLIN_CHECK_CLASS,
	KOTLIN_CHECK_FILE,
	buildKotlinCheckFile,
	kotlinCheckFileBroken,
	parseRemoteKotlinChecks,
	type RemoteCheck,
	type RemoteKotlinTestResponse,
} from "../src/core/code-playground.ts";

const CHECKS: RemoteCheck[] = [
	{ expr: "sum(2, 3)", expect: "5", label: "sum(2,3) is 5" },
	{ expr: "sum(10, 1)", expect: "11", label: "sum(10,1) is 11" },
];

test("checks compile into one JUnit method each, named by position", () => {
	const src = buildKotlinCheckFile(CHECKS);
	assert.match(src, /^import org\.junit\.Assert$/m);
	assert.match(src, new RegExp(`^class ${KOTLIN_CHECK_CLASS} \\{$`, "m"));
	assert.match(src, /@Test fun check0\(\)/);
	assert.match(src, /@Test fun check1\(\)/);
	// Two-arg assertEquals: the label is the card's to add, not JUnit's.
	assert.match(src, /Assert\.assertEquals\("5", \(sum\(2, 3\)\)\.toString\(\)\)/);
	assert.doesNotMatch(src, /assertEquals\("sum/, "the label must not become the assertion message");
});

test("a Kotlin string literal interpolates, so $ escapes with the rest", () => {
	const src = buildKotlinCheckFile([
		{ expr: "greet()", expect: 'say "$name"\\n', label: "quotes, dollar, backslash" },
	]);
	// Built as a plain string rather than a regex: the escaping is the subject
	// of the test, so a second layer of it would obscure what is asserted.
	assert.ok(
		src.includes('Assert.assertEquals("say \\"\\$name\\"\\\\n", (greet()).toString())'),
		src,
	);
	// Every dollar must be backslash-escaped, or Kotlin reads a template.
	for (let i = 0; i < src.length; i++) {
		if (src[i] === "$") assert.equal(src[i - 1], "\\", `unescaped $ at ${i}: ${src.slice(i - 12, i + 12)}`);
	}
});

test("verdicts map by method name, because JUnit promises no order", () => {
	const raw: RemoteKotlinTestResponse = {
		testResults: {
			LhChecks: [
				// Deliberately reversed relative to the authored order.
				{ methodName: "check1", status: "OK", comparisonFailure: null },
				{ methodName: "check0", status: "FAIL", comparisonFailure: { message: "expected:<5> but was:<-1>" } },
			],
		},
	};
	const out = parseRemoteKotlinChecks(raw, CHECKS);
	assert.equal(out.length, 2);
	assert.equal(out[0]!.pass, false, "check0 failed even though it was reported second");
	assert.equal(out[0]!.label, "sum(2,3) is 5 — expected:<5> but was:<-1>");
	assert.equal(out[1]!.pass, true);
	assert.equal(out[1]!.label, "sum(10,1) is 11", "a pass carries no diagnostic");
});

test("a check the run never reported fails rather than vanishing", () => {
	const out = parseRemoteKotlinChecks({ testResults: { LhChecks: [{ methodName: "check0", status: "OK" }] } }, CHECKS);
	assert.deepEqual(out.map((c) => c.pass), [true, false]);
});

test("a thrown check reports the exception, not a bare cross", () => {
	const out = parseRemoteKotlinChecks(
		{
			testResults: {
				LhChecks: [
					{ methodName: "check0", status: "FAIL", exception: { fullName: "java.lang.IllegalStateException", message: "boom" } },
				],
			},
		},
		[CHECKS[0]!],
	);
	assert.equal(out[0]!.pass, false);
	assert.match(out[0]!.label, /java\.lang\.IllegalStateException: boom/);
});

test("an uncompilable check file is the author's fault and is named as such", () => {
	const broken: RemoteKotlinTestResponse = {
		errors: {
			"File.kt": [],
			[KOTLIN_CHECK_FILE]: [
				{ message: "Unresolved reference 'nope'.", severity: "ERROR" },
				{ message: "Variable is unused.", severity: "WARNING" },
			],
		},
	};
	assert.equal(kotlinCheckFileBroken(broken), "Unresolved reference 'nope'.");
	assert.equal(kotlinCheckFileBroken({ errors: { [KOTLIN_CHECK_FILE]: [] } }), null);
	assert.equal(kotlinCheckFileBroken({}), null);
});

test("the report carries the exception text, not just the failure kind", () => {
	// A thrown Kotlin program: the engine puts the message in stderr, and the
	// teacher must be able to name the fault the learner just saw on screen.
	const mapped = parseRemoteKotlinRun(THREW);
	const text = formatReport({
		language: "kotlin",
		engine: "remote",
		code: "fun main() { println(listOf(1,2,3)[10]) }",
		attempts: 1,
		sentAt: "2026-10-28T00:00:00Z",
		runs: [
			{
				ok: false,
				stdout: mapped.run.stdout,
				stderr: mapped.run.stderr,
				errorKind: classifyRun({ compileOk: true, exit: mapped.run.exit, timedOut: false }),
			},
		],
	});
	assert.match(text, /Failure kind: runtime\./);
	assert.match(text, /Error output:/);
	assert.match(text, /ArrayIndexOutOfBoundsException: Index 10 out of bounds/);
});

test("a program that prints AND throws reports both streams", () => {
	const text = formatReport({
		language: "kotlin", engine: "remote", code: "x", attempts: 1, sentAt: "2026-10-28T00:00:00Z",
		runs: [{ ok: false, stdout: "step one\n", stderr: "java.lang.IllegalStateException: boom", errorKind: "runtime" }],
	});
	assert.match(text, /Output:\nstep one/);
	assert.match(text, /Error output:\njava\.lang\.IllegalStateException: boom/);
});
