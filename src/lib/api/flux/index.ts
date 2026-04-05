// shelter-mod inspired
import { FluxDispatcher } from "@metro/common";

const blockedSym = Symbol.for("bunny.flux.blocked");
const modifiedSym = Symbol.for("bunny.flux.modified");

export const dispatcher = FluxDispatcher;

type Intercept = (payload: Record<string, any> & { type: string; }) => any;
let intercepts: Intercept[] = [];
const interceptIndex = new Map<Intercept, number>();
let nextInterceptId = 0;

/**
 * @internal
 */
export function injectFluxInterceptor() {
    const cb = (payload: any) => {
        for (const intercept of intercepts) {
            const res = intercept(payload);

            // nullish -> nothing, falsy -> block, object -> modify
            if (res == null) {
                continue;
            } else if (!res) {
                payload[blockedSym] = true;
            } else if (typeof res === "object") {
                Object.assign(payload, res);
                payload[modifiedSym] = true;
            }
        }

        return blockedSym in payload;
    };

    (dispatcher._interceptors ??= []).unshift(cb);

    return () => {
        const idx = interceptIndex.get(cb);
        if (idx !== undefined) {
            intercepts.splice(idx, 1);
            interceptIndex.delete(cb);
            intercepts.forEach((intercept, i) => interceptIndex.set(intercept, i));
        }
    };
}

/**
 * Intercept Flux dispatches. Return type affects the end result, where
 * nullish -> nothing, falsy -> block, object -> modify
 */
export function intercept(cb: Intercept) {
    const id = nextInterceptId++;
    interceptIndex.set(cb, id);
    intercepts.push(cb);

    return () => {
        const idx = interceptIndex.get(cb);
        if (idx !== undefined) {
            intercepts.splice(idx, 1);
            interceptIndex.delete(cb);
            intercepts.forEach((intercept, i) => interceptIndex.set(intercept, i));
        }
    };
}
