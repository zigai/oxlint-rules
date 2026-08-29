import { RuleTester } from "../../../test/rule-tester.ts";

import { maxReactHooksPerFunctionRule } from "./max-react-hooks-per-function.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });
const error = { messageId: "tooManyHooks" };
const maxTwo = [{ max: 2 }];

tester.run("antislop/max-react-hooks-per-function", maxReactHooksPerFunctionRule, {
    valid: [
        {
            code: `
                import { useEffect, useMemo } from "react";
                function Component() {
                    useEffect(() => {});
                    useMemo(() => 1, []);
                    return null;
                }
            `,
            options: maxTwo,
        },
        {
            code: `
                function Component() {
                    useState(0);
                    useEffect(() => {});
                    function useNestedConcern() {
                        useMemo(() => 1, []);
                        useCallback(() => {}, []);
                    }
                    return useNestedConcern;
                }
            `,
            options: maxTwo,
        },
        {
            code: `
                function use() {}
                function Component() {
                    use();
                    use();
                    use();
                    return null;
                }
            `,
            options: maxTwo,
        },
        {
            code: `
                import * as ImportedReact from "react";
                function Component() {
                    const ImportedReact = {
                        useFirst() {},
                        useSecond() {},
                        useThird() {},
                    };
                    ImportedReact.useFirst();
                    ImportedReact.useSecond();
                    ImportedReact.useThird();
                    return null;
                }
            `,
            options: maxTwo,
        },
        {
            code: `
                import { use as consume } from "cache-library";
                function Component() {
                    consume(first);
                    consume(second);
                    consume(third);
                    return null;
                }
            `,
            options: maxTwo,
        },
    ],
    invalid: [
        {
            code: `
                function Component() {
                    useState(0);
                    useState(1);
                    useState(2);
                    useState(3);
                    useState(4);
                    useState(5);
                    useState(6);
                    useState(7);
                    useState(8);
                    useState(9);
                    useState(10);
                    useState(11);
                    useState(12);
                    useState(13);
                    useState(14);
                    useState(15);
                    useState(16);
                    useState(17);
                    useState(18);
                    useState(19);
                    useState(20);
                    return null;
                }
            `,
            errors: [error],
        },
        {
            code: `
                function Component() {
                    useState(0);
                    useEffect(() => {});
                    useMemo(() => 1, []);
                    return null;
                }
            `,
            options: maxTwo,
            errors: [error],
        },
        {
            code: `
                import {
                    useEffect as effect,
                    useMemo as memo,
                    useState as state,
                } from "react";
                function Component() {
                    state(0);
                    effect(() => {});
                    memo(() => 1, []);
                    return null;
                }
            `,
            options: maxTwo,
            errors: [error],
        },
        {
            code: `
                import * as React from "react";
                function Component() {
                    React.useState(0);
                    React.useEffect(() => {});
                    React.useMemo(() => 1, []);
                    return null;
                }
            `,
            options: maxTwo,
            errors: [error],
        },
        {
            code: `
                import { use as reactUse, useEffect, useState } from "react";
                function Component() {
                    reactUse(resource);
                    useEffect(() => {});
                    useState(0);
                    return null;
                }
            `,
            options: maxTwo,
            errors: [error],
        },
    ],
});
