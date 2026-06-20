import { TrackJS } from 'trackjs';

const { TRACKJS_TOKEN } = process.env; // Token may be undefined in non‑production

/**
 * Custom hook to initialize TrackJS.
 * @returns {Object} An object containing the `init` function.
 */
const useTrackjs = () => {
    const isProduction = process.env.APP_ENV === 'production';
    const trackjs_version = process.env.REF_NAME ?? 'undefined';

    const initTrackJS = (loginid: string) => {
        // Abort if token is missing – prevents TrackJS missing‑token warnings.
        if (!TRACKJS_TOKEN) {
            // eslint-disable-next-line no-console
           if (window.TrackJS && window.TrackJS.console) window.TrackJS.console.log('TrackJS token is not set; skipping TrackJS initialization');
            return;
        }
        try {
            if (!TrackJS.isInstalled()) {
                TrackJS.install({
                    application: 'standalone-deriv-bot',
                    dedupe: false,
                    enabled: isProduction,
                    token: TRACKJS_TOKEN,
                    userId: loginid,
                    version:
                        (document.querySelector('meta[name=version]') as HTMLMetaElement)?.content ?? trackjs_version,
                });
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to initialize TrackJS', error);
        }
    };

    return { initTrackJS };
};

export default useTrackjs;
