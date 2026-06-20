import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';

/**
 * React 19 Compatibility Shim for legacy libraries (like @deriv-com/smartcharts-champion)
 * that rely on React internals which were renamed or moved in React 19.
 */
if (typeof window !== 'undefined') {
    // --------------------------------------------------------------------------
    // THE ULTIMATE REACT 19 LEGACY FIX:
    // Intercept Symbol.for globally. If any legacy pre-compiled bundle (like smartcharts)
    // or its embedded jsx-runtime tries to request the classic 'react.element' symbol
    // to build old JSX nodes, we hand it the modern 'react.transitional.element'.
    // This perfectly fools legacy libraries into natively generating React 19 elements!
    // --------------------------------------------------------------------------
    const originalSymbolFor = Symbol.for;
    if (!(originalSymbolFor as any).__isPatchedForReact19) {
        Symbol.for = function (key: string) {
            if (key === 'react.element') {
                return originalSymbolFor('react.transitional.element');
            }
            return originalSymbolFor.apply(this, arguments as any);
        };
        (Symbol.for as any).__isPatchedForReact19 = true;
    }

    const ReactAny = React as any;
    if (!ReactAny.jsx) {
        ReactAny.jsx = (jsxRuntime as any).jsx;
        ReactAny.jsxs = (jsxRuntime as any).jsxs;
        ReactAny.Fragment = (jsxRuntime as any).Fragment;
    }

    // Force legacy libraries to see this as the global React instance
    window.React = React;

    // Legacy library might check React version (expecting 16/17/18)
    if (React.version && React.version.startsWith('19')) {
        Object.defineProperty(React, 'version', {
            get: () => '18.2.0', // Trick older libraries into thinking it's still React 18
            configurable: true,
        });
    }

    // React 19 moved __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED to
    // __CLIENT_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED in the browser.
    const internals =
        ReactAny.__CLIENT_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED ||
        ReactAny.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

    if (internals) {
        // Ensure the old internal name exists so legacy libraries can find it
        if (!ReactAny.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
            ReactAny.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = internals;
        }

        // React 19 internal structure changed: ReactCurrentOwner -> owner
        // ALWAYS define this property. Even if internals.owner is null at module-init
        // time, the live getter will return the correct value when the library reads it.
        if (!internals.ReactCurrentOwner) {
            Object.defineProperty(internals, 'ReactCurrentOwner', {
                get() {
                    // internals.owner is the React 19 equivalent; fall back to a safe stub
                    return internals.owner !== undefined ? internals.owner : { current: null };
                },
                set(val: any) {
                    internals.owner = val;
                },
                configurable: true,
                enumerable: true,
            });
        }

        // Also map Dispatcher if needed (typical for hooks errors)
        if (!internals.ReactCurrentDispatcher) {
            Object.defineProperty(internals, 'ReactCurrentDispatcher', {
                get() {
                    return internals.H || { current: null };
                },
                configurable: true,
                enumerable: true,
            });
        }

        // Map ReactCurrentBatchConfig if needed
        if (!internals.ReactCurrentBatchConfig) {
            Object.defineProperty(internals, 'ReactCurrentBatchConfig', {
                get() {
                    return internals.T !== undefined ? { transition: internals.T } : { transition: null };
                },
                configurable: true,
                enumerable: true,
            });
        }
    } else {
        // Last-resort: if React internals are completely absent, create a stub
        // so legacy libraries don't throw "Cannot read properties of undefined"
        ReactAny.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
            ReactCurrentOwner: { current: null },
            ReactCurrentDispatcher: { current: null },
            ReactCurrentBatchConfig: { transition: null },
        };
    }
}
