import { RuleTester } from "../../../test/rule-tester.ts";

import { requireEffectCleanupRule } from "./require-effect-cleanup.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });
const error = { messageId: "missingCleanup" };

tester.run("antislop/require-effect-cleanup", requireEffectCleanupRule, {
    valid: [
        `
            import { useEffect } from "react";
            function Component() {
                useEffect(() => {
                    window.addEventListener("resize", updateLayout);
                    return () => window.removeEventListener("resize", updateLayout);
                }, []);
            }
        `,
        `
            import { useEffect } from "react";
            function Component() {
                useEffect(() => {
                    const interval = setInterval(refresh, 1_000);
                    return () => clearInterval(interval);
                }, []);
            }
        `,
        `
            import { useEffect } from "react";
            function Component() {
                useEffect(setupSubscription, []);
            }
        `,
        `
            import { useEffect } from "react";
            function Component() {
                useEffect(() => {
                    document.addEventListener("visibilitychange", refresh, { once: true });
                }, []);
            }
        `,
        `
            import { useEffect } from "react";
            function Component() {
                useEffect(() => {
                    const controller = new AbortController();
                    window.addEventListener("resize", updateLayout, {
                        signal: controller.signal,
                    });
                }, []);
            }
        `,
        `
            import { useEffect } from "react";
            function Component(element: HTMLElement) {
                useEffect(() => {
                    element.addEventListener("change", handleChange);
                }, [element]);
            }
        `,
        `
            import { useEffect } from "react";
            function Component() {
                const setInterval = scheduleRepeatedly;
                useEffect(() => {
                    setInterval(refresh, 1_000);
                }, []);
            }
        `,
        `
            function useEffect(callback: () => void) {
                callback();
            }
            function Component() {
                useEffect(() => {
                    window.addEventListener("resize", updateLayout);
                });
            }
        `,
        `
            import { useEffect } from "react";
            function Component(options: AddEventListenerOptions) {
                useEffect(() => {
                    window.addEventListener("resize", updateLayout, options);
                }, [options]);
            }
        `,
        `
            import { useEffect } from "react";
            function Component() {
                useEffect(() => {
                    const interval = setInterval(refresh, 1_000);
                    clearInterval(interval);
                }, []);
            }
        `,
    ],
    invalid: [
        {
            code: `
                import { useEffect } from "react";
                function Component() {
                    useEffect(() => {
                        window.addEventListener("resize", updateLayout);
                    }, []);
                }
            `,
            errors: [error],
        },
        {
            code: `
                import { useEffect } from "react";
                function Component() {
                    useEffect(() => {
                        document.body.addEventListener("click", handleClick);
                    }, []);
                }
            `,
            errors: [error],
        },
        {
            code: `
                import { useEffect } from "react";
                function Component() {
                    useEffect(() => {
                        setInterval(refresh, 1_000);
                    }, []);
                }
            `,
            errors: [error],
        },
        {
            code: `
                import * as React from "react";
                function Component() {
                    React.useEffect(() => {
                        window.setInterval(refresh, 1_000);
                    }, []);
                }
            `,
            errors: [error],
        },
        {
            code: `
                import { useLayoutEffect } from "react";
                function Component() {
                    useLayoutEffect(() => {
                        self.addEventListener("message", handleMessage, { once: false });
                    }, []);
                }
            `,
            errors: [error],
        },
        {
            code: `
                import { useEffect } from "react";
                function Component() {
                    useEffect(() => {
                        window.addEventListener("resize", updateLayout);
                        setInterval(refresh, 1_000);
                    }, []);
                }
            `,
            errors: [error, error],
        },
    ],
});
