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
        "const first = {\n    mode: 'static',\n};\n\nconst second = {\n    enabled: true,\n};\n",
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
    ],
    invalid: [
        {
            code: "export type JsonPrimitive = string | number | boolean | null;\nexport type JsonArray = ReadonlyArray<JsonValue>;\n\nexport type JsonValue = JsonPrimitive | JsonArray | JsonObject;\n",
            output: "export type JsonPrimitive = string | number | boolean | null;\nexport type JsonArray = ReadonlyArray<JsonValue>;\nexport type JsonValue = JsonPrimitive | JsonArray | JsonObject;\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            code: "const definition = source.definition;\nconst input = enabled\n    ? { definition }\n    : { definition, mode };\n",
            output: "const definition = source.definition;\n\nconst input = enabled\n    ? { definition }\n    : { definition, mode };\n",
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
    ],
});
