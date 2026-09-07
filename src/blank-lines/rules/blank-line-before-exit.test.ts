import { RuleTester } from "../../../test/rule-tester.ts";
import blankLineBeforeExit from "./blank-line-before-exit.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("blank-lines/blank-line-before-exit", blankLineBeforeExit, {
    valid: [
        {
            languageOptions: { parserOptions: { lang: "tsx" } },
            code: `function Input({ id, name, type, className, ...props }) {
    const fallbackID = useId();
    const resolvedID = id ?? fallbackID;

    return (
        <input
            type={type}
            id={resolvedID}
            name={name ?? resolvedID}
            data-slot="input"
            className={cn("base", "focus", "invalid", className)}
            aria-describedby={resolvedID}
            {...props}
        />
    );
}
`,
        },
        {
            code: "function result() {\n    const value = read();\n\n    return [\n        value, value, value, value, value, value, value, value,\n        value, value, value, value, value, value, value, value,\n        value, value, value, value, value, value, value, value,\n        value, value, value, value, value, value, value, value,\n    ];\n}\n",
        },
        {
            options: [{ compactShortBodies: false, compactErrorHandlers: false }],
            code: "try {\n    work();\n} catch (cause) {\n    capture(cause);\n\n    throw cause;\n}\n",
        },
        {
            options: [{ compactShortBodies: false, compactWrappedDeclarations: false }],
            code: "function run(state) {\n    const value =\n        state.value ?? fallback();\n\n    return value;\n}\n",
        },
        `
            function small() {
                return 42;
            }
        `,
        `
            function run() {
                prepare();
                return 42;
            }
        `,
        `
            function process(val: number) {
                if (val < 0) {
                    throw new Error("negative");
                }

                work();
            }
        `,
    ],
    invalid: [
        {
            code: "function result() {\n    const value = read();\n\n    return combine(\n        value,\n        fallback,\n    );\n}\n",
            output: "function result() {\n    const value = read();\n    return combine(\n        value,\n        fallback,\n    );\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            options: [{ compactShortBodies: false }],
            code: "try {\n    work();\n} catch (cause) {\n    capture(cause);\n\n    throw cause;\n}\n",
            output: "try {\n    work();\n} catch (cause) {\n    capture(cause);\n    throw cause;\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            options: [{ compactShortBodies: false }],
            code: "function run(state) {\n    const value =\n        state.value ?? fallback();\n\n    return value;\n}\n",
            output: "function run(state) {\n    const value =\n        state.value ?? fallback();\n    return value;\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        ...["break", "continue", "break outer", "continue outer"].map((jump) => ({
            code: `outer: while (ready) {\n    if (skip) {\n        work();\n    }\n\n    ${jump};\n}\n`,
            output: `outer: while (ready) {\n    if (skip) {\n        work();\n    }\n    ${jump};\n}\n`,
            errors: [{ messageId: "unexpectedJumpBlank" }],
        })),
        {
            code: "while (ready) {\n    try {\n        work();\n    } finally {\n        cleanup();\n    }\n\n    break;\n}\n",
            output: "while (ready) {\n    try {\n        work();\n    } finally {\n        cleanup();\n    }\n    break;\n}\n",
            errors: [{ messageId: "unexpectedJumpBlank" }],
        },
        {
            code: 'function normalize(text) {\n    const neutralized = clean(text);\n\n    return neutralized.includes("\\t") ? expand(neutralized) : neutralized;\n}\n',
            output: 'function normalize(text) {\n    const neutralized = clean(text);\n    return neutralized.includes("\\t") ? expand(neutralized) : neutralized;\n}\n',
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            code: "function configure(enabled) {\n    if (current === enabled) {\n        return false;\n    }\n\n    current = enabled;\n\n    return true;\n}\n",
            output: "function configure(enabled) {\n    if (current === enabled) {\n        return false;\n    }\n\n    current = enabled;\n    return true;\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            code: "while (ready) {\n    if (skip) {\n        index += 2;\n\n        continue;\n    }\n}\n",
            output: "while (ready) {\n    if (skip) {\n        index += 2;\n        continue;\n    }\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            options: [{ compactShortBodies: false }],
            code: "function value() {\n    prepare();\n    return 42;\n}\n",
            output: "function value() {\n    prepare();\n\n    return 42;\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            options: [{ compactShortBodies: false }],
            code: "function check() {\n    setup();\n    throw new Error();\n}\n",
            output: "function check() {\n    setup();\n\n    throw new Error();\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
    ],
});
