import { RuleTester } from "../../../test/rule-tester.ts";

import { noStaleStateAfterAwaitRule } from "./no-stale-state-after-await.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });
const error = { messageId: "staleState" };

tester.run("antislop/no-stale-state-after-await", noStaleStateAfterAwaitRule, {
    valid: [
        `
            import { useState } from "react";
            function Component() {
                const [users, setUsers] = useState<User[]>([]);
                async function addUser(id: string) {
                    const user = await fetchUser(id);
                    setUsers((currentUsers) => [...currentUsers, user]);
                }
                return addUser;
            }
        `,
        `
            import { useState } from "react";
            function Component() {
                const [count, setCount] = useState(0);
                async function save() {
                    setCount(count + 1);
                    await persist();
                }
                return save;
            }
        `,
        `
            import { useState } from "react";
            function Component() {
                const [loading, setLoading] = useState(false);
                async function load() {
                    await fetchData();
                    setLoading(false);
                }
                return load;
            }
        `,
        `
            declare function useState<T>(value: T): [T, (value: T) => void];
            function Component() {
                const [count, setCount] = useState(0);
                async function load() {
                    await fetchData();
                    setCount(count + 1);
                }
                return load;
            }
        `,
        `
            import { useState } from "react";
            async function Component() {
                await initialize();
                const [count, setCount] = useState(0);
                setCount(count + 1);
                return count;
            }
        `,
        `
            import { useState } from "react";
            function Component() {
                const [count, setCount] = useState(0);
                async function load(ready: boolean) {
                    ready && (await fetchData());
                    setCount(count + 1);
                }
                return load;
            }
        `,
    ],
    invalid: [
        {
            code: `
                import { useState } from "react";
                function Component() {
                    const [users, setUsers] = useState<User[]>([]);
                    async function addUser(id: string) {
                        const user = await fetchUser(id);
                        setUsers([...users, user]);
                    }
                    return addUser;
                }
            `,
            errors: [error],
        },
        {
            code: `
                import { useState } from "react";
                function Component() {
                    const [settings, setSettings] = useState({ theme: "dark" });
                    async function save() {
                        await persist(settings);
                        setSettings({ ...settings, saved: true });
                    }
                    return save;
                }
            `,
            errors: [error],
        },
        {
            code: `
                import * as React from "react";
                function Component() {
                    const [count, setCount] = React.useState(0);
                    async function increment() {
                        await synchronize();
                        setCount(count + 1);
                    }
                    return increment;
                }
            `,
            errors: [error],
        },
        {
            code: `
                import { useState as state } from "react";
                function Component() {
                    const [items, setItems] = state<Item[]>([]);
                    async function append() {
                        const item = await fetchItem();
                        setItems(() => [...items, item]);
                    }
                    return append;
                }
            `,
            errors: [error],
        },
        {
            code: `
                import { useState } from "react";
                function Component() {
                    const [count, setCount] = useState(0);
                    async function increment(enabled: boolean) {
                        if (enabled) {
                            await synchronize();
                            setCount(count + 1);
                        }
                    }
                    return increment;
                }
            `,
            errors: [error],
        },
    ],
});
