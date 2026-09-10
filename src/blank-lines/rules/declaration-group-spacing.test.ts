import { RuleTester } from "../../../test/rule-tester.ts";
import declarationGroupSpacing from "./declaration-group-spacing.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("blank-lines/declaration-group-spacing", declarationGroupSpacing, {
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
            name: "keeps an object choice with the declaration it consumes",
            code: `const definition = source.definition;
const input = enabled
    ? { definition }
    : { definition, mode };
`,
        },
        "const first = {\n    mode: 'static',\n};\n\nconst second = {\n    enabled: true,\n};\n",
        {
            name: "keeps sibling empty object accumulators together",
            code: `function counters() {
    const callCounts: Record<string, number> = {};
    const resultCounts: Record<string, number> = {};
    return [callCounts, resultCounts];
}
`,
        },
        'const first = Symbol.for("first");\nconst second = Symbol.for(\n    "second",\n);\nconst third = Symbol.for("third");\n',
        `function install() {
    let state: State;
    const original = target.render;
    const wrapper = () => {
        original.call(target, state);
    };
    const metadata = {
        original,
        wrapper,
    };
}
`,
        "export let current:\n    | { readonly value: string }\n    | undefined;\nexport let queued = false;\n",
        "const value = read();\n\nconsume(items.map(value => value));\n",
        `
            const a = 1;
            const b = 2;
            consume(a, b);
        `,
        `
            const ready = check();
            if (ready) {
                run();
            }
        `,
        `type AssistantContent = {
    readonly type: string;
    readonly text?: string;
    readonly thinking?: string;
};

type AssistantMessageLike = Pick<AssistantMessage, "content">;
type AssistantContentKind = "text" | "thinking";
type AssistantAddChildCall = AssistantContentKind | "other";

type AssistantRenderInstance = {
    readonly contentContainer?: unknown;
    [ASSISTANT_SEPARATOR_RENDER_KEY]?: boolean;
};

type AssistantSeparatorPatchState = {
    enabled: boolean;
    readonly originalRender: AssistantRenderPrototype["render"];
    readonly originalUpdateContent: AssistantRenderPrototype["updateContent"];
    readonly wrapperRender?: NonNullable<AssistantRenderPrototype["render"]>;
    readonly wrapperUpdateContent?: NonNullable<AssistantRenderPrototype["updateContent"]>;
};

type AssistantRenderPrototype = {
    render?: AssistantMessageComponent["render"];
    updateContent?: AssistantMessageComponent["updateContent"];
    [ASSISTANT_SEPARATOR_PATCH_STATE_KEY]?: AssistantSeparatorPatchState;
};

type ChatComponentKind = "assistant" | "tool" | "user";
type ChatContainerInstance = Container;
`,
        `interface User {
    id: string;
}

type UserId = string;
type UserName = string;
`,
        "export type First = string;\nexport type Second = number;\n",
        "type Projected = Source['value'];\ntype Owner = typeof original | Replacement;\ntype Wrapped = Readonly<Source>;\n",
        {
            options: [{ separateMultilineDeclarations: false }],
            code: "type A = {\n    x: string;\n};\ntype B = {\n    y: number;\n};\n",
        },
        {
            options: [{ compactSingleLineDeclarations: false }],
            code: "type A = string;\n\ntype B = number;\n",
        },
        "function setup() {\n    const values = [];\n    let count = 0;\n    const first = function () { return count; };\n    const second = function () { return values; };\n}\n",
        'const KEY = Symbol.for("state");\nlet enabled = false;\n',
        {
            name: "keeps empty constructors with multiline type arguments together",
            code: `const pendingByFile = new WeakMap<
    FileMetadata,
    { readonly promise: Promise<Result> }
>();
const pendingByDir = new WeakMap<
    DirMetadata,
    { readonly promise: Promise<Result> }
>();
`,
        },
        {
            name: "keeps a scalar with the object that consumes it",
            code: `function build(name) {
    const key = name;
    const config = {
        key,
        enabled: true,
    };
    return config;
}
`,
        },
        {
            name: "preserves separation before a declaration following a guard",
            code: `function preview(args, context) {
    const record = parse(args);
    if (record === undefined) return fallback(args, context);

    const uid = getId(record);
    return uid;
}
`,
        },
        {
            name: "preserves separation before a declaration following a cache check",
            code: `function load(path) {
    if (cached.has(path)) {
        return cached.get(path);
    }

    const fresh = read(path);
    return fresh;
}
`,
        },
    ],
    invalid: [
        {
            code: "export type JsonPrimitive = string | number | boolean | null;\nexport type JsonArray = ReadonlyArray<JsonValue>;\n\nexport type JsonValue = JsonPrimitive | JsonArray | JsonObject;\n",
            output: "export type JsonPrimitive = string | number | boolean | null;\nexport type JsonArray = ReadonlyArray<JsonValue>;\nexport type JsonValue = JsonPrimitive | JsonArray | JsonObject;\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            name: "separates an empty object accumulator from extracted inputs",
            code: `function normalizedWriteArgs(args) {
    const parsed = parseArgs(args);
    const path = pathField(parsed);
    const content = stringField(parsed, "content");
    let normalized = {};
    if (path !== undefined) normalized = { ...normalized, path };
    if (content !== undefined) normalized = { ...normalized, content };
    return normalized;
}
`,
            output: `function normalizedWriteArgs(args) {
    const parsed = parseArgs(args);
    const path = pathField(parsed);
    const content = stringField(parsed, "content");

    let normalized = {};
    if (path !== undefined) normalized = { ...normalized, path };
    if (content !== undefined) normalized = { ...normalized, content };
    return normalized;
}
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            code: "const first = [\n    'a',\n    'b',\n];\nconst second = [\n    'c',\n];\nlet active = false;\n",
            output: "const first = [\n    'a',\n    'b',\n];\n\nconst second = [\n    'c',\n];\n\nlet active = false;\n",
            errors: [{ messageId: "expectedBlank" }, { messageId: "expectedBlank" }],
        },
        {
            code: "const entries = new Map();\nconst owners = new WeakMap();\nlet bytes = 0;\nlet hits = 0;\n",
            output: "const entries = new Map();\nconst owners = new WeakMap();\n\nlet bytes = 0;\nlet hits = 0;\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            code: `function install() {
    let state: State;
    const first = function () {
        prepare(state);
        inspect(state);
        update(state);
        record(state);
        refresh(state);
        notify(state);
        flush(state);
        return finish(state);
    };
    const second = function () {
        return state;
    };
}
`,
            output: `function install() {
    let state: State;

    const first = function () {
        prepare(state);
        inspect(state);
        update(state);
        record(state);
        refresh(state);
        notify(state);
        flush(state);
        return finish(state);
    };

    const second = function () {
        return state;
    };
}
`,
            errors: [{ messageId: "expectedBlank" }, { messageId: "expectedBlank" }],
        },
        {
            code: "function result() {\n    const value = read();\n\n    return combine(\n        value,\n        fallback,\n    );\n}\n",
            output: "function result() {\n    const value = read();\n    return combine(\n        value,\n        fallback,\n    );\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            code: 'const KEY = Symbol.for("key");\n\nconst ENV = "ENV";\n\nconst OTHER = "OTHER";\n',
            output: 'const KEY = Symbol.for("key");\nconst ENV = "ENV";\nconst OTHER = "OTHER";\n',
            errors: [{ messageId: "unexpectedBlank" }, { messageId: "unexpectedBlank" }],
        },
        {
            code: "const rotatedPath = `${filePath}.1`;\n\nrmSync(rotatedPath, { force: true });\nrenameSync(filePath, rotatedPath);\n",
            output: "const rotatedPath = `${filePath}.1`;\nrmSync(rotatedPath, { force: true });\nrenameSync(filePath, rotatedPath);\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            options: [{ withinGroup: "never", compactRelatedUse: false }],
            code: "const a = 1;\n\nconst b = 2;\nconsume(a, b);\n",
            output: "const a = 1;\nconst b = 2;\n\nconsume(a, b);\n",
            errors: [{ messageId: "unexpectedBlank" }, { messageId: "expectedBlank" }],
        },
        {
            code: "type A = string;\n\ntype B = number;\n",
            output: "type A = string;\ntype B = number;\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            code: "type A = {\n    readonly x: string;\n};\ntype B = string;\n",
            output: "type A = {\n    readonly x: string;\n};\n\ntype B = string;\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            code: "type B = string;\ntype A = {\n    readonly x: string;\n};\n",
            output: "type B = string;\n\ntype A = {\n    readonly x: string;\n};\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            code: "type A = {\n    readonly x: string;\n};\ntype B = {\n    readonly y: number;\n};\n",
            output: "type A = {\n    readonly x: string;\n};\n\ntype B = {\n    readonly y: number;\n};\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            options: [{ withinGroup: "always" }],
            code: "const first = {\n    value: 1,\n};\nconst second = {\n    value: 2,\n};\n",
            output: "const first = {\n    value: 1,\n};\n\nconst second = {\n    value: 2,\n};\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            options: [{ withinGroup: "never" }],
            code: "const first = {\n    value: 1,\n};\n\nconst second = {\n    value: 2,\n};\n",
            output: "const first = {\n    value: 1,\n};\nconst second = {\n    value: 2,\n};\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            code: "export type Owner =\n    | First\n    | Second;\nexport type Other = Third;\n",
            output: "export type Owner =\n    | First\n    | Second;\n\nexport type Other = Third;\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            code: "type Id = string;\ninterface Item {\n    id: Id;\n}\ntype Name = string;\n",
            output: "type Id = string;\n\ninterface Item {\n    id: Id;\n}\n\ntype Name = string;\n",
            errors: [{ messageId: "expectedBlank" }, { messageId: "expectedBlank" }],
        },
        {
            code: `type AssistantContent = {
    readonly type: string;
    readonly text?: string;
    readonly thinking?: string;
};
type AssistantMessageLike = Pick<AssistantMessage, "content">;

type AssistantContentKind = "text" | "thinking";

type AssistantAddChildCall = AssistantContentKind | "other";
type AssistantRenderInstance = {
    readonly contentContainer?: unknown;
    [ASSISTANT_SEPARATOR_RENDER_KEY]?: boolean;
};
type AssistantSeparatorPatchState = {
    enabled: boolean;
    readonly originalRender: AssistantRenderPrototype["render"];
    readonly originalUpdateContent: AssistantRenderPrototype["updateContent"];
    readonly wrapperRender?: NonNullable<AssistantRenderPrototype["render"]>;
    readonly wrapperUpdateContent?: NonNullable<AssistantRenderPrototype["updateContent"]>;
};
type AssistantRenderPrototype = {
    render?: AssistantMessageComponent["render"];
    updateContent?: AssistantMessageComponent["updateContent"];
    [ASSISTANT_SEPARATOR_PATCH_STATE_KEY]?: AssistantSeparatorPatchState;
};
type ChatComponentKind = "assistant" | "tool" | "user";

type ChatContainerInstance = Container;
`,
            output: `type AssistantContent = {
    readonly type: string;
    readonly text?: string;
    readonly thinking?: string;
};

type AssistantMessageLike = Pick<AssistantMessage, "content">;
type AssistantContentKind = "text" | "thinking";
type AssistantAddChildCall = AssistantContentKind | "other";

type AssistantRenderInstance = {
    readonly contentContainer?: unknown;
    [ASSISTANT_SEPARATOR_RENDER_KEY]?: boolean;
};

type AssistantSeparatorPatchState = {
    enabled: boolean;
    readonly originalRender: AssistantRenderPrototype["render"];
    readonly originalUpdateContent: AssistantRenderPrototype["updateContent"];
    readonly wrapperRender?: NonNullable<AssistantRenderPrototype["render"]>;
    readonly wrapperUpdateContent?: NonNullable<AssistantRenderPrototype["updateContent"]>;
};

type AssistantRenderPrototype = {
    render?: AssistantMessageComponent["render"];
    updateContent?: AssistantMessageComponent["updateContent"];
    [ASSISTANT_SEPARATOR_PATCH_STATE_KEY]?: AssistantSeparatorPatchState;
};

type ChatComponentKind = "assistant" | "tool" | "user";
type ChatContainerInstance = Container;
`,
            errors: [
                { messageId: "expectedBlank" },
                { messageId: "unexpectedBlank" },
                { messageId: "unexpectedBlank" },
                { messageId: "expectedBlank" },
                { messageId: "expectedBlank" },
                { messageId: "expectedBlank" },
                { messageId: "expectedBlank" },
                { messageId: "unexpectedBlank" },
            ],
        },
        {
            name: "separates a declaration from a preceding single-line guard",
            code: `function preview(args, context) {
    const record = parse(args);
    if (record === undefined) return fallback(args, context);
    const uid = getId(record);
    return uid;
}
`,
            output: `function preview(args, context) {
    const record = parse(args);
    if (record === undefined) return fallback(args, context);

    const uid = getId(record);
    return uid;
}
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            name: "separates a declaration from a preceding braced cache check",
            code: `function load(path) {
    if (cached.has(path)) {
        return cached.get(path);
    }
    const fresh = read(path);
    return fresh;
}
`,
            output: `function load(path) {
    if (cached.has(path)) {
        return cached.get(path);
    }

    const fresh = read(path);
    return fresh;
}
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            name: "separates multiline asserted module objects",
            code: `const DEFAULT_APPEARANCE = {
    mode: 'static',
} as const;
const DEFAULT_DEBUG = {
    enabled: false,
} as const;
`,
            output: `const DEFAULT_APPEARANCE = {
    mode: 'static',
} as const;

const DEFAULT_DEBUG = {
    enabled: false,
} as const;
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            name: "separates multiline module constructions even when related",
            code: `const toneSchema = Type.Union([
    Type.Literal('a'),
]);
const inlineSchema = Type.Object({
    tone: Type.Optional(toneSchema),
});
`,
            output: `const toneSchema = Type.Union([
    Type.Literal('a'),
]);

const inlineSchema = Type.Object({
    tone: Type.Optional(toneSchema),
});
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            name: "separates constructors containing multiline arrays",
            code: `const KNOWN = new Set([
    'a',
]);
const EXTRA = new Set([
    'b',
]);
`,
            output: `const KNOWN = new Set([
    'a',
]);

const EXTRA = new Set([
    'b',
]);
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            name: "separates adjacent block-bodied arrow functions",
            code: `function run(queue) {
    const succeed = () => {
        finish(queue);
    };
    const fail = () => {
        abort(queue);
    };
}
`,
            output: `function run(queue) {
    const succeed = () => {
        finish(queue);
    };

    const fail = () => {
        abort(queue);
    };
}
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            name: "separates exported objects containing methods",
            code: `export const stringParser = {
    parse(value) {
        return check(value);
    },
};
export const numberParser = {
    parse(value) {
        return check(value);
    },
};
`,
            output: `export const stringParser = {
    parse(value) {
        return check(value);
    },
};

export const numberParser = {
    parse(value) {
        return check(value);
    },
};
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            name: "separates a scalar from an independent object construction",
            code: `const kind = 'static';
const config = {
    mode: 'fixed',
};
`,
            output: `const kind = 'static';

const config = {
    mode: 'fixed',
};
`,
            errors: [{ messageId: "expectedBlank" }],
        },
    ],
});
